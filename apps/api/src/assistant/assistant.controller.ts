import { Body, Controller, Delete, Get, Ip, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { AuthGuard, CurrentUser, OptionalAuthGuard, Roles } from '../common/auth';
import { AssistantService } from './assistant.service';

class ChatDto {
  @IsOptional() @IsString() @MaxLength(64) key?: string;
  @IsString() @Length(1, 1000) message: string;
}
class KeyDto {
  @IsString() @MaxLength(64) key: string;
}
class HumanDto {
  @IsOptional() @IsString() @MaxLength(64) key?: string;
}
class ContactDto extends KeyDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(254) email: string;
}
class ReplyDto {
  @IsString() @Length(1, 2000) text: string;
}
class RateDto extends KeyDto {
  @Type(() => Number) @IsIn([1, -1]) rating: 1 | -1;
}
class ListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @IsIn(['all', 'waiting', 'team', 'handoff', 'liked', 'disliked']) filter?: string;
}
class KnowledgeDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @Length(3, 300) question: string;
  @IsString() @Length(3, 2000) answer: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** The AI support assistant: works signed in (it can look up your own account) or signed out (general help). */
@ApiTags('assistant')
@UseGuards(OptionalAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private svc: AssistantService) {}

  @Get('status') status() {
    return this.svc.status();
  }
  @Post('chat') @Throttle({ default: { limit: 12, ttl: 60_000 } })
  chat(@Body() dto: ChatDto, @Ip() ip: string, @Req() req: { user?: User }) {
    return this.svc.chat({ key: dto.key, message: dto.message, ip }, req.user);
  }
  @Post('history') history(@Body() dto: KeyDto, @Req() req: { user?: User }) {
    return this.svc.history(dto.key, req.user);
  }
  @Post('rate') rate(@Body() dto: RateDto, @Req() req: { user?: User }) {
    return this.svc.rate(dto.key, dto.rating, req.user);
  }
  @Post('contact') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  contact(@Body() dto: ContactDto, @Req() req: { user?: User }) {
    return this.svc.leaveEmail(dto.key, dto.email, req.user);
  }
  @Post('human') @Throttle({ default: { limit: 6, ttl: 60_000 } })
  human(@Body() dto: HumanDto, @Ip() ip: string, @Req() req: { user?: User }) {
    return this.svc.requestHuman(dto.key, req.user, ip);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin/assistant')
export class AdminAssistantController {
  constructor(private svc: AssistantService) {}

  @Get('stats') stats() {
    return this.svc.adminStats();
  }
  @Get('conversations') conversations(@Query() q: ListDto) {
    return this.svc.adminConversations(q);
  }
  @Get('conversations/:id') conversation(@Param('id') id: string) {
    return this.svc.adminConversation(id);
  }
  @Post('conversations/:id/reply') reply(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.svc.adminReply(a, id, dto.text);
  }
  @Post('conversations/:id/close') close(@Param('id') id: string) {
    return this.svc.adminClose(id);
  }
  @Get('knowledge') knowledge() {
    return this.svc.knowledgeList();
  }
  @Post('knowledge') saveKnowledge(@CurrentUser() a: User, @Body() dto: KnowledgeDto) {
    return this.svc.knowledgeSave(a, dto);
  }
  @Delete('knowledge/:id') deleteKnowledge(@Param('id') id: string) {
    return this.svc.knowledgeDelete(id);
  }
}
