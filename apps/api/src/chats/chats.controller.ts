import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { AuthGuard, CurrentUser, Impersonator, Roles } from '../common/auth';
import { ChatsService } from './chats.service';

class UnlockDto {
  @IsString() companionId: string;
  @IsIn(['TIMED', 'PERMANENT']) kind: 'TIMED' | 'PERMANENT';
}
class SendDto {
  @IsString() @Length(1, 1000) body: string;
}
class AdminUnlocksDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @IsIn(['ACTIVE', 'ANSWERED', 'REFUNDED']) status?: string;
}

@ApiTags('chats')
@Controller('chats')
export class ChatsPublicController {
  constructor(private svc: ChatsService) {}

  /** Prices and whether paid chats are on (shown on host profiles, signed in or not). */
  @Get('prices') prices() {
    return this.svc.prices();
  }
}

@ApiTags('chats')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private svc: ChatsService) {}

  @Get() list(@CurrentUser() u: User) {
    return this.svc.list(u);
  }
  @Get('with/:companionId') withHost(@CurrentUser() u: User, @Param('companionId') companionId: string) {
    return this.svc.withHost(u, companionId);
  }
  @Post('unlock') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  unlock(@CurrentUser() u: User, @Body() dto: UnlockDto) {
    return this.svc.unlock(u, dto.companionId, dto.kind);
  }
  @Get(':id') get(@CurrentUser() u: User, @Param('id') id: string, @Impersonator() admin?: User) {
    // an admin viewing as this person doesn't mark their messages as read
    return this.svc.get(u, id, !admin);
  }
  @Post(':id/messages') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  send(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: SendDto) {
    return this.svc.send(u, id, dto.body);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin/chats')
export class AdminChatsController {
  constructor(private svc: ChatsService) {}

  @Get('stats') stats() {
    return this.svc.adminStats();
  }
  @Get('unlocks') unlocks(@Query() q: AdminUnlocksDto) {
    return this.svc.adminUnlocks(q.page ?? 1, q.status);
  }
  @Get(':id') conversation(@Param('id') id: string) {
    return this.svc.adminConversation(id);
  }
}
