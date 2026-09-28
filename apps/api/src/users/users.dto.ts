import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsISO8601, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CITIES, GENDERS } from '@companio/types';

export class UpdateMeDto {
  @IsOptional() @IsString() @Length(2, 60) name?: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email?: string;
  @IsOptional() @IsISO8601() dob?: string;
  @IsOptional() @IsIn(GENDERS) gender?: string;
  @IsOptional() @IsIn(CITIES.map((c) => c.slug)) city?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsBoolean() acceptGuidelines?: boolean;
}
