import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../common/config';
import { AuthGuard } from '../common/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

@Global()
@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret })],
  controllers: [AuthController, WhatsAppWebhookController],
  providers: [AuthService, SmsService, WhatsAppService, AuthGuard],
  exports: [JwtModule, AuthGuard, AuthService],
})
export class AuthModule {}
