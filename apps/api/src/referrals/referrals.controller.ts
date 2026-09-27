import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { AuthGuard, CurrentUser } from '../common/auth';
import { ReferralsService } from './referrals.service';

@ApiTags('referrals')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private referrals: ReferralsService) {}

  /** The caller's invite code (created on first request) and invite stats. */
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.referrals.summary(user);
  }
}
