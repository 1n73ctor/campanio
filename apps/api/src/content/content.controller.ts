import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Block } from '@companio/types';
import { AuthGuard, CurrentUser, Roles } from '../common/auth';
import { ContentService } from './content.service';

class PostDto {
  @IsString() @MaxLength(140) title: string;
  @IsString() @MaxLength(300) excerpt: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  @IsOptional() @IsIn(['pink', 'lime', 'sky', 'sunny', 'lavender']) tone?: string;
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsArray() body: Block[];
}
class PublishDto {
  @IsBoolean() published: boolean;
}
class DraftDto {
  @IsOptional() @IsString() @MaxLength(200) topic?: string;
}
class GuideDto {
  @IsArray() intro: string[];
  @IsArray() faqs: { q: string; a: string }[];
  @IsObject() spots: Record<string, string>;
}
class ListDto {
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED']) status?: string;
}

/** Published blog posts and city guides, for the website. */
@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private svc: ContentService) {}
  @Get('posts') posts() {
    return this.svc.publishedPosts();
  }
  @Get('city-guides') guides() {
    return this.svc.publishedGuides();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin/content')
export class AdminContentController {
  constructor(private svc: ContentService) {}

  @Get('posts') list(@Query() q: ListDto) {
    return this.svc.listPosts(q.status);
  }
  @Post('posts') create(@CurrentUser() a: User, @Body() dto: PostDto) {
    return this.svc.createPost(a, dto);
  }
  /** "Write a draft now" — same as the weekly AI draft, optionally on a given topic */
  @Post('posts/draft') @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } }) draft(@Body() dto: DraftDto) {
    return this.svc.draftPost(dto.topic?.trim() || undefined);
  }
  @Put('posts/:id') update(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: PostDto) {
    return this.svc.updatePost(a, id, dto);
  }
  @Post('posts/:id/publish') @HttpCode(200) publish(@CurrentUser() a: User, @Param('id') id: string, @Body() dto: PublishDto) {
    return this.svc.setPublished(a, id, dto.published);
  }
  @Delete('posts/:id') remove(@CurrentUser() a: User, @Param('id') id: string) {
    return this.svc.deletePost(a, id);
  }

  @Get('city-guides') guides() {
    return this.svc.listGuides();
  }
  @Put('city-guides/:city') saveGuide(@CurrentUser() a: User, @Param('city') city: string, @Body() dto: GuideDto) {
    return this.svc.saveGuide(a, city, dto);
  }
  @Post('city-guides/:city/draft') @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } }) draftGuide(@Param('city') city: string) {
    return this.svc.draftGuide(city);
  }
  @Post('city-guides/:city/publish') @HttpCode(200) publishGuide(@CurrentUser() a: User, @Param('city') city: string, @Body() dto: PublishDto) {
    return this.svc.setGuidePublished(a, city, dto.published);
  }
  @Delete('city-guides/:city') removeGuide(@CurrentUser() a: User, @Param('city') city: string) {
    return this.svc.deleteGuide(a, city);
  }
}
