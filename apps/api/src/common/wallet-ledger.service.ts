import { BadRequestException, ConflictException, Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import type { Prisma, Wallet } from '@prisma/client';
import { formatINR } from '@companio/types';
import { PrismaService } from './prisma.service';

type Tx = Prisma.TransactionClient;
type Ref = { type: string; id: string };

/** wallet credits that are always spend-only: platform money, not money the person paid in */
const SPEND_ONLY_REFS = ['welcome', 'cashback', 'referral', 'booking-goodwill'];
const BACKFILL_FLAG = 'walletSpendOnlyBackfill';

/**
 * Double-entry-ish wallet ledger. Every balance change writes a WalletTxn with the running balance.
 *
 * Part of a balance can be spend-only credit (`promoBalance`): welcome credit, cashback, referral rewards, support
 * goodwill — and refunds of anything that was paid with them. It pays for bookings like cash but is never withdrawn,
 * so "get credit → book → cancel → withdraw the refund" can't turn it into money. Spending uses credit first;
 * withdrawals can only take the rest.
 */
@Injectable()
export class WalletLedger implements OnModuleInit {
  private log = new Logger('Wallet');
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.backfillSpendOnly().catch((e) => this.log.error('spend-only credit backfill failed', e as Error));
  }

  async ensure(tx: Tx, userId: string) {
    return tx.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  async balances(userId: string) {
    const w = await this.prisma.wallet.findUnique({ where: { userId } });
    const balance = w?.balance ?? 0;
    const promoBalance = Math.min(w?.promoBalance ?? 0, balance);
    return { balance, promoBalance, withdrawable: balance - promoBalance };
  }

  async balance(userId: string) {
    return (await this.balances(userId)).balance;
  }

  /** `promo`: how much of this credit is spend-only (0 = all withdrawable, `amount` = all credit). */
  async credit(tx: Tx, userId: string, amount: number, reason: string, ref?: Ref, promo = 0) {
    if (amount <= 0) return;
    promo = Math.max(0, Math.min(Math.round(promo), amount));
    const w = await this.ensure(tx, userId);
    const updated = await tx.wallet.update({ where: { id: w.id }, data: { balance: { increment: amount }, promoBalance: { increment: promo } } });
    await tx.walletTxn.create({
      data: { walletId: w.id, type: 'CREDIT', amount, reason, refType: ref?.type, refId: ref?.id, promoAmount: promo, balanceAfter: updated.balance },
    });
  }

  /**
   * Pays for something on the platform. Spend-only credit goes first (unless `cashOnly`, e.g. the registration fee).
   * Returns how much of the amount was credit, so a refund can give exactly that back as credit.
   */
  async spend(tx: Tx, userId: string, amount: number, reason: string, ref: Ref, opts: { cashOnly?: boolean } = {}): Promise<number> {
    if (amount <= 0) return 0;
    return this.take(tx, userId, amount, reason, ref, (w) => {
      const cash = w.balance - promoOf(w);
      if (opts.cashOnly) {
        if (cash < amount) throw new BadRequestException(`Only ${formatINR(Math.max(0, cash))} of your wallet can pay for this — credit is for meetups only`);
        return 0;
      }
      if (w.balance < amount) throw new BadRequestException('Insufficient wallet balance');
      return Math.min(promoOf(w), amount);
    });
  }

  /** Money leaving the platform (payouts): only the withdrawable part of the balance. */
  async withdraw(tx: Tx, userId: string, amount: number, reason: string, ref: Ref) {
    await this.take(tx, userId, amount, reason, ref, (w) => {
      const cash = w.balance - promoOf(w);
      if (cash < amount)
        throw new BadRequestException(
          promoOf(w) > 0
            ? `You can withdraw up to ${formatINR(Math.max(0, cash))}. The other ${formatINR(promoOf(w))} is credit (welcome credit, cashback, rewards) — use it on meetups.`
            : 'Insufficient wallet balance',
        );
      return 0;
    });
  }

  private async take(tx: Tx, userId: string, amount: number, reason: string, ref: Ref, promoToUse: (w: Wallet) => number) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const w = await this.ensure(tx, userId);
      const promo = promoToUse(w);
      // only applies if nothing changed since we read it, so concurrent payments can't overdraw or double-use credit
      const res = await tx.wallet.updateMany({
        where: { id: w.id, balance: w.balance, promoBalance: w.promoBalance },
        data: { balance: { decrement: amount }, promoBalance: promoOf(w) === w.promoBalance ? { decrement: promo } : promoOf(w) - promo },
      });
      if (res.count !== 1) continue;
      await tx.walletTxn.create({
        data: { walletId: w.id, type: 'DEBIT', amount, reason, refType: ref.type, refId: ref.id, promoAmount: promo, balanceAfter: w.balance - amount },
      });
      return promo;
    }
    throw new ConflictException('Your wallet changed while we were updating it — please try again');
  }

  /** The part of a booking refund to give back as credit: whatever credit paid for it and hasn't come back yet. */
  async bookingRefundPromo(tx: Tx, bookingId: string, amount: number) {
    const paid = await tx.payment.aggregate({ where: { bookingId, status: 'PAID' }, _sum: { walletPromo: true } });
    const back = await tx.walletTxn.aggregate({ where: { refId: bookingId, refType: 'booking-refund', type: 'CREDIT' }, _sum: { promoAmount: true } });
    return Math.max(0, Math.min(amount, (paid._sum.walletPromo ?? 0) - (back._sum.promoAmount ?? 0)));
  }

  /** Same for a refunded registration fee (only fees paid before credit was excluded from them can contain any). */
  async feeRefundPromo(tx: Tx, userId: string, amount: number) {
    const paid = await tx.payment.aggregate({ where: { userId, purpose: 'COMPANION_FEE', status: 'PAID' }, _sum: { walletPromo: true } });
    const back = await tx.walletTxn.aggregate({ where: { wallet: { userId }, refType: 'companion-fee', type: 'CREDIT' }, _sum: { promoAmount: true } });
    return Math.max(0, Math.min(amount, (paid._sum.walletPromo ?? 0) - (back._sum.promoAmount ?? 0)));
  }

  /**
   * One-time, when this version first starts: works out the spend-only part of wallets created before it existed,
   * by replaying each wallet's history with today's rules.
   */
  async backfillSpendOnly() {
    if (await this.prisma.setting.findUnique({ where: { key: BACKFILL_FLAG } })) return;
    const wallets = await this.prisma.wallet.findMany({ select: { id: true, balance: true } });
    let withCredit = 0;
    for (const w of wallets) {
      await this.prisma.$transaction(async (tx) => {
        const txns = await tx.walletTxn.findMany({ where: { walletId: w.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        let promo = 0;
        let feePromo = 0;
        const bookingPromo = new Map<string, number>();
        for (const t of txns) {
          let p = 0;
          if (t.type === 'CREDIT') {
            if (t.refType && SPEND_ONLY_REFS.includes(t.refType)) p = t.amount;
            else if (t.refType === 'booking-refund' && t.refId) {
              p = Math.min(t.amount, bookingPromo.get(t.refId) ?? 0);
              bookingPromo.set(t.refId, (bookingPromo.get(t.refId) ?? 0) - p);
            } else if (t.refType === 'companion-fee') {
              p = Math.min(t.amount, feePromo);
              feePromo -= p;
            }
            promo += p;
          } else if (t.refType === 'booking' || t.refType === 'companion-fee') {
            p = Math.min(promo, t.amount);
            promo -= p;
            if (p && t.refType === 'booking' && t.refId) {
              bookingPromo.set(t.refId, (bookingPromo.get(t.refId) ?? 0) + p);
              const pay = await tx.payment.findFirst({ where: { bookingId: t.refId, status: 'PAID', walletAmount: { gt: 0 } }, orderBy: { createdAt: 'desc' } });
              if (pay) await tx.payment.update({ where: { id: pay.id }, data: { walletPromo: p } });
            } else if (p && t.refId) {
              feePromo += p;
              await tx.payment.updateMany({ where: { id: t.refId }, data: { walletPromo: p } });
            }
          }
          promo = Math.min(promo, t.balanceAfter); // anything already paid out can't be taken back
          if (p !== t.promoAmount) await tx.walletTxn.update({ where: { id: t.id }, data: { promoAmount: p } });
        }
        const final = Math.max(0, Math.min(promo, w.balance));
        if (final) withCredit++;
        await tx.wallet.update({ where: { id: w.id }, data: { promoBalance: final } });
      });
    }
    await this.prisma.setting.upsert({ where: { key: BACKFILL_FLAG }, create: { key: BACKFILL_FLAG, value: '1' }, update: {} });
    this.log.log(`spend-only credit worked out for ${wallets.length} wallets (${withCredit} hold credit)`);
  }
}

/** never more credit than money: guards rows written before promoBalance existed */
const promoOf = (w: Wallet) => Math.max(0, Math.min(w.promoBalance, w.balance));

@Global()
@Module({ providers: [WalletLedger], exports: [WalletLedger] })
export class WalletLedgerModule {}
