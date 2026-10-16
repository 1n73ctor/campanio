import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard, CurrentUser, Roles } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { toPayoutDto, toWalletTxnDto } from '../common/mappers';
import { testPayments } from '../common/config';
import { NotificationsService } from '../notifications/notifications.service';
import { formatINR } from '@companio/types';

class PayoutRequestDto {
  @Type(() => Number) @IsInt() @Min(1) amount: number;
  @IsString() @Matches(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, { message: 'Enter a valid UPI ID (e.g. name@okaxis)' }) upiId: string;
}

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private prisma: PrismaService,
    private ledger: WalletLedger,
    private settings: SettingsService,
    private notifications: NotificationsService,
  ) {}

  @Get()
  async get(@CurrentUser() user: User) {
    const w = await this.prisma.wallet.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    const txns = await this.prisma.walletTxn.findMany({ where: { walletId: w.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { ...(await this.ledger.balances(user.id)), txns: txns.map(toWalletTxnDto) };
  }

  @Get('payouts')
  async payouts(@CurrentUser() user: User) {
    const rows = await this.prisma.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    return rows.map(toPayoutDto);
  }

  /** Companions withdraw earnings to UPI. Amount is debited immediately; rejected payouts are re-credited. */
  @Post('payouts')
  @Roles('COMPANION')
  async requestPayout(@CurrentUser() user: User, @Body() dto: PayoutRequestDto) {
    // test-mode payments move no real money, so paying out "earnings" from them would cost real money
    if (process.env.NODE_ENV === 'production' && testPayments()) throw new BadRequestException('Payouts are paused while payments are in test mode');
    const { minPayout } = await this.settings.get();
    if (dto.amount < minPayout) throw new BadRequestException(`Minimum payout is ₹${minPayout}`);
    const pending = await this.prisma.payout.count({ where: { userId: user.id, status: 'REQUESTED' } });
    if (pending) throw new BadRequestException('You already have a payout in progress');
    const payout = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payout.create({ data: { userId: user.id, amount: dto.amount, upiId: dto.upiId } });
      // credit (welcome credit, cashback, rewards) is for bookings; only the rest can leave the platform
      await this.ledger.withdraw(tx, user.id, dto.amount, `Payout to ${dto.upiId}`, { type: 'payout', id: p.id });
      return p;
    });
    await this.notifications.notify(user.id, {
      type: 'payout.requested',
      title: `Payout of ${formatINR(payout.amount)} requested`,
      body: `We’ll send ${formatINR(payout.amount)} to ${payout.upiId}, usually within 1–2 working days. We’ll let you know when it’s on its way.`,
      link: '/wallet',
    });
    return toPayoutDto(payout);
  }
}
