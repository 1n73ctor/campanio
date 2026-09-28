import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma.service';
import { SettingsModule } from './common/settings.service';
import { WalletLedgerModule } from './common/wallet-ledger.service';
import { AuditModule } from './common/audit.service';
import { NotificationsCoreModule } from './notifications/notifications.service';
import { NotificationsController } from './notifications/notifications.controller';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './users/users.controller';
import { CompanionSelfController, CompanionsController } from './companions/companions.controller';
import { CompanionsService } from './companions/companions.service';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletController } from './wallet/wallet.controller';
import { ReportsController } from './safety/reports.controller';
import { MetaController } from './meta/meta.controller';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { FilesController } from './files/files.controller';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { ReferralsModule } from './referrals/referrals.service';
import { CompanionFeeModule } from './companions/companion-fee.service';
import { OffersModule } from './offers/offers.service';
import { SafetyShareService } from './safety/safety-share.service';
import { PublicSafetyShareController, SafetyShareController } from './safety/safety-share.controller';
import { ReferralsController } from './referrals/referrals.controller';
import { KycService } from './kyc/kyc.service';
import { DemoDigilockerController } from './kyc/demo-digilocker';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 240 }]),
    PrismaModule,
    SettingsModule,
    WalletLedgerModule,
    AuditModule,
    NotificationsCoreModule,
    AuthModule,
    BookingsModule,
    PaymentsModule,
    ReferralsModule,
    CompanionFeeModule,
    OffersModule,
  ],
  controllers: [
    MetaController,
    UsersController,
    CompanionsController,
    CompanionSelfController,
    WalletController,
    ReportsController,
    NotificationsController,
    AdminController,
    FilesController,
    ReferralsController,
    SafetyShareController,
    PublicSafetyShareController,
    DemoDigilockerController,
  ],
  providers: [CompanionsService, KycService, AdminService, SafetyShareService, RealtimeGateway, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
