import { Module } from '@nestjs/common';
import { BookingsAuthedController, BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsJobs } from './bookings.jobs';
import { EscrowService } from './escrow.service';

@Module({
  controllers: [BookingsController, BookingsAuthedController],
  providers: [BookingsService, BookingsJobs, EscrowService],
  exports: [BookingsService, EscrowService],
})
export class BookingsModule {}
