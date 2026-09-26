import { Body, Controller, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthGuard, CurrentUser } from '../common/auth';
import { PaymentsService } from './payments.service';

class CheckoutDto {
  @IsString() bookingId: string;
  @IsOptional() @IsBoolean() useWallet?: boolean;
}
class VerifyDto {
  @IsString() orderId: string;
  @IsString() paymentId: string;
  @IsString() signature: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('checkout')
  @HttpCode(200)
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto) {
    return this.svc.checkout(user, dto.bookingId, dto.useWallet ?? true);
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
  @Post('webhook/razorpay')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') sig: string) {
    return this.svc.webhook(req.rawBody, sig);
  }
}
