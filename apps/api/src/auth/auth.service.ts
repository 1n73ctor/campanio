import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { AuthResponse, OtpRequestResponse } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { config } from '../common/config';
import { toUserDto } from '../common/mappers';
import { SmsService } from './sms.service';
import { ReferralsService } from '../referrals/referrals.service';
import { verifyFirebasePhoneToken } from './firebase';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;

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
    const otp = await this.prisma.otpCode.findFirst({ where: { phone, usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date()) throw new BadRequestException('Code expired. Request a new one.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new BadRequestException('Too many attempts. Request a new code.');
    if (otp.codeHash !== this.hash(phone, code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Incorrect code');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
    return this.signInPhone(phone, ref);
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
      user = await this.prisma.user.create({ data: { phone, wallet: { create: {} } }, include: { companion: true } });
      if (ref) await this.referrals.attach(user.id, ref);
    }
    if (user.status === 'BANNED') throw new ForbiddenException('This account has been banned');
    if (user.role === 'ADMIN') throw new ForbiddenException('Admins sign in through the admin panel');
    return { token: await this.sign(user.id, user.role), user: toUserDto(user), isNew };
  }

  async adminLogin(email: string, password: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { companion: true } });
    if (!user || user.role !== 'ADMIN' || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Account disabled');
    return { token: await this.sign(user.id, user.role), user: toUserDto(user), isNew: false };
  }

  private sign(sub: string, role: string) {
    return this.jwt.signAsync({ sub, role }, { expiresIn: role === 'ADMIN' ? '12h' : '30d' });
  }
}
