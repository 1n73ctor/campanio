import { BadRequestException, Injectable } from '@nestjs/common';
import type { Booking, Prisma } from '@prisma/client';
import { WalletLedger } from '../common/wallet-ledger.service';

type Tx = Prisma.TransactionClient;

/**
 * Escrow: the full booking total is held when the user pays. It is later settled exactly once:
 *   refund    → user wallet
 *   release   → companion wallet (their earnings, after commission)
 *   remainder → retained by the platform (connection fee + GST + commission)
 */
@Injectable()
export class EscrowService {
  constructor(private wallet: WalletLedger) {}

  async hold(tx: Tx, bookingId: string, amount: number) {
    return tx.escrow.create({ data: { bookingId, amount, status: 'HELD' } });
  }

  async freeze(tx: Tx, bookingId: string) {
    await tx.escrow.updateMany({ where: { bookingId, status: 'HELD' }, data: { status: 'FROZEN' } });
  }

  async unfreeze(tx: Tx, bookingId: string) {
    await tx.escrow.updateMany({ where: { bookingId, status: 'FROZEN' }, data: { status: 'HELD' } });
  }

  async settle(tx: Tx, booking: Booking, refund: number, release: number, label: string) {
    const escrow = await tx.escrow.findUnique({ where: { bookingId: booking.id } });
    if (!escrow || !['HELD', 'FROZEN'].includes(escrow.status)) throw new BadRequestException('Escrow already settled');
    refund = Math.max(0, Math.round(refund));
    release = Math.max(0, Math.round(release));
    if (refund + release > escrow.amount) throw new BadRequestException('Settlement exceeds escrow amount');

    // claim the escrow atomically so a concurrent settle can't double-pay
    const claimed = await tx.escrow.updateMany({
      where: { id: escrow.id, status: { in: ['HELD', 'FROZEN'] } },
      data: {
        refunded: refund,
        released: release,
        retained: escrow.amount - refund - release,
        status: refund === escrow.amount ? 'REFUNDED' : refund === 0 ? 'RELEASED' : 'SETTLED',
        settledAt: new Date(),
      },
    });
    if (claimed.count !== 1) throw new BadRequestException('Escrow already settled');

    const ref = { type: 'booking', id: booking.id };
    // whatever was paid with credit comes back as credit; only money actually paid in becomes withdrawable
    const promo = refund ? await this.wallet.bookingRefundPromo(tx, booking.id, refund) : 0;
    await this.wallet.credit(tx, booking.userId, refund, `Refund · ${label}`, { ...ref, type: 'booking-refund' }, promo);
    await this.wallet.credit(tx, booking.companionUserId, release, `Earnings · ${label}`, { ...ref, type: 'booking-earning' });
  }
}
