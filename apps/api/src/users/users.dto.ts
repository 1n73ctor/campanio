import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CITIES, GENDERS } from '@companio/types';

export class UpdateMeDto {
  @IsOptional() @IsString() @Length(2, 60) name?: string;
  @IsOptional() @IsISO8601() dob?: string;
  @IsOptional() @IsIn(GENDERS) gender?: string;
  @IsOptional() @IsIn(CITIES.map((c) => c.slug)) city?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsBoolean() acceptGuidelines?: boolean;
}
