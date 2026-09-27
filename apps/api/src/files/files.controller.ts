import { Controller, ForbiddenException, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { basename, extname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { MIME, PRIVATE_DIR, decryptDoc } from './uploads';
import { verifyPrivateSig } from './signing';

/** sample documents written by the seed script are SVGs; uploads can only ever be JPG/PNG/WebP/PDF */
const PRIVATE_MIME: Record<string, string> = { ...MIME, '.svg': 'image/svg+xml' };

@ApiExcludeController()
@Controller('files')
export class FilesController {
  /** KYC documents, via short-lived signed links handed to admins. */
  @Get('private/:name')
  get(@Param('name') name: string, @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: Response) {
    const safe = basename(name);
    if (!verifyPrivateSig(safe, Number(exp), sig)) throw new ForbiddenException('Link expired');
    const path = join(PRIVATE_DIR, safe);
    if (!existsSync(path)) throw new NotFoundException('Not found');
    const type = PRIVATE_MIME[extname(safe).toLowerCase()];
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // even if a file were ever malicious, it can't run scripts or reach anything when opened directly
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; plugin-types application/pdf; sandbox");
    res.setHeader('Content-Type', type ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `${type ? 'inline' : 'attachment'}; filename="${safe}"`);
    res.end(decryptDoc(readFileSync(path)));
  }
}
