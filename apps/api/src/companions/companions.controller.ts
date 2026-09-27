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
import { publicUrl, storePrivateDoc, storePublicImage, uploadLimits } from '../files/uploads';
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

  @Post('kyc')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'idDoc', maxCount: 1 }, { name: 'selfie', maxCount: 1 }], uploadLimits))
  kyc(
    @CurrentUser() user: User,
    @Body() dto: KycDto,
    @UploadedFiles() files: { idDoc?: Express.Multer.File[]; selfie?: Express.Multer.File[] },
  ) {
    const idDoc = files?.idDoc?.[0];
    const selfie = files?.selfie?.[0];
    if (!idDoc || !selfie) throw new BadRequestException('Upload both your ID document and a live selfie');
    return this.svc.submitKyc(user, dto.idType, dto.idLast4, storePrivateDoc(idDoc), storePrivateDoc(selfie));
  }
}
