import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { AuthGuard, CurrentUser } from '../common/auth';
import { Throttle } from '@nestjs/throttler';
import { publicUrl, storePublicImage, uploadLimits } from '../files/uploads';
import { KycService } from '../kyc/kyc.service';
import { CompanionsService } from './companions.service';
import { ApplyDto, AvailabilityDto, KycDto, ListingDto, SearchDto, UpdateProfileDto } from './companions.dto';
import { CompanionFeeService } from './companion-fee.service';

@ApiTags('companions')
@Controller('companions')
export class CompanionsController {
  constructor(private svc: CompanionsService) {}

  @Get()
  search(@Query() q: SearchDto) {
    return this.svc.search(q);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(id);
  }
}

@ApiTags('companion (self)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('companion')
export class CompanionSelfController {
  constructor(
    private svc: CompanionsService,
    private fee: CompanionFeeService,
    private kyc: KycService,
  ) {}

  /** Registration fee the caller owes before applying (due=false → no payment step). Pay via POST /payments/companion-fee. */
  @Get('fee')
  feeStatus(@CurrentUser() user: User) {
    return this.fee.status(user);
  }

  @Post('apply')
  apply(@CurrentUser() user: User, @Body() dto: ApplyDto) {
    return this.svc.apply(user, dto);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: User) {
    return this.svc.dashboard(user);
  }

  @Patch('profile')
  update(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(user.id, dto);
  }

  @Put('availability')
  availability(@CurrentUser() user: User, @Body() dto: AvailabilityDto) {
    return this.svc.setAvailability(user.id, dto.availability);
  }

  @Post('listing')
  listing(@CurrentUser() user: User, @Body() dto: ListingDto) {
    return this.svc.setListed(user.id, dto.listed);
  }

  @Post('photos')
  @UseInterceptors(FileInterceptor('file', uploadLimits))
  photo(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.addPhoto(user.id, publicUrl(storePublicImage(file)));
  }

  @Delete('photos/:index')
  removePhoto(@CurrentUser() user: User, @Param('index', ParseIntPipe) index: number) {
    return this.svc.removePhoto(user.id, index);
  }

  /** Which verification routes are available (DigiLocker needs Cashfree keys on the server). */
  @Get('kyc/options')
  kycOptions() {
    return this.kyc.options();
  }

  /** Starts a DigiLocker consent journey; the browser goes to the returned url and comes back to /companion/kyc. */
  @Post('kyc/digilocker')
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  startDigilocker(@CurrentUser() user: User) {
    return this.kyc.startDigilocker(user);
  }

  /** After DigiLocker: reads the shared Aadhaar record. Only ever the caller's own journey. */
  @Post('kyc/digilocker/complete')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  completeDigilocker(@CurrentUser() user: User) {
    return this.kyc.completeDigilocker(user);
  }

  @Get('kyc/digilocker')
  currentDigilocker(@CurrentUser() user: User) {
    return this.kyc.currentDigilocker(user);
  }

  @Delete('kyc/digilocker')
  discardDigilocker(@CurrentUser() user: User) {
    return this.kyc.discardDigilocker(user);
  }

  @Post('kyc')
  @Throttle({ default: { limit: 6, ttl: 10 * 60_000 } })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'idDoc', maxCount: 1 }, { name: 'selfie', maxCount: 1 }], uploadLimits))
  submitKyc(
    @CurrentUser() user: User,
    @Body() dto: KycDto,
    @UploadedFiles() files: { idDoc?: Express.Multer.File[]; selfie?: Express.Multer.File[] },
  ) {
    return this.kyc.submit(user, { method: dto.method ?? 'MANUAL', idType: dto.idType, idLast4: dto.idLast4, idDoc: files?.idDoc?.[0], selfie: files?.selfie?.[0] });
  }
}
