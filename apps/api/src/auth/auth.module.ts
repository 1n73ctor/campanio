import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../common/config';
import { AuthGuard } from '../common/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';

@Global()
@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret })],
  controllers: [AuthController],
  providers: [AuthService, SmsService, AuthGuard],
  exports: [JwtModule, AuthGuard],
})
export class AuthModule {}
