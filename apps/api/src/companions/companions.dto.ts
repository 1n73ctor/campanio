import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CATEGORIES, CITIES, GENDERS, ID_TYPES, KYC_METHODS, LANGUAGES } from '@companio/types';

const CAT = CATEGORIES.map((c) => c.slug);
const CITY = CITIES.map((c) => c.slug);

export class SearchDto {
  @IsOptional() @IsIn(CAT) category?: string;
  @IsOptional() @IsIn(CITY) city?: string;
  // % and _ are LIKE wildcards in the database query — search them as plain text
  @IsOptional() @IsString() @MaxLength(80) @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[%_\\]/g, ' ').trim() : value)) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @IsIn(GENDERS) gender?: string;
  @IsOptional() @IsIn(LANGUAGES) language?: string;
  @IsOptional() @IsIn(['recommended', 'rating', 'price_asc', 'price_desc', 'newest']) sort?: string;
  @IsOptional() @IsIn(['today', 'weekend']) when?: 'today' | 'weekend';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize?: number;
}

export class ApplyDto {
  @IsString() @Length(8, 90) headline: string;
  @IsString() @Length(10, 1500) about: string;
  @Type(() => Number) @IsInt() @Min(199) @Max(10000) hourlyRate: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsIn(CAT, { each: true }) categories: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @IsIn(LANGUAGES, { each: true }) languages: string[];
  @IsIn(CITY) city: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(8, 90) headline?: string;
  @IsOptional() @IsString() @Length(10, 1500) about?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(199) @Max(10000) hourlyRate?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsIn(CAT, { each: true }) categories?: string[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @IsIn(LANGUAGES, { each: true }) languages?: string[];
  @IsOptional() @IsIn(CITY) city?: string;
  /** only accept bookings from women (women companions only) */
  @IsOptional() @IsBoolean() womenOnly?: boolean;
}

export class AvailabilityDto {
  @IsObject() availability: Record<string, { from: string; to: string }[]>;
}

export class ListingDto {
  @IsBoolean() listed: boolean;
}

export class KycDto {
  /** DIGILOCKER: the Aadhaar details come from DigiLocker, so only a selfie is uploaded */
  @IsOptional() @IsIn(KYC_METHODS) method?: 'MANUAL' | 'DIGILOCKER';
  @ValidateIf((o: KycDto) => o.method !== 'DIGILOCKER') @IsIn(ID_TYPES) idType?: string;
  @ValidateIf((o: KycDto) => o.method !== 'DIGILOCKER')
  @IsString()
  @Matches(/^[A-Za-z0-9]{4}$/, { message: 'Enter the last 4 characters of your ID' })
  idLast4?: string;
}
