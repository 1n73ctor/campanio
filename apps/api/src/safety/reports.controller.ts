import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_REASONS } from '@companio/types';
import { AuthGuard, CurrentUser } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

class CreateReportDto {
  @IsString() targetUserId: string;
  @IsOptional() @IsString() bookingId?: string;
  @IsOptional() @IsString() messageId?: string;
  @IsIn(REPORT_REASONS) reason: string;
  @IsOptional() @IsString() @MaxLength(1500) details?: string;
}

@ApiTags('safety')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private prisma: PrismaService,
    private rt: RealtimeService,
  ) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    if (dto.targetUserId === user.id) throw new BadRequestException("You can't report yourself");
    await this.prisma.user.findUniqueOrThrow({ where: { id: dto.targetUserId } });
    if (dto.messageId) {
      const m = await this.prisma.message.findUnique({ where: { id: dto.messageId }, include: { booking: true } });
      if (!m || (m.booking.userId !== user.id && m.booking.companionUserId !== user.id)) throw new BadRequestException('Message not found');
    }
    const r = await this.prisma.report.create({
      data: { reporterId: user.id, targetUserId: dto.targetUserId, bookingId: dto.bookingId, messageId: dto.messageId, reason: dto.reason, details: dto.details },
    });
    this.rt.toAdmins('report:new', { id: r.id });
    return { id: r.id, status: r.status, message: 'Thanks — our trust & safety team reviews every report, usually within a few hours.' };
  }
}
