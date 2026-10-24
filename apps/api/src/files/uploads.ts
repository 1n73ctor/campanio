import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { basename, resolve } from 'path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { config } from '../common/config';

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
/** ID verification: front + back of the ID + selfie */
export const kycUploadLimits: MulterOptions = { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 3 } };

/** Profile & companion photos (public): verified image type, location/camera metadata removed, safe name. */
/**
 * Profile and host photos: resized to fit `maxSide` (never enlarged), turned the right way up, and saved as WebP —
 * a phone photo of several MB becomes ~100–200 KB, so pages load fast. Metadata (GPS location, camera) is dropped.
 */
export async function storePublicImage(file: Express.Multer.File | undefined, maxSide = 1600): Promise<string> {
  if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
  const kind = detectKind(file.buffer);
  if (kind !== 'jpg' && kind !== 'png' && kind !== 'webp') throw new BadRequestException('Please upload a JPG, PNG or WebP image');
  let out: Buffer;
  try {
    out = await compressImage(file.buffer, maxSide);
  } catch {
    throw new BadRequestException('We couldn’t process this image — please try a different photo');
  }
  const name = newName('webp');
  writeFileSync(resolve(PUBLIC_DIR, name), out, { mode: 0o644 });
  return name;
}

/** Resize to fit maxSide × maxSide and encode as WebP (sharp drops EXIF/GPS metadata unless asked to keep it). */
export function compressImage(buf: Buffer, maxSide = 1600) {
  return sharp(buf, { failOn: 'error', limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/** KYC ID documents & selfies (private): verified type, encrypted at rest when a key is configured. */
export function storePrivateDoc(file: Express.Multer.File | undefined): string {
  if (!file?.buffer?.length) throw new BadRequestException('Upload both your ID document and a live selfie');
  if (!detectKind(file.buffer)) throw new BadRequestException('Please upload a JPG, PNG, WebP or PDF file');
  return storePrivateBytes(file.buffer);
}

/** Same as storePrivateDoc, for bytes we fetched ourselves (e.g. the photo on a DigiLocker Aadhaar record). */
export function storePrivateBytes(buf: Buffer): string {
  const kind = detectKind(buf);
  if (!kind) throw new Error('Unrecognised document format');
  const name = newName(kind);
  writeFileSync(resolve(PRIVATE_DIR, name), encryptDoc(buf), { mode: 0o600 });
  return name;
}

export function readPrivateDoc(name: string): Buffer {
  return decryptDoc(readFileSync(resolve(PRIVATE_DIR, basename(name))));
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

export const publicUrl = (fileName: string) => `${config.filesBaseUrl}/uploads/public/${fileName}`;

/** Our own public upload's file name from its URL (null for anything else, e.g. an outside avatar). */
const uploadName = (url: string | null | undefined) => url?.match(/\/uploads\/public\/([\w-]+)\.(?:jpg|jpeg|png|webp)$/i)?.[0].split('/').pop() ?? null;

/**
 * File name of a photo's blurred copy. Keyed with a server secret, so the real photo's name can't be worked out from
 * the blurred one (that's what keeps a ⭐ Premium host's photos private until a member unlocks them).
 */
const blurName = (name: string) => `b-${createHmac('sha256', config.jwtSecret).update(`blur:${name}`).digest('hex').slice(0, 32)}.webp`;

/** The blurred copy of a photo (⭐ Premium hosts' photos shown to members who haven't unlocked them). */
export function blurredUrl(url: string | null | undefined): string | null {
  const name = uploadName(url);
  return name ? publicUrl(blurName(name)) : null;
}

/** Makes the blurred copy if it isn't there yet. Never throws. */
export async function ensureBlurred(url: string | null | undefined) {
  const name = uploadName(url);
  if (!name) return;
  const out = resolve(PUBLIC_DIR, blurName(name));
  if (existsSync(out)) return;
  try {
    const buf = await sharp(readFileSync(resolve(PUBLIC_DIR, name))).rotate().resize({ width: 480, height: 480, fit: 'inside' }).blur(12).webp({ quality: 65 }).toBuffer();
    writeFileSync(out, buf, { mode: 0o644 });
  } catch {
    /* missing or unreadable original: the card shows its fallback */
  }
}
