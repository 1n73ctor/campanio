import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { DISPUTE_OUTCOMES, MODERATION_ACTIONS, USER_STATUSES } from '@companio/types';

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() role?: string;
}

export class UserStatusDto {
  @IsIn(USER_STATUSES.filter((s) => s !== 'DELETED')) status: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class NoteDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RejectDto {
  @IsString() @Length(3, 500) note: string;
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
}
