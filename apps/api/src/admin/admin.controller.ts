import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { AuthGuard, CurrentUser, Roles } from '../common/auth';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { IsString, Length } from 'class-validator';

class TotpDto {
  @IsString() @Length(6, 6) code: string;
}
import {
  HiddenDto,
  NoteDto,
  PageDto,
  PayoutPaidDto,
  RefundDto,
  RejectDto,
  ResolveDisputeDto,
  ResolveReportDto,
  SettingsDto,
  UserStatusDto,
} from './admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private svc: AdminService,
    private auth: AuthService,
  ) {}

  @Get('stats') stats() { return this.svc.stats(); }

  @Get('users') users(@Query() q: PageDto) { return this.svc.users(q); }
  @Get('users/:id') user(@CurrentUser() a: User, @Param('id') id: string) { return this.svc.user(id, a); }
  @Post('users/:id/refund-companion-fee') refundCompanionFee(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.svc.refundCompanionFee(a, id, dto.note);
  }
  @Post('users/:id/status') userStatus(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: UserStatusDto) {
    return this.svc.setUserStatus(a, id, dto.status, dto.reason);
  }

  @Get('kyc') kyc(@Query() q: PageDto) { return this.svc.kycList(q); }
  @Post('kyc/:id/approve') kycApprove(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.svc.kycDecide(a, id, true, dto.note);
  }
  @Post('kyc/:id/reject') kycReject(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: RejectDto) {
    return this.svc.kycDecide(a, id, false, dto.note, dto.refundFee);
  }

  @Get('bookings') bookings(@CurrentUser() a: User, @Query() q: PageDto) { return this.svc.bookings(q, a); }
  @Get('bookings/:id') booking(@CurrentUser() a: User, @Param('id') id: string) { return this.svc.booking(id, a); }
  @Post('bookings/:id/refund') refund(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: RefundDto) {
    return this.svc.refund(a, id, dto.note, dto.amount);
  }

  @Get('disputes') disputes(@CurrentUser() a: User, @Query() q: PageDto) { return this.svc.disputes(q, a); }
  @Post('disputes/:id/resolve') resolveDispute(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.svc.resolveDispute(a, id, dto);
  }

  @Get('reports') reports(@Query() q: PageDto) { return this.svc.reports(q); }
  @Post('reports/:id/resolve') resolveReport(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.svc.resolveReport(a, id, dto);
  }

  @Get('messages/flagged') flagged(@Query() q: PageDto) { return this.svc.flaggedMessages(q); }
  @Post('messages/:id/hidden') hideMessage(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: HiddenDto) {
    return this.svc.setMessageHidden(a, id, dto.hidden);
  }

  @Get('reviews') reviews(@Query() q: PageDto) { return this.svc.reviews(q); }
  @Post('reviews/:id/hidden') hideReview(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: HiddenDto) {
    return this.svc.setReviewHidden(a, id, dto.hidden);
  }

  @Get('payouts') payouts(@Query() q: PageDto) { return this.svc.payouts(q); }
  @Post('payouts/:id/paid') payoutPaid(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: PayoutPaidDto) {
    return this.svc.payoutPaid(a, id, dto.reference);
  }
  @Post('payouts/:id/reject') payoutReject(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: RejectDto) {
    return this.svc.payoutReject(a, id, dto.note);
  }

  @Get('sos') sos(@Query() q: PageDto) { return this.svc.sos(q); }
  @Post('sos/:id/resolve') resolveSos(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.svc.resolveSos(a, id, dto.note);
  }

  // two-factor sign-in for the signed-in admin
  @Get('2fa') twoFactor(@CurrentUser() a: User) { return this.auth.twoFactorStatus(a); }
  @Post('2fa/setup') twoFactorSetup(@CurrentUser() a: User) { return this.auth.twoFactorSetup(a); }
  @Post('2fa/enable') twoFactorEnable(@CurrentUser() a: User, @Body() dto: TotpDto) { return this.auth.twoFactorEnable(a, dto.code); }
  @Post('2fa/disable') twoFactorDisable(@CurrentUser() a: User, @Body() dto: TotpDto) { return this.auth.twoFactorDisable(a, dto.code); }

  @Get('settings') settings() { return this.svc.getSettings(); }
  @Put('settings') updateSettings(@CurrentUser() a: User, @Body() dto: SettingsDto) { return this.svc.updateSettings(a, dto); }

  @Get('audit') audit(@Query() q: PageDto) { return this.svc.auditLog(q); }
}
