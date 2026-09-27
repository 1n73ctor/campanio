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

export class FirebaseLoginDto {
  /** Firebase Auth ID token from a completed phone-number sign-in */
  @IsString()
  @Length(20, 4096)
  idToken: string;

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
  /** 6-digit authenticator code, when two-factor sign-in is on */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string;
}
