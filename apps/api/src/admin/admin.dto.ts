import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, Matches, ValidateNested } from 'class-validator';
import { CATEGORIES, CITIES, DISPUTE_OUTCOMES, GENDERS, LANGUAGES, MODERATION_ACTIONS, USER_STATUSES } from '@companio/types';

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  // % and _ are LIKE wildcards in the database query — search them as plain text
  @IsOptional() @IsString() @MaxLength(80) @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[%_\\]/g, ' ').trim() : value)) q?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() role?: string;
  /** users list only */
  @IsOptional() @IsIn(GENDERS) gender?: string;
  /** users list only: a city slug, or "none" for people who haven't set one */
  @IsOptional() @IsIn([...CITIES.map((c) => c.slug), 'none']) city?: string;
}

export class UserStatusDto {
  @IsIn(USER_STATUSES.filter((s) => s !== 'DELETED')) status: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

/** A message from the team, shown in the person's notifications. */
export class AdminMessageDto {
  @IsString() @Length(3, 80) title: string;
  @IsString() @Length(3, 1000) body: string;
  // only pages on our own site (e.g. /wallet), so a message can never link people off to another website
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^\/(?![\/\\])[\w\-\/?=&#.%]*$/, { message: 'Link must be a page on this site, like /wallet' }) link?: string;
  // also send it by email (default: yes)
  @IsOptional() @IsBoolean() email?: boolean;
}

export const BROADCAST_AUDIENCES = ['ALL', 'MEMBERS', 'HOSTS'] as const;

export class BroadcastAudienceDto {
  @IsIn(BROADCAST_AUDIENCES) audience: (typeof BROADCAST_AUDIENCES)[number];
  @IsOptional() @IsString() @MaxLength(60) city?: string;
}

export class BroadcastDto extends AdminMessageDto {
  @IsIn(BROADCAST_AUDIENCES) audience: (typeof BROADCAST_AUDIENCES)[number];
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  /** the number the admin confirmed — if the audience changed meanwhile, nothing is sent */
  @IsInt() @Min(1) expectedCount: number;
}

export class NoteDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RejectDto {
  @IsString() @Length(3, 500) note: string;
  /** also refund the applicant's companion registration fee to their wallet */
  @IsOptional() @IsBoolean() refundFee?: boolean;
}

export class RefundDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) amount?: number;
  @IsString() @Length(3, 500) note: string;
}

export class ResolveDisputeDto {
  @IsIn(DISPUTE_OUTCOMES) outcome: 'REFUND' | 'RELEASE' | 'SPLIT';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) refundAmount?: number;
  @IsString() @Length(3, 1000) note: string;
}

export class ResolveReportDto {
  @IsIn(MODERATION_ACTIONS) action: 'DISMISS' | 'WARN' | 'SUSPEND' | 'BAN';
  @IsOptional() @IsBoolean() hideMessage?: boolean;
  @IsString() @Length(3, 500) note: string;
}

export class PayoutPaidDto {
  @IsString() @Length(4, 64) reference: string;
}

export class HiddenDto {
  @IsBoolean() hidden: boolean;
}

export class SettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(5000) connectionFee?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(28) gstPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(50) commissionPct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(168) freeCancelHours?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) lateCancelRefundPct?: number;
  @IsOptional() @IsInt() @Min(1) @Max(168) autoReleaseHours?: number;
  @IsOptional() @IsInt() @Min(1) @Max(72) requestExpiryHours?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) minPayout?: number;
  @IsOptional() @IsIn([0, 1]) companionFeeFemaleOn?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) companionFeeFemale?: number;
  @IsOptional() @IsIn([0, 1]) companionFeeMaleOn?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) companionFeeMale?: number;
  @IsOptional() @IsIn([0, 1]) companionFeeNonBinaryOn?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) companionFeeNonBinary?: number;
  @IsOptional() @IsIn([0, 1]) companionFeeUnspecifiedOn?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) companionFeeUnspecified?: number;
  @IsOptional() @IsInt() @Min(0) @Max(5000) welcomeCredit?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(50) cashbackPct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(5000) cashbackMax?: number;
  @IsOptional() @IsIn([0, 1]) kycAutoApprove?: number;
  @IsOptional() @IsIn([0, 1]) chatEnabled?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5000) chatTimedPrice?: number;
  @IsOptional() @IsInt() @Min(1) @Max(720) chatTimedHours?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10000) chatPermanentPrice?: number;
  @IsOptional() @IsInt() @Min(1) @Max(336) chatRefundHours?: number;
  @IsOptional() @IsIn([0, 1]) manualTopup?: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) chatHostSharePct?: number;
  @IsOptional() @IsIn([0, 1]) assistantEnabled?: number;
  @IsOptional() @IsIn([0, 1]) maintenanceMode?: number;
}

/** A host's public profile, as an admin may correct it (same limits as the host's own form). */
export class AdminEditCompanionDto {
  @IsOptional() @IsString() @Length(8, 90) headline?: string;
  @IsOptional() @IsString() @Length(10, 1500) about?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(199) @Max(10000) hourlyRate?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsIn(CATEGORIES.map((c) => c.slug), { each: true }) categories?: string[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @IsIn(LANGUAGES, { each: true }) languages?: string[];
  @IsOptional() @IsIn(CITIES.map((c) => c.slug)) city?: string;
  @IsOptional() @IsBoolean() womenOnly?: boolean;
}

/** An admin correcting someone's profile. Phone number, role and status are changed elsewhere (or not at all). */
export class AdminEditUserDto {
  @IsOptional() @IsString() @Length(2, 60) name?: string;
  /** empty string removes the email */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email?: string;
  /** mark the email as verified (e.g. they confirmed it with support) — otherwise a changed email is sent a new link */
  @IsOptional() @IsBoolean() emailVerified?: boolean;
  @IsOptional() @IsISO8601() dob?: string;
  @IsOptional() @IsIn(GENDERS) gender?: string;
  @IsOptional() @IsIn(CITIES.map((c) => c.slug)) city?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @ValidateNested() @Type(() => AdminEditCompanionDto) companion?: AdminEditCompanionDto;
  /** why — kept in the audit log */
  @IsString() @Length(3, 300) reason: string;
}

/** "Log in as this user" (read-only view) — the reason is kept in the audit log. */
export class ImpersonateDto {
  @IsString() @Length(5, 300) reason: string;
}

export class MaintenanceDto {
  @IsBoolean() on: boolean;
}
