import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CATEGORIES, CITIES, LANGUAGES } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  @Get('health')
  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  @Get('catalog')
  catalog() {
    return { categories: CATEGORIES, cities: CITIES, languages: LANGUAGES };
  }

  /** Public pricing rules so clients can explain fees; the actual numbers always come from /bookings/quote. */
  @Get('pricing')
  async pricing() {
    const s = await this.settings.get();
    return {
      connectionFee: s.connectionFee,
      gstPct: s.gstPct,
      freeCancelHours: s.freeCancelHours,
      lateCancelRefundPct: s.lateCancelRefundPct,
    };
  }

  /** Counts per city × category — used by the website to build sitemaps/landing pages. */
  @Get('coverage')
  async coverage() {
    const rows = await this.prisma.companionProfile.findMany({
      where: { isListed: true, kycStatus: 'APPROVED', user: { status: 'ACTIVE' } },
      select: { city: true, categories: true },
    });
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      out[r.city] ??= {};
      for (const c of r.categories.split(',')) out[r.city][c] = (out[r.city][c] ?? 0) + 1;
    }
    return out;
  }
}
