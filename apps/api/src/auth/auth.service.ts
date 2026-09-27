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
import { ReferralsService } from '../referrals/referrals.service';
import { verifyFirebasePhoneToken } from './firebase';
import { newTotpSecret, otpauthUrl, verifyTotp } from './totp';
import { decryptDoc, encryptDoc } from '../files/uploads';
import * as QRCode from 'qrcode';

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
    private referrals: ReferralsService,
  ) {}

  private hash(phone: string, code: string) {
    return createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex');
  }

  async requestOtp(rawPhone: string): Promise<OtpRequestResponse> {
    // In production without a real SMS provider these codes would only be written to the server log, where anyone
    // with log access could use them — so the endpoint is off there (Firebase handles phone sign-in instead).
    if (process.env.NODE_ENV === 'production' && config.smsProvider === 'console') {
      throw new ServiceUnavailableException('Phone codes are sent through Firebase sign-in');
    }
    const phone = normalizePhone(rawPhone);
    const recent = await this.prisma.otpCode.count({ where: { phone, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recent >= OTP_MAX_PER_HOUR) throw new HttpException('Too many codes requested. Try again in an hour.', HttpStatus.TOO_MANY_REQUESTS);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCode.create({ data: { phone, codeHash: this.hash(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    await this.sms.send(phone, `${code} is your Companio code. It expires in 5 minutes. Never share it.`);
    return config.otpDevEcho ? { sent: true, devCode: code } : { sent: true };
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

  /** A fresh session token for this user (current session version). */
  sign(user: Pick<User, 'id' | 'role' | 'tokenVersion'>) {
    return this.signRaw(user.id, user.role, user.tokenVersion);
  }

  private signRaw(sub: string, role: string, v: number) {
    return this.jwt.signAsync({ sub, role, v }, { expiresIn: role === 'ADMIN' ? '12h' : '14d' });
  }
}
