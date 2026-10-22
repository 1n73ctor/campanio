import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { createHmac, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { AuthResponse, OtpRequestResponse } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { config } from '../common/config';
import { toUserDto } from '../common/mappers';
import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';
import { ReferralsService } from '../referrals/referrals.service';
import { verifyFirebasePhoneToken } from './firebase';
import { newTotpSecret, otpauthUrl, verifyTotp } from './totp';
import { decryptDoc, encryptDoc } from '../files/uploads';
import * as QRCode from 'qrcode';
import { AuditService } from '../common/audit.service';
import { MailService } from '../mail/mail.service';
import { notificationEmail } from '../mail/templates';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;
const DELETE_PURPOSE = 'account-delete';
const ADMIN_MAX_FAILS = 5;
const ADMIN_LOCK_MS = 15 * 60_000;

export const normalizePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  return `+91${digits.slice(-10)}`;
};

@Injectable()
export class AuthService {
  private log = new Logger('Auth');
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private sms: SmsService,
    private wa: WhatsAppService,
    private referrals: ReferralsService,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  private hash(phone: string, code: string) {
    return createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex');
  }

  /**
   * Sends a login code: on WhatsApp when it's set up (and `channel` isn't "sms"), otherwise by our SMS provider.
   * In production without either, returns { sent: false } and the website uses Firebase SMS instead — codes are never
   * only written to the server log there, where anyone with log access could use them.
   */
  async requestOtp(rawPhone: string, channel: 'whatsapp' | 'sms' = 'whatsapp'): Promise<OtpRequestResponse> {
    const viaWhatsApp = channel === 'whatsapp' && this.wa.enabled;
    if (!viaWhatsApp && process.env.NODE_ENV === 'production' && config.smsProvider === 'console') return { sent: false };
    const phone = normalizePhone(rawPhone);
    const recent = await this.prisma.otpCode.count({ where: { phone, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recent >= OTP_MAX_PER_HOUR) throw new HttpException('Too many codes requested. Try again in an hour.', HttpStatus.TOO_MANY_REQUESTS);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const row = await this.prisma.otpCode.create({
      data: { phone, codeHash: this.hash(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), channel: viaWhatsApp ? 'whatsapp' : 'sms' },
    });
    if (viaWhatsApp) {
      try {
        const id = await this.wa.sendOtp(phone, code);
        await this.prisma.otpCode.update({ where: { id: row.id }, data: { waMessageId: id, waStatus: 'accepted' } });
      } catch {
        // not sent (e.g. Meta refused it): don't count it, and let the website send an SMS instead
        await this.prisma.otpCode.delete({ where: { id: row.id } });
        if (process.env.NODE_ENV === 'production' && config.smsProvider === 'console') return { sent: false };
        return this.requestOtp(rawPhone, 'sms');
      }
      return config.otpDevEcho ? { sent: true, channel: 'whatsapp', devCode: code } : { sent: true, channel: 'whatsapp' };
    }
    await this.sms.send(phone, `${code} is your Companio code. It expires in 5 minutes. Never share it.`);
    return config.otpDevEcho ? { sent: true, channel: 'sms', devCode: code } : { sent: true, channel: 'sms' };
  }

  /**
   * Whether the latest WhatsApp code to this number arrived (from Meta's delivery receipts), so the login page can
   * switch to SMS when it failed — e.g. the number isn't on WhatsApp.
   */
  async otpStatus(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    const otp = await this.prisma.otpCode.findFirst({ where: { phone, usedAt: null, createdAt: { gte: new Date(Date.now() - OTP_TTL_MS) } }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.channel !== 'whatsapp') return { status: 'unknown' as const };
    return { status: (otp.waStatus === 'failed' ? 'failed' : otp.waStatus === 'delivered' || otp.waStatus === 'read' ? 'delivered' : 'sent') as 'failed' | 'delivered' | 'sent' };
  }

  async verifyOtp(rawPhone: string, code: string, ref?: string): Promise<AuthResponse> {
    const phone = normalizePhone(rawPhone);
    await this.consumeOtp(phone, code);
    return this.signInPhone(phone, ref);
  }

  /** Checks and uses up the latest code sent to this phone (expiry + attempt limits). */
  private async consumeOtp(phone: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({ where: { phone, usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date()) throw new BadRequestException('Code expired. Request a new one.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new BadRequestException('Too many attempts. Request a new code.');
    if (otp.codeHash !== this.hash(phone, code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Incorrect code');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  }

  /**
   * Re-confirms the signed-in user's phone before a sensitive action (account deletion): either a fresh code from
   * our own OTP flow or a fresh Firebase phone sign-in. Returns a 10-minute token for that one action.
   */
  async confirmPhoneForDeletion(user: User, proof: { code?: string; idToken?: string }) {
    if (!user.phone) throw new BadRequestException('This account has no phone number to confirm');
    if (proof.idToken) {
      if (!config.firebaseProjectId) throw new ServiceUnavailableException('Phone confirmation via Firebase is not configured');
      let phone: string;
      try {
        ({ phone } = await verifyFirebasePhoneToken(proof.idToken, config.firebaseProjectId));
      } catch (e) {
        this.log.warn(`deletion confirmation token rejected: ${(e as Error).message}`);
        throw new UnauthorizedException('Couldn’t confirm your phone number. Request a new code.');
      }
      if (normalizePhone(phone) !== user.phone) throw new ForbiddenException('That code was for a different phone number');
    } else if (proof.code) {
      await this.consumeOtp(user.phone, proof.code);
    } else {
      throw new BadRequestException('Enter the code we sent to your phone');
    }
    return { deleteToken: await this.jwt.signAsync({ sub: user.id, purpose: DELETE_PURPOSE }, { expiresIn: '10m' }) };
  }

  /** The user id a deletion token was issued for, or throws. */
  async checkDeletionToken(user: User, token: string) {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; purpose?: string }>(token);
      if (p.purpose === DELETE_PURPOSE && p.sub === user.id) return;
    } catch {
      // fall through
    }
    throw new ForbiddenException('Your confirmation expired. Please confirm your phone number again.');
  }

  /** Phone sign-in where Firebase sent and checked the SMS code; we verify Firebase's signed token instead. */
  async firebaseLogin(idToken: string, ref?: string): Promise<AuthResponse> {
    if (!config.firebaseProjectId) throw new ServiceUnavailableException('Phone sign-in via Firebase is not configured');
    let phone: string;
    try {
      ({ phone } = await verifyFirebasePhoneToken(idToken, config.firebaseProjectId));
    } catch (e) {
      this.log.warn(`Firebase token rejected: ${(e as Error).message}`);
      throw new UnauthorizedException('Couldn’t verify your phone number. Please request a new code.');
    }
    return this.signInPhone(normalizePhone(phone), ref);
  }

  /** Shared by both sign-in methods: find or create the account (applying an invite code only to new ones). */
  private async signInPhone(phone: string, ref?: string): Promise<AuthResponse> {
    let user = await this.prisma.user.findUnique({ where: { phone }, include: { companion: true } });
    const isNew = !user;
    if (!user) {
      // a number whose deleted account was banned can't come back as a fresh account
      const bannedBefore = await this.prisma.user.count({ where: { deletedPhone: phone, status: 'BANNED' } });
      if (bannedBefore) throw new ForbiddenException('This phone number can’t be used on Companio. Contact support if you think this is a mistake.');
      user = await this.prisma.user.create({ data: { phone, wallet: { create: {} } }, include: { companion: true } });
      if (ref) await this.referrals.attach(user.id, ref);
    }
    if (user.status === 'BANNED') throw new ForbiddenException('This account has been banned');
    if (user.role === 'ADMIN') throw new ForbiddenException('Admins sign in through the admin panel');
    return { token: await this.sign(user), user: toUserDto(user), isNew };
  }

  /**
   * Admin sign-in: password (bcrypt), then the authenticator code if 2FA is on. 5 wrong passwords lock the account
   * for 15 minutes; codes are single-use. Errors never reveal whether an email exists.
   */
  async adminLogin(email: string, password: string, code?: string): Promise<AuthResponse | { twoFactorRequired: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { companion: true } });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(`Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const ok = !!user && user.role === 'ADMIN' && !!user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) {
      if (user) {
        const failed = user.failedLogins + 1;
        const lock = failed >= ADMIN_MAX_FAILS;
        await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + ADMIN_LOCK_MS) : null } });
        if (lock) this.log.warn(`admin sign-in locked for ${email} after ${ADMIN_MAX_FAILS} wrong passwords`);
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Account disabled');

    if (user.totpEnabledAt && user.totpSecret) {
      if (!code) return { twoFactorRequired: true };
      const step = verifyTotp(this.totpSecretOf(user.totpSecret), code);
      if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep)) {
        const failed = user.failedLogins + 1;
        const lock = failed >= ADMIN_MAX_FAILS;
        await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + ADMIN_LOCK_MS) : null } });
        throw new UnauthorizedException('Invalid or already-used authenticator code');
      }
      await this.prisma.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    return { token: await this.sign(user), user: toUserDto(user), isNew: false };
  }

  // ---------- admin two-factor (authenticator app) ----------
  private totpSecretOf(stored: string) {
    return decryptDoc(Buffer.from(stored, 'base64')).toString('utf8');
  }

  async twoFactorStatus(admin: User) {
    return { enabled: !!admin.totpEnabledAt };
  }

  /** Starts setup: a new secret (not active until confirmed with a code). */
  async twoFactorSetup(admin: User) {
    if (admin.totpEnabledAt) throw new BadRequestException('Two-factor sign-in is already on');
    const secret = newTotpSecret();
    await this.prisma.user.update({ where: { id: admin.id }, data: { totpSecret: encryptDoc(Buffer.from(secret)).toString('base64'), totpLastStep: null } });
    const url = otpauthUrl(secret, admin.email ?? admin.id);
    return { secret, otpauthUrl: url, qrSvg: await QRCode.toString(url, { type: 'svg', margin: 1 }) };
  }

  async twoFactorEnable(admin: User, code: string) {
    if (!admin.totpSecret || admin.totpEnabledAt) throw new BadRequestException('Start two-factor setup first');
    const step = verifyTotp(this.totpSecretOf(admin.totpSecret), code);
    if (step === null) throw new BadRequestException('That code didn’t match — check the time on your phone and try again');
    await this.prisma.user.update({ where: { id: admin.id }, data: { totpEnabledAt: new Date(), totpLastStep: step } });
    return { enabled: true };
  }

  async twoFactorDisable(admin: User, code: string) {
    if (!admin.totpSecret || !admin.totpEnabledAt) throw new BadRequestException('Two-factor sign-in is not on');
    const step = verifyTotp(this.totpSecretOf(admin.totpSecret), code);
    if (step === null || (admin.totpLastStep !== null && step <= admin.totpLastStep)) throw new BadRequestException('Invalid or already-used code');
    await this.prisma.user.update({ where: { id: admin.id }, data: { totpEnabledAt: null, totpSecret: null, totpLastStep: null } });
    return { enabled: false };
  }

  /**
   * "Log in as" for admins: a 30-minute, read-only session as this user (the API refuses anything but viewing), tied to
   * the admin's own session so signing the admin out — or removing their admin rights — ends it too.
   */
  async impersonationToken(admin: Pick<User, 'id' | 'tokenVersion'>, target: Pick<User, 'id' | 'role' | 'tokenVersion'>) {
    const minutes = 30;
    const token = await this.jwt.signAsync({ sub: target.id, role: target.role, v: target.tokenVersion, imp: admin.id, iv: admin.tokenVersion }, { expiresIn: `${minutes}m` });
    return { token, expiresAt: new Date(Date.now() + minutes * 60_000).toISOString() };
  }

  // ---------- admin's own account ----------

  private async checkAdminPassword(admin: User, password: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    if (!u.passwordHash || !(await bcrypt.compare(password ?? '', u.passwordHash))) throw new BadRequestException('Your current password is incorrect');
    return u;
  }

  /** Name and sign-in email. Changing the email needs the current password (it's how you sign in). */
  async adminUpdateProfile(admin: User, input: { name?: string; email?: string; currentPassword?: string }) {
    const data: { name?: string; email?: string } = {};
    if (input.name !== undefined && input.name.trim() !== (admin.name ?? '')) data.name = input.name.trim();
    const email = input.email?.trim().toLowerCase();
    if (email && email !== admin.email) {
      await this.checkAdminPassword(admin, input.currentPassword ?? '');
      if (await this.prisma.user.findFirst({ where: { email, id: { not: admin.id } } })) throw new BadRequestException('That email is already used by another account');
      data.email = email;
    }
    if (!Object.keys(data).length) throw new BadRequestException('Nothing changed');
    const u = await this.prisma.user.update({ where: { id: admin.id }, data, include: { companion: true } });
    await this.audit.log(admin.id, 'admin.profile', 'user', admin.id, { name: data.name ? { from: admin.name, to: data.name } : undefined, email: data.email ? { from: admin.email, to: data.email } : undefined });
    if (data.email && admin.email) {
      // tell the old address, so a takeover can't go unnoticed
      void this.mail.send(admin.email, notificationEmail({ firstName: admin.name?.split(' ')[0] ?? 'there', title: 'Your Companio admin email was changed', body: `The sign-in email for your admin account was changed to ${data.email}. If this wasn't you, contact the other admins immediately.`, siteUrl: config.webUrl }));
    }
    return toUserDto(u);
  }

  /**
   * New password (12+ characters). Signs out every other device using this account (their tokens stop working) and
   * returns a fresh token for this one.
   */
  async adminChangePassword(admin: User, currentPassword: string, newPassword: string) {
    const u = await this.checkAdminPassword(admin, currentPassword);
    if (newPassword.length < 12) throw new BadRequestException('Use at least 12 characters');
    if (newPassword === currentPassword) throw new BadRequestException('The new password must be different from the current one');
    if (u.email && newPassword.toLowerCase().includes(u.email.split('@')[0].toLowerCase())) throw new BadRequestException('Don’t use your email name in your password');
    const updated = await this.prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null },
      include: { companion: true },
    });
    await this.audit.log(admin.id, 'admin.password', 'user', admin.id, {});
    if (u.email)
      void this.mail.send(u.email, notificationEmail({ firstName: u.name?.split(' ')[0] ?? 'there', title: 'Your Companio admin password was changed', body: "Your admin password was just changed and other devices were signed out. If this wasn't you, reset it right away and contact the other admins.", siteUrl: config.webUrl }));
    return { token: await this.sign(updated), user: toUserDto(updated) };
  }

  /** A fresh session token for this user (current session version). */
  sign(user: Pick<User, 'id' | 'role' | 'tokenVersion'>) {
    return this.signRaw(user.id, user.role, user.tokenVersion);
  }

  private signRaw(sub: string, role: string, v: number) {
    return this.jwt.signAsync({ sub, role, v }, { expiresIn: role === 'ADMIN' ? '12h' : '14d' });
  }
}
