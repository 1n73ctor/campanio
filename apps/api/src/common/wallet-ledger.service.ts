import { BadRequestException, Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

type Tx = Prisma.TransactionClient;

/** Double-entry-ish wallet ledger. Every balance change writes a WalletTxn with the running balance. */
@Injectable()
export class WalletLedger {
  constructor(private prisma: PrismaService) {}

  async ensure(tx: Tx, userId: string) {
    return tx.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  async balance(userId: string) {
    const w = await this.prisma.wallet.findUnique({ where: { userId } });
    return w?.balance ?? 0;
  }

  async credit(tx: Tx, userId: string, amount: number, reason: string, ref?: { type: string; id: string }) {
    if (amount <= 0) return;
    const w = await this.ensure(tx, userId);
    const updated = await tx.wallet.update({ where: { id: w.id }, data: { balance: { increment: amount } } });
    await tx.walletTxn.create({
      data: { walletId: w.id, type: 'CREDIT', amount, reason, refType: ref?.type, refId: ref?.id, balanceAfter: updated.balance },
    });
  }

  async debit(tx: Tx, userId: string, amount: number, reason: string, ref?: { type: string; id: string }) {
    if (amount <= 0) return;
    const w = await this.ensure(tx, userId);
    // conditional update guards against concurrent overdraw
    const res = await tx.wallet.updateMany({ where: { id: w.id, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
    if (res.count !== 1) throw new BadRequestException('Insufficient wallet balance');
    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: w.id } });
    await tx.walletTxn.create({
      data: { walletId: w.id, type: 'DEBIT', amount, reason, refType: ref?.type, refId: ref?.id, balanceAfter: updated.balance },
    });
  }
}

@Global()
@Module({ providers: [WalletLedger], exports: [WalletLedger] })
export class WalletLedgerModule {}
