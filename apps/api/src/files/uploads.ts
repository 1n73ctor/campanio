import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { config } from '../common/config';
import { stripImageMetadata } from './image-metadata';

// resolve (not join) so an absolute UPLOAD_DIR like /srv/companio-data/uploads is used as-is
export const PUBLIC_DIR = resolve(process.cwd(), config.uploadDir, 'public');
export const PRIVATE_DIR = resolve(process.cwd(), config.uploadDir, 'private');
mkdirSync(PUBLIC_DIR, { recursive: true });
mkdirSync(PRIVATE_DIR, { recursive: true });

type Kind = 'jpg' | 'png' | 'webp' | 'pdf';
export const PUBLIC_IMAGE_EXTS = ['.jpg', '.png', '.webp'];
export const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };

/**
 * What the file really is, from its first bytes. The browser's label (mimetype) and the original file name are
 * attacker-controlled, so neither is trusted — this is what stops e.g. an HTML page uploaded as "photo.png".
 */
export function detectKind(buf: Buffer): Kind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') return 'pdf';
  return null;
}

const newName = (kind: Kind) => `${Date.now()}-${randomBytes(12).toString('hex')}.${kind}`;

/** Multer keeps uploads in memory (max 5 MB) so nothing reaches disk before it has been checked. */
export const uploadLimits: MulterOptions = { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 2 } };

/** Profile & companion photos (public): verified image type, location/camera metadata removed, safe name. */
export function storePublicImage(file: Express.Multer.File | undefined): string {
  if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
  const kind = detectKind(file.buffer);
  if (kind !== 'jpg' && kind !== 'png' && kind !== 'webp') throw new BadRequestException('Please upload a JPG, PNG or WebP image');
  let cleaned: Buffer;
  try {
    cleaned = stripImageMetadata(file.buffer, kind);
  } catch {
    throw new BadRequestException('We couldn’t process this image — please try a different photo');
  }
  const name = newName(kind);
  writeFileSync(resolve(PUBLIC_DIR, name), cleaned, { mode: 0o644 });
  return name;
}

/** KYC ID documents & selfies (private): verified type, encrypted at rest when a key is configured. */
export function storePrivateDoc(file: Express.Multer.File | undefined): string {
  if (!file?.buffer?.length) throw new BadRequestException('Upload both your ID document and a live selfie');
  const kind = detectKind(file.buffer);
  if (!kind) throw new BadRequestException('Please upload a JPG, PNG, WebP or PDF file');
  const name = newName(kind);
  writeFileSync(resolve(PRIVATE_DIR, name), encryptDoc(file.buffer), { mode: 0o600 });
  return name;
}

// ---------- encryption at rest for private documents (AES-256-GCM) ----------
const MAGIC = Buffer.from('CMPENC1');
const docKey = () => (config.kycEncryptionKey ? Buffer.from(config.kycEncryptionKey, 'base64') : null);

export function encryptDoc(plain: Buffer): Buffer {
  const key = docKey();
  if (!key) return plain; // local dev without a key; production refuses to start without one
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

/** Decrypts an encrypted document; files saved before encryption was enabled are returned as they are. */
export function decryptDoc(data: Buffer): Buffer {
  if (!data.subarray(0, MAGIC.length).equals(MAGIC)) return data;
  const key = docKey();
  if (!key) throw new Error('KYC_ENCRYPTION_KEY is not set — cannot decrypt a stored document');
  const iv = data.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = data.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data.subarray(MAGIC.length + 28)), d.final()]);
}

export const isEncryptedDoc = (data: Buffer) => data.subarray(0, MAGIC.length).equals(MAGIC);

export const publicUrl = (fileName: string) => `${config.publicApiUrl}/uploads/public/${fileName}`;
