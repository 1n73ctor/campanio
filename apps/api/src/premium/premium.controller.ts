import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { AuthGuard, CurrentUser, OptionalAuthGuard, Roles } from '../common/auth';
import { PremiumService } from './premium.service';

class UnlockDto {
  @IsIn(['HOST', 'PASS_30', 'LIFETIME']) kind: 'HOST' | 'PASS_30' | 'LIFETIME';
  @ValidateIf((o: UnlockDto) => o.kind === 'HOST') @IsString() hostId?: string;
  @IsIn(['coins', 'gateway']) payWith: 'coins' | 'gateway';
}
class SetDto {
  @IsBoolean() premium: boolean;
}
class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

@ApiTags('premium')
@Controller('premium')
export class PremiumController {
  constructor(private svc: PremiumService) {}

  @Get() @UseGuards(OptionalAuthGuard) offer(@Req() req: { user?: User }) {
    return this.svc.offer(req.user);
  }
  @Get('unlocked') @ApiBearerAuth() @UseGuards(AuthGuard) unlocked(@CurrentUser() u: User) {
    return this.svc.unlocked(u);
  }
  @Get('hosts/:id') @ApiBearerAuth() @UseGuards(AuthGuard) host(@CurrentUser() u: User, @Param('id') id: string) {
    return this.svc.fullHost(u, id);
  }
  @Post('unlock') @HttpCode(200) @ApiBearerAuth() @UseGuards(AuthGuard) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  unlock(@CurrentUser() u: User, @Body() dto: UnlockDto) {
    return this.svc.unlock(u, dto.kind, dto.hostId, dto.payWith);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin/premium')
export class AdminPremiumController {
  constructor(private svc: PremiumService) {}

  @Get() list(@Query() q: PageDto) {
    return this.svc.adminList(q);
  }
  @Post('hosts/:userId') @HttpCode(200) set(@CurrentUser() a: User, @Param('userId') userId: string, @Body() dto: SetDto) {
    return this.svc.setPremium(a, userId, dto.premium);
  }
}
