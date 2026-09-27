import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class OtpRequestDto {
  @IsString()
  @Matches(/^(\+?91)?[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone: string;
}

export class OtpVerifyDto extends OtpRequestDto {
  @IsString()
  @Length(6, 6)
  code: string;

  /** Invite code from a friend's link; only applied when this sign-in creates the account. */
  @IsOptional()
  @IsString()
  @Length(0, 20)
  ref?: string;
}

export class AdminLoginDto {
  @IsEmail()
  email: string;
  @IsString()
  @Length(6, 200)
  password: string;
}
