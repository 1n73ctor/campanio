import { Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { basename, join } from 'path';
import { existsSync } from 'fs';
import { PRIVATE_DIR } from './uploads';
import { verifyPrivateSig } from './signing';

@ApiExcludeController()
@Controller('files')
export class FilesController {
  @Get('private/:name')
  get(@Param('name') name: string, @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: Response) {
    const safe = basename(name);
    if (!verifyPrivateSig(safe, Number(exp), sig)) throw new ForbiddenException('Link expired');
    const path = join(PRIVATE_DIR, safe);
    if (!existsSync(path)) throw new ForbiddenException('Not found');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path);
  }
}
