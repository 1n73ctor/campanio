import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { CATEGORIES, MAX_BOOKING_HOURS, MIN_BOOKING_HOURS } from '@companio/types';

export class QuoteDto {
  @IsString() companionId: string;
  @Type(() => Number) @IsInt() @Min(MIN_BOOKING_HOURS) @Max(MAX_BOOKING_HOURS) hours: number;
}

export class CreateBookingDto extends QuoteDto {
  @IsIn(CATEGORIES.map((c) => c.slug)) category: string;
  @IsISO8601() startAt: string;
  @IsString() @Length(4, 200) meetingPoint: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ListBookingsDto {
  @IsOptional() @IsIn(['user', 'companion']) as?: 'user' | 'companion';
  @IsOptional() @IsIn(['upcoming', 'past', 'all']) scope?: 'upcoming' | 'past' | 'all';
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class StartDto {
  @IsString() @Matches(/^\d{4}$/) code: string;
}

export class DisputeDto {
  @IsString() @Length(3, 120) reason: string;
  @IsOptional() @IsString() @MaxLength(1500) details?: string;
}

export class ReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(800) comment?: string;
}

export class LocationDto {
  @Type(() => Number) @IsLatitude() lat: number;
  @Type(() => Number) @IsLongitude() lng: number;
}

export class SosDto {
  @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class MessageDto {
  @IsString() @Length(1, 1000) body: string;
}
