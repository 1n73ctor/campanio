import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { AuthGuard, CurrentUser } from '../common/auth';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, DisputeDto, ListBookingsDto, LocationDto, MessageDto, QuoteDto, ReasonDto, ReviewDto, SosDto, StartDto } from './bookings.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private svc: BookingsService) {}

  /** Public: price breakdown (connection fee + GST) computed server-side. */
  @Post('quote')
  quote(@Body() dto: QuoteDto) {
    return this.svc.quote(dto.companionId, dto.hours);
  }
}

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('bookings')
export class BookingsAuthedController {
  constructor(private svc: BookingsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() q: ListBookingsDto) {
    return this.svc.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.svc.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.get(id, user);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.accept(user, id);
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.svc.decline(user, id, dto.reason);
  }

  @Post(':id/start')
  start(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: StartDto) {
    return this.svc.start(user, id, dto.code);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.complete(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.svc.cancel(user, id, dto.reason);
  }

  @Post(':id/dispute')
  dispute(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: DisputeDto) {
    return this.svc.dispute(user, id, dto);
  }

  @Post(':id/review')
  review(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.svc.review(user, id, dto);
  }

  @Post(':id/sos')
  sos(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SosDto) {
    return this.svc.sos(user, id, dto);
  }

  @Post(':id/location')
  location(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: LocationDto) {
    return this.svc.updateLocation(user, id, dto.lat, dto.lng);
  }

  @Get(':id/location')
  locations(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.locations(user, id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.messages(user, id);
  }

  @Post(':id/messages')
  send(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.svc.sendMessage(user, id, dto.body);
  }
}
