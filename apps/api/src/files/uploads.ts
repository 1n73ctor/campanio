import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { config } from '../common/config';

export const PUBLIC_DIR = join(process.cwd(), config.uploadDir, 'public');
export const PRIVATE_DIR = join(process.cwd(), config.uploadDir, 'private');
mkdirSync(PUBLIC_DIR, { recursive: true });
mkdirSync(PRIVATE_DIR, { recursive: true });

const IMAGE = /^image\/(jpeg|png|webp|heic|heif)$/;
const DOC = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

const make = (dir: string, allowed: RegExp): MulterOptions => ({
  storage: diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    allowed.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('Unsupported file type') as unknown as Error, false),
});

export const publicImageUpload = make(PUBLIC_DIR, IMAGE);
export const privateDocUpload = make(PRIVATE_DIR, DOC);
export const publicUrl = (fileName: string) => `${config.publicApiUrl}/uploads/public/${fileName}`;
