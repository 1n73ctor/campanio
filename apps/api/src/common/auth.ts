import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { Role } from '@companio/types';
import { PrismaService } from './prisma.service';

export interface JwtPayload {
  sub: string;
  role: Role;
  /** session version — must match User.tokenVersion (bumped by "log out of all other devices") */
  v?: number;
  /** "log in as this user" by an admin: that admin's id, and their own session version when it was issued */
  imp?: string;
  iv?: number;
  /** "full": the admin may make changes as this user (audited); otherwise view-as is read-only */
  ia?: 'full';
  /** single-purpose tokens (e.g. account deletion) — never a sign-in */
  purpose?: string;
}

/** Requests an admin may make while viewing the site as someone else: looking only, never changing anything. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Never allowed when an admin is logged in as someone: anything that moves their money. Everything else is allowed (and audited). */
const FULL_ACCESS_BLOCKED: [RegExp, string][] = [
  [/^\/payments(\/|$)/, 'Payments can’t be made while logged in as someone else'],
  [/^\/wallet\/payouts/, 'Withdrawals can’t be requested while logged in as someone else'],
  [/^\/chats\/unlock/, 'Their coins can’t be spent while logged in as someone else'],
  [/^\/auth\//, 'Not allowed while logged in as someone else'],
];

/**
 * The admin behind a "log in as" token, if it's still allowed: still an active admin, and hasn't signed out
 * everywhere since (so disabling or signing out the admin also ends every session they opened as someone else).
 */
export async function impersonatorOf(prisma: PrismaService, payload: JwtPayload): Promise<User | null> {
  if (!payload.imp) return null;
  const admin = await prisma.user.findUnique({ where: { id: payload.imp } });
  if (!admin || admin.role !== 'ADMIN' || admin.status !== 'ACTIVE' || (payload.iv ?? 0) !== admin.tokenVersion) {
    throw new UnauthorizedException('This view-as-user session has ended');
  }
  return admin;
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest().user;
});

/** The admin viewing the site as this user ("log in as"), or undefined for a normal session. */
export const Impersonator = createParamDecorator((_: unknown, ctx: ExecutionContext): User | undefined => {
  return ctx.switchToHttp().getRequest().impersonator;
});

/** Same checks as AuthGuard when a token is sent, but signed-out requests are let through (req.user stays empty). */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (!req.headers.authorization) return true;
    return new AuthGuard(this.jwt, this.prisma, this.reflector).canActivate(ctx);
  }
}

/** Verifies the bearer token, loads the user, blocks suspended/banned/deleted accounts and enforces @Roles(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Sign in required');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired, please sign in again');
    }
    if (payload.purpose) throw new UnauthorizedException('Sign in required');
    const impersonator = await impersonatorOf(this.prisma, payload);
    if (impersonator) {
      if (payload.role === 'ADMIN') throw new ForbiddenException('Not allowed');
      const method = String(req.method).toUpperCase();
      if (!READ_ONLY_METHODS.has(method)) {
        if (payload.ia !== 'full') throw new ForbiddenException('You’re viewing as this user (read-only) — changes are blocked. Use the admin panel to make changes.');
        const path = String(req.originalUrl ?? req.url ?? '').split('?')[0];
        const blocked = FULL_ACCESS_BLOCKED.find(([re]) => re.test(path));
        if (blocked) throw new ForbiddenException(blocked[1]);
        // every change made as someone else is on record: which admin, whose account, what
        await this.prisma.auditLog.create({ data: { adminId: impersonator.id, action: 'user.impersonate.action', targetType: 'user', targetId: payload.sub, meta: JSON.stringify({ method, path }) } });
      }
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { companion: true } });
    if (!user || user.status === 'DELETED') throw new UnauthorizedException('Account not found');
    if ((payload.v ?? 0) !== user.tokenVersion) throw new UnauthorizedException('You were signed out. Please sign in again.');
    if (user.status === 'BANNED') throw new ForbiddenException('This account has been banned');
    if (user.status === 'SUSPENDED') throw new ForbiddenException(`This account is suspended${user.statusReason ? `: ${user.statusReason}` : ''}`);
    req.user = user;
    req.impersonator = impersonator ?? undefined;
    // view-as never reaches an admin account, even if the person became an admin after the link was made
    if (impersonator && user.role === 'ADMIN') throw new ForbiddenException('Not allowed');

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role as Role)) throw new ForbiddenException('Not allowed');
    return true;
  }
}
