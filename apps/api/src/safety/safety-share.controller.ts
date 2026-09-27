import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthGuard, CurrentUser } from '../common/auth';
import { SafetyShareService } from './safety-share.service';

class AlertDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** The booking participant manages their "watch my session" link. */
@ApiTags('safety')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('bookings/:id/share')
export class SafetyShareController {
  constructor(private svc: SafetyShareService) {}

  @Get()
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Post()
  @HttpCode(200)
  create(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.create(user, id);
  }

  @Delete()
  revoke(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.revoke(user, id);
  }
}

/** Public, no login: the trusted contact's view of a shared session. */
@ApiTags('safety')
@Controller('share')
export class PublicSafetyShareController {
  constructor(private svc: SafetyShareService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // the page polls; this still stops token guessing
  view(@Param('token') token: string) {
    return this.svc.view(token);
  }

  @Post(':token/alert')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  alert(@Param('token') token: string, @Body() dto: AlertDto) {
    return this.svc.alert(token, dto.note);
  }
}
