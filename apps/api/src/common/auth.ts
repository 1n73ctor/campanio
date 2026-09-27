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
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest().user;
});

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
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { companion: true } });
    if (!user || user.status === 'DELETED') throw new UnauthorizedException('Account not found');
    if ((payload.v ?? 0) !== user.tokenVersion) throw new UnauthorizedException('You were signed out. Please sign in again.');
    if (user.status === 'BANNED') throw new ForbiddenException('This account has been banned');
    if (user.status === 'SUSPENDED') throw new ForbiddenException(`This account is suspended${user.statusReason ? `: ${user.statusReason}` : ''}`);
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role as Role)) throw new ForbiddenException('Not allowed');
    return true;
  }
}
