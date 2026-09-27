import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { ageFromDob, MIN_AGE } from '@companio/types';
import { AuthGuard, CurrentUser } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { toUserDto } from '../common/mappers';
import { publicImageUpload, publicUrl } from '../files/uploads';
import { UpdateMeDto } from './users.dto';

const ACTIVE_BOOKING = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED'];

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: User) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { companion: true } });
    return toUserDto(u);
  }

  /** Profile edit + onboarding. Onboarding requires name, DOB (18+), city and accepting the platonic-only guidelines. */
  @Patch()
  async update(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    if (dto.dob) {
      const age = ageFromDob(dto.dob);
      if (age === null || age < MIN_AGE) throw new BadRequestException(`You must be ${MIN_AGE}+ to use Companio`);
      if (user.dob && user.onboarded && new Date(dto.dob).getTime() !== user.dob.getTime()) {
        throw new BadRequestException('Date of birth cannot be changed after onboarding. Contact support.');
      }
    }
    // the companion registration fee depends on gender, so it's fixed once set (like DOB)
    if (dto.gender && user.onboarded && user.gender && dto.gender !== user.gender) {
      throw new BadRequestException('Gender cannot be changed after onboarding. Contact support.');
    }
    const next = {
      name: dto.name ?? user.name,
      dob: dto.dob ? new Date(dto.dob) : user.dob,
      city: dto.city ?? user.city,
      guidelinesAccepted: dto.acceptGuidelines ? new Date() : user.guidelinesAccepted,
    };
    const onboarded = !!(next.name && next.dob && next.city && next.guidelinesAccepted);
    const u = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        gender: dto.gender,
        city: dto.city,
        bio: dto.bio,
        guidelinesAccepted: dto.acceptGuidelines ? next.guidelinesAccepted : undefined,
        onboarded,
      },
      include: { companion: true },
    });
    return toUserDto(u);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', publicImageUpload))
  async avatar(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const u = await this.prisma.user.update({ where: { id: user.id }, data: { avatarUrl: publicUrl(file.filename) }, include: { companion: true } });
    return toUserDto(u);
  }

  /** In-app account deletion (required by both app stores). Anonymises PII, keeps financial records. */
  @Delete()
  async remove(@CurrentUser() user: User) {
    const active = await this.prisma.booking.count({
      where: { OR: [{ userId: user.id }, { companionUserId: user.id }], status: { in: ACTIVE_BOOKING } },
    });
    if (active) throw new BadRequestException('Finish or cancel your active bookings before deleting your account');
    await this.prisma.$transaction([
      this.prisma.companionProfile.updateMany({ where: { userId: user.id }, data: { isListed: false, about: '', headline: 'Deleted', photos: '[]' } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'DELETED', deletedAt: new Date(), phone: null, email: null, name: 'Deleted user', bio: null, avatarUrl: null, dob: null },
      }),
    ]);
    return { deleted: true };
  }

  // ---- blocks ----
  @Get('blocks')
  async blocks(@CurrentUser() user: User) {
    const rows = await this.prisma.block.findMany({ where: { blockerId: user.id }, include: { blocked: true }, orderBy: { createdAt: 'desc' } });
    return rows.map((b) => ({ userId: b.blockedId, name: b.blocked.name, avatarUrl: b.blocked.avatarUrl, createdAt: b.createdAt.toISOString() }));
  }

  @Post('blocks/:userId')
  async block(@CurrentUser() user: User, @Param('userId') userId: string) {
    if (userId === user.id) throw new BadRequestException("You can't block yourself");
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
      create: { blockerId: user.id, blockedId: userId },
      update: {},
    });
    return { blocked: true };
  }

  @Delete('blocks/:userId')
  async unblock(@CurrentUser() user: User, @Param('userId') userId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: userId } });
    return { blocked: false };
  }
}
