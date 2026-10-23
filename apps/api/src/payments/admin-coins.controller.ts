import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { AuthGuard, Roles } from '../common/auth';
import { TopUpOffersService } from './topup-offers.service';

class PurchasesQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @IsIn(['paid', 'unpaid', 'all']) status?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}
class OfferDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @Length(2, 60) title: string;
  @IsInt() @Min(50) @Max(10_000) minAmount: number;
  // a bonus above 50% is almost certainly a typo
  @IsInt() @Min(1) @Max(50) bonusPct: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(5_000) maxBonus?: number | null;
  @IsOptional() @IsBoolean() firstOnly?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() startsAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() endsAt?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** Admin → Coin purchases: who added money to their wallet, and the bonus offers. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin/coins')
export class AdminCoinsController {
  constructor(private offers: TopUpOffersService) {}

  @Get('summary') summary() {
    return this.offers.summary();
  }
  @Get('purchases') purchases(@Query() q: PurchasesQuery) {
    return this.offers.purchases(q);
  }
  @Get('offers') list() {
    return this.offers.list();
  }
  @Post('offers') save(@Body() dto: OfferDto) {
    return this.offers.save(dto);
  }
  @Delete('offers/:id') remove(@Param('id') id: string) {
    return this.offers.remove(id);
  }
}
