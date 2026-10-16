/* eslint-disable no-console */
/**
 * Clears all meetup activity — bookings and everything hanging off them (chat, reviews, disputes, SOS, safety shares,
 * live locations, booking payments, escrow), payouts, refunds and the related notifications — while keeping users,
 * hosts, KYC, registration-fee payments and settings.
 *
 * Wallet balances are kept: the wallet history is replaced by one "Opening balance" entry per wallet (credit stays
 * credit), so nothing refers to deleted meetups. Host ratings and session counts go back to zero.
 *
 * Take a backup first. Run with:  npm run db:reset-activity -w @companio/api -- --yes
 */
import '../src/common/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('This permanently deletes all meetups, payouts and refunds. Back up the database, then re-run with --yes');
    process.exitCode = 1;
    return;
  }
  const before = await prisma.wallet.aggregate({ _sum: { balance: true, promoBalance: true }, _count: true });

  const r = await prisma.$transaction(
    async (tx) => {
      const wallets = await tx.wallet.findMany({ select: { id: true, balance: true, promoBalance: true } });
      // reports are moderation history about people: keep them, just unlink the deleted chat/meetup
      const reports = await tx.report.updateMany({ where: { OR: [{ bookingId: { not: null } }, { messageId: { not: null } }] }, data: { bookingId: null, messageId: null } });
      const counts = {
        liveLocations: (await tx.liveLocation.deleteMany()).count,
        safetyShares: (await tx.safetyShare.deleteMany()).count,
        sosAlerts: (await tx.sosAlert.deleteMany()).count,
        disputes: (await tx.dispute.deleteMany()).count,
        reviews: (await tx.review.deleteMany()).count,
        messages: (await tx.message.deleteMany()).count,
        escrows: (await tx.escrow.deleteMany()).count,
        bookingPayments: (await tx.payment.deleteMany({ where: { OR: [{ purpose: 'BOOKING' }, { bookingId: { not: null } }] } })).count,
        bookings: (await tx.booking.deleteMany()).count,
        payouts: (await tx.payout.deleteMany()).count,
        walletEntries: (await tx.walletTxn.deleteMany()).count,
        notifications: (
          await tx.notification.deleteMany({
            where: { OR: ['booking', 'payout', 'refund', 'review', 'dispute', 'sos', 'payment', 'wallet.cashback', 'referral'].map((p) => ({ type: { startsWith: p } })) },
          })
        ).count,
        reportsUnlinked: reports.count,
      };
      // same balances, fresh history
      for (const w of wallets) {
        if (w.balance <= 0) continue;
        await tx.walletTxn.create({
          data: { walletId: w.id, type: 'CREDIT', amount: w.balance, promoAmount: Math.min(w.promoBalance, w.balance), reason: 'Opening balance', refType: 'opening', balanceAfter: w.balance },
        });
      }
      await tx.companionProfile.updateMany({ data: { ratingAvg: 0, ratingCount: 0, completedBookings: 0 } });
      return counts;
    },
    { timeout: 120_000 },
  );

  const after = await prisma.wallet.aggregate({ _sum: { balance: true, promoBalance: true } });
  console.table(r);
  console.log(`wallets: ${before._count} · total balance ₹${before._sum.balance ?? 0} → ₹${after._sum.balance ?? 0} · credit ₹${before._sum.promoBalance ?? 0} → ₹${after._sum.promoBalance ?? 0}`);
  if ((before._sum.balance ?? 0) !== (after._sum.balance ?? 0)) throw new Error('wallet total changed — restore the backup');
  console.log('✅ meetup activity cleared');
}

main()
  .catch((e) => {
    console.error(`❌ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
