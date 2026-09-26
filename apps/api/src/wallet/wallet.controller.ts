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
  ) {}

  @Get()
  async get(@CurrentUser() user: User) {
    const w = await this.prisma.wallet.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    const txns = await this.prisma.walletTxn.findMany({ where: { walletId: w.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { balance: w.balance, txns: txns.map(toWalletTxnDto) };
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
    const { minPayout } = await this.settings.get();
    if (dto.amount < minPayout) throw new BadRequestException(`Minimum payout is ₹${minPayout}`);
    const pending = await this.prisma.payout.count({ where: { userId: user.id, status: 'REQUESTED' } });
    if (pending) throw new BadRequestException('You already have a payout in progress');
    const payout = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payout.create({ data: { userId: user.id, amount: dto.amount, upiId: dto.upiId } });
      await this.ledger.debit(tx, user.id, dto.amount, `Payout to ${dto.upiId}`, { type: 'payout', id: p.id });
      return p;
    });
    return toPayoutDto(payout);
  }
}
