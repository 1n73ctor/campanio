import { Logger, Module } from '@nestjs/common';
import { config } from '../common/config';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './providers/provider';
import { MockProvider } from './providers/mock.provider';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  imports: [BookingsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () => {
        if (config.paymentProvider === 'razorpay') {
          if (!config.razorpay.keyId || !config.razorpay.keySecret) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are required');
          return new RazorpayProvider(config.razorpay.keyId, config.razorpay.keySecret, config.razorpay.webhookSecret);
        }
        if (process.env.NODE_ENV === 'production') new Logger('Payments').warn('Using the MOCK payment gateway in production!');
        return new MockProvider();
      },
    },
  ],
})
export class PaymentsModule {}
