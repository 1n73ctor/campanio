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
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../common/settings.service';
import { ensureBlurred, publicUrl, storePublicImage, uploadLimits } from '../files/uploads';
import { UpdateMeDto } from './users.dto';
import { OffersService } from '../offers/offers.service';
import { AuthService } from '../auth/auth.service';
import { IsOptional, IsString, Length } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { readEmailVerifyToken } from '../mail/email-verify';

class ConfirmDeleteDto {
  /** code from our own OTP flow (local/dev) … */
  @IsOptional() @IsString() @Length(6, 6) code?: string;
  /** … or a fresh Firebase phone sign-in token (production) */
  @IsOptional() @IsString() @Length(20, 4096) idToken?: string;
}
class VerifyEmailDto {
  @IsString() @Length(20, 1024) token: string;
}
class DeleteDto {
  @IsString() @Length(20, 2048) deleteToken: string;
}

const ACTIVE_BOOKING = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED'];

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private offers: OffersService,
    private auth: AuthService,
    private mail: MailService,
    private settings: SettingsService,
  ) {}

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
    // new sign-ups give an email to finish; people who joined before it was asked for aren't pushed back to onboarding
    if (!user.onboarded && onboarded && !(dto.email ?? user.contactEmail)) throw new BadRequestException('Add your email address to continue');
    // a new address has to be confirmed again before we email it
    const emailChanged = !!dto.email && dto.email.toLowerCase() !== (user.contactEmail ?? '').toLowerCase();
    const u = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name,
        contactEmail: dto.email,
        ...(emailChanged ? { contactEmailVerifiedAt: null } : {}),
        dob: dto.dob ? new Date(dto.dob) : undefined,
        gender: dto.gender,
        city: dto.city,
        bio: dto.bio,
        guidelinesAccepted: dto.acceptGuidelines ? next.guidelinesAccepted : undefined,
        onboarded,
      },
      include: { companion: true },
    });
    if (!user.onboarded && u.onboarded) {
      // first time onboarding completes
      await this.offers.grantWelcomeCredit(u.id);
      if (u.contactEmail) {
        const { welcomeCredit } = await this.settings.get();
        void this.mail.sendWelcome(u, welcomeCredit); // carries the confirm-email link; in the background: never slows sign-up
      }
    } else if (emailChanged && u.onboarded) void this.mail.sendVerification(u);
    return toUserDto(u);
  }

  /** "Resend the confirmation link" for the contact email. */
  @Post('email/resend')
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  async resendVerification(@CurrentUser() user: User) {
    if (!user.contactEmail) throw new BadRequestException('Add your email address first');
    if (user.contactEmailVerifiedAt) return { sent: false, verified: true };
    if (!(await this.mail.sendVerification(user))) throw new BadRequestException('Couldn’t send the email right now — please try again in a few minutes');
    return { sent: true, verified: false };
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', uploadLimits))
  async avatar(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const u = await this.prisma.user.update({ where: { id: user.id }, data: { avatarUrl: publicUrl(await storePublicImage(file, 800)), avatarAuto: false }, include: { companion: true } });
    if (u.companion?.premium) await ensureBlurred(u.avatarUrl);
    return toUserDto(u);
  }

  /** In-app account deletion (required by both app stores). Anonymises PII, keeps financial records. */
  /** Signs out every other device: older session tokens stop working. Returns a fresh token for this device. */
  @Post('logout-others')
  async logoutOthers(@CurrentUser() user: User) {
    const u = await this.prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
    return { token: await this.auth.sign(u) };
  }

  /** Account deletion, step 1: re-confirm the phone number (a fresh login code). Returns a 10-minute deletion token. */
  @Post('delete/confirm')
  async confirmDelete(@CurrentUser() user: User, @Body() dto: ConfirmDeleteDto) {
    await this.assertNoActiveBookings(user.id);
    return this.auth.confirmPhoneForDeletion(user, dto);
  }

  /**
   * Account deletion, step 2 (after the user's final "yes"). The account disappears from everything public and can't
   * sign in, but the record — name, phone, bookings, reports, verification — stays visible to admins for safety.
   * The phone number is freed so the person can sign up again later as a new account.
   */
  @Post('delete')
  async remove(@CurrentUser() user: User, @Body() dto: DeleteDto) {
    await this.auth.checkDeletionToken(user, dto.deleteToken);
    await this.assertNoActiveBookings(user.id);
    await this.prisma.$transaction([
      this.prisma.companionProfile.updateMany({ where: { userId: user.id }, data: { isListed: false } }),
      this.prisma.user.update({ where: { id: user.id }, data: { status: 'DELETED', deletedAt: new Date(), deletedPhone: user.phone, phone: null, tokenVersion: { increment: 1 } } }),
      // a verification waiting for review has nothing left to review
      this.prisma.kycSubmission.updateMany({ where: { userId: user.id, status: 'PENDING' }, data: { status: 'REJECTED', reviewNote: 'Account deleted by the user', reviewedAt: new Date() } }),
      this.prisma.companionProfile.updateMany({ where: { userId: user.id, kycStatus: 'PENDING' }, data: { kycStatus: 'REJECTED' } }),
    ]);
    return { deleted: true };
  }

  private async assertNoActiveBookings(userId: string) {
    const active = await this.prisma.booking.count({
      where: { OR: [{ userId }, { companionUserId: userId }], status: { in: ACTIVE_BOOKING } },
    });
    if (active) throw new BadRequestException('Finish or cancel your active meetups before deleting your account');
  }

  // ---- blocks ----
  @Get('blocks')
  async blocks(@CurrentUser() user: User) {
    const rows = await this.prisma.block.findMany({ where: { blockerId: user.id }, include: { blocked: true }, orderBy: { createdAt: 'desc' } });
    const gone = (u: User) => u.status === 'DELETED';
    return rows.map((b) => ({ userId: b.blockedId, name: gone(b.blocked) ? 'Deleted user' : b.blocked.name, avatarUrl: gone(b.blocked) ? null : b.blocked.avatarUrl, createdAt: b.createdAt.toISOString() }));
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

/** Opening the link from "Confirm your email" (no sign-in needed: the signed token is the proof). */
@ApiTags('me')
@Controller('email')
export class EmailVerifyController {
  constructor(private prisma: PrismaService) {}

  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(@Body() dto: VerifyEmailDto) {
    const t = readEmailVerifyToken(dto.token);
    if (!t) throw new BadRequestException('This link is invalid or has expired — open your profile and tap “Verify email”.');
    const u = await this.prisma.user.findUnique({ where: { id: t.userId } });
    // the address may have changed since the email was sent: only the current one can be confirmed
    if (!u || u.status === 'DELETED' || (u.contactEmail ?? '').toLowerCase() !== t.email)
      throw new BadRequestException('This link is for an email address that’s no longer on your account — open your profile and tap “Verify email”.');
    if (!u.contactEmailVerifiedAt) await this.prisma.user.update({ where: { id: u.id }, data: { contactEmailVerifiedAt: new Date() } });
    return { verified: true, email: u.contactEmail };
  }
}
