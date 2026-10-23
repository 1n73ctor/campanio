import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthGuard, CurrentUser } from '../common/auth';
import { PaymentsService } from './payments.service';
import { TopUpOffersService } from './topup-offers.service';

class CheckoutDto {
  @IsString() bookingId: string;
  @IsOptional() @IsBoolean() useWallet?: boolean;
}
class FeeCheckoutDto {
  @IsOptional() @IsBoolean() useWallet?: boolean;
}
class TopUpDto {
  @Type(() => Number) @IsInt() @Min(1) amount: number;
}
class VerifyDto {
  @IsString() orderId: string;
  @IsString() paymentId: string;
  @IsString() signature: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private svc: PaymentsService,
    private offers: TopUpOffersService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('checkout')
  @HttpCode(200)
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto) {
    return this.svc.checkout(user, dto.bookingId, dto.useWallet ?? true);
  }

  /** Companion registration fee (see CompanionFeeService). Confirm with POST /payments/verify like a booking. */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('companion-fee')
  @HttpCode(200)
  companionFee(@CurrentUser() user: User, @Body() dto: FeeCheckoutDto) {
    return this.svc.checkoutCompanionFee(user, dto.useWallet ?? true);
  }

  /** Bonus offers this member can use when adding coins. */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('topup/offers')
  topUpOffers(@CurrentUser() user: User) {
    return this.offers.forMember(user.id);
  }

  /** Add coins to the wallet (spend-only). */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('topup')
  @HttpCode(200)
  topUp(@CurrentUser() user: User, @Body() dto: TopUpDto) {
    return this.svc.checkoutTopUp(user, dto.amount);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('verify')
  @HttpCode(200)
  verify(@CurrentUser() user: User, @Body() dto: VerifyDto) {
    return this.svc.verify(user, dto.orderId, dto.paymentId, dto.signature);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('mock/:orderId/pay')
  @HttpCode(200)
  mockPay(@Param('orderId') orderId: string) {
    return this.svc.mockPay(orderId);
  }

  @SkipThrottle()
  @Post('webhook/cashfree')
  @HttpCode(200)
  cashfreeWebhook(@Req() req: RawBodyRequest<Request>, @Headers('x-webhook-signature') sig: string, @Headers('x-webhook-timestamp') ts: string) {
    return this.svc.cashfreeWebhook(req.rawBody, sig, ts);
  }

  @SkipThrottle()
  @Post('webhook/razorpay')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') sig: string) {
    return this.svc.webhook(req.rawBody, sig);
  }
}
