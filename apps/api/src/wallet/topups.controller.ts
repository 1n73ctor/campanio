import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../common/auth';
import { TopUpsService } from './topups.service';

class StartDto {
  @Type(() => Number) @IsInt() @Min(1) amount: number;
}
class PaidDto {
  @IsOptional() @IsString() @MaxLength(40) utr?: string;
}
class ListDto {
  @IsOptional() @IsIn(['PENDING', 'STARTED', 'APPROVED', 'REJECTED', 'ALL']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
class ApproveDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) amount?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
class RejectDto {
  @IsString() @Length(3, 300) reason: string;
}

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('wallet/topups')
export class TopUpsController {
  constructor(private svc: TopUpsService) {}

  /** UPI QR or payment gateway, and the limits */
  @Get('mode') mode() {
    return this.svc.mode();
  }
  @Get() mine(@CurrentUser() u: User) {
    return this.svc.mine(u);
  }
  @Post() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(@CurrentUser() u: User, @Body() dto: StartDto) {
    return this.svc.start(u, dto.amount);
  }
  @Post(':id/paid') paid(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: PaidDto) {
    return this.svc.submit(u, id, dto.utr);
  }
  @Post(':id/cancel') cancel(@CurrentUser() u: User, @Param('id') id: string) {
    return this.svc.cancel(u, id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin/topups')
export class AdminTopUpsController {
  constructor(private svc: TopUpsService) {}

  @Get() list(@Query() q: ListDto) {
    return this.svc.adminList(q.status ?? 'PENDING', q.page ?? 1);
  }
  @Post(':id/approve') approve(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: ApproveDto) {
    return this.svc.approve(a, id, dto.amount, dto.note);
  }
  @Post(':id/reject') reject(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: RejectDto) {
    return this.svc.reject(a, id, dto.reason);
  }
}
