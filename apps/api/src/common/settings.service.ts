import { Global, Injectable, Module } from '@nestjs/common';
import type { PlatformSettings } from '@companio/types';
import { PrismaService } from './prisma.service';

export const DEFAULT_SETTINGS: PlatformSettings = {
  connectionFee: 99,
  gstPct: 18,
  commissionPct: 15,
  freeCancelHours: 24,
  lateCancelRefundPct: 50,
  autoReleaseHours: 24,
  requestExpiryHours: 12,
  minPayout: 500,
  // companion registration fee: off for everyone until an admin enables it (amounts before GST)
  companionFeeFemaleOn: 0,
  companionFeeFemale: 0,
  companionFeeMaleOn: 0,
  companionFeeMale: 0,
  companionFeeNonBinaryOn: 0,
  companionFeeNonBinary: 0,
  companionFeeUnspecifiedOn: 0,
  companionFeeUnspecified: 0,
  // member offers: off until an admin sets them
  welcomeCredit: 0,
  cashbackPct: 0,
  cashbackMax: 200,
  // companion verification: an admin reviews every submission until this is switched on
  kycAutoApprove: 0,
};

/** Platform business rules live here (and only here). Admins can edit them from the panel. */
@Injectable()
export class SettingsService {
  private cache: PlatformSettings | null = null;
  constructor(private prisma: PrismaService) {}

  async get(): Promise<PlatformSettings> {
    if (this.cache) return this.cache;
    const rows = await this.prisma.setting.findMany();
    const merged = { ...DEFAULT_SETTINGS } as Record<string, number>;
    for (const r of rows) if (r.key in merged) merged[r.key] = Number(r.value);
    this.cache = merged as unknown as PlatformSettings;
    return this.cache;
  }

  async update(patch: Partial<PlatformSettings>) {
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in DEFAULT_SETTINGS) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
      await this.prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
    }
    this.cache = null;
    return this.get();
  }

  /** Price breakdown for a booking. Single source of truth for pricing. */
  async quote(hourlyRate: number, hours: number) {
    const s = await this.get();
    const subtotal = hourlyRate * hours;
    const connectionFee = s.connectionFee;
    // GST on the whole booking: the companion's fee plus the connection fee
    const gst = Math.round(((subtotal + connectionFee) * s.gstPct) / 100);
    const commission = Math.round((subtotal * s.commissionPct) / 100);
    return {
      hourlyRate,
      hours,
      subtotal,
      connectionFee,
      gst,
      total: subtotal + connectionFee + gst,
      commission,
      companionPayout: subtotal - commission,
    };
  }
}

@Global()
@Module({ providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
