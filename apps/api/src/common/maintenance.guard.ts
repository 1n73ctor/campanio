import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { SettingsService } from './settings.service';
import { impersonatorOf, type JwtPayload } from './auth';

/**
 * Still reachable while the site is under maintenance: status and health checks, admin sign-in and the admin panel,
 * images, and payment confirmations — a payment that's already under way must still be recorded, or money is lost.
 */
const ALWAYS_OPEN = [/^\/meta\//, /^\/auth\/admin\//, /^\/admin(\/|$)/, /^\/payments\/webhook\//, /^\/payments\/verify$/, /^\/files\//, /^\/uploads\//];

export const MAINTENANCE_MESSAGE = 'Companio is under maintenance — you can keep browsing, but changes are paused. Please try again in a few minutes.';

/** Reading never changes anything, so the site stays browsable during maintenance. */
const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Maintenance mode (Admin → Dashboard → one click): the site stays browsable (every read works), but anything that
 * changes something — sign-in, bookings, payments, chats, withdrawals, profile edits — gets 503 { maintenance: true },
 * except the always-open routes above and requests from admins (including an admin viewing the site as someone).
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private settings: SettingsService,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http') return true;
    if ((await this.settings.get()).maintenanceMode !== 1) return true;
    const req = ctx.switchToHttp().getRequest<{ method: string; path: string; headers: Record<string, string | undefined> }>();
    if (READS.has(req.method.toUpperCase())) return true;
    if (ALWAYS_OPEN.some((re) => re.test(req.path))) return true;
    if (await this.isAdmin(req.headers.authorization)) return true;
    throw new ServiceUnavailableException({ statusCode: 503, message: MAINTENANCE_MESSAGE, maintenance: true });
  }

  private async isAdmin(header?: string) {
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return false;
    try {
      const p = await this.jwt.verifyAsync<JwtPayload>(token);
      if (p.purpose) return false;
      if (p.imp) return !!(await impersonatorOf(this.prisma, p));
      if (p.role !== 'ADMIN') return false;
      const u = await this.prisma.user.findUnique({ where: { id: p.sub } });
      return !!u && u.role === 'ADMIN' && u.status === 'ACTIVE' && (p.v ?? 0) === u.tokenVersion;
    } catch {
      return false;
    }
  }
}
