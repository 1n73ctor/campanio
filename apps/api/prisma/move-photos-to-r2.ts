/* eslint-disable no-console */
/**
 * Moves public photos (profile pictures, host photos) from this server to Cloudflare R2 and points their links in the
 * database at R2_PUBLIC_URL. Files are copied, not deleted: the server copies keep old links working until they're
 * removed by hand. Photos that fail to upload keep their old link. Safe to run again.
 *
 * Dry run (shows what would change):  npm run photos:r2 -w @companio/api
 * Do it:                              npm run photos:r2 -w @companio/api -- --yes
 */
import '../src/common/env';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { MIME, PUBLIC_DIR, publicUrl, uploadName } from '../src/files/uploads';
import { r2Enabled, r2Exists, r2Put } from '../src/files/r2';

const prisma = new PrismaClient();
const yes = process.argv.includes('--yes');

async function main() {
  if (!r2Enabled()) throw new Error('R2 isn’t set up — add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL to .env');

  // 1. copy files (old "-blur" copies are no longer used)
  const files = readdirSync(PUBLIC_DIR).filter((f) => /\.(webp|jpg|jpeg|png)$/i.test(f) && !f.endsWith('-blur.webp'));
  const onR2 = new Set<string>();
  let copied = 0;
  for (const f of files) {
    try {
      if (await r2Exists(f)) onR2.add(f);
      else if (yes) {
        await r2Put(f, readFileSync(resolve(PUBLIC_DIR, f)), MIME[f.slice(f.lastIndexOf('.')).toLowerCase().replace('.jpeg', '.jpg')] ?? 'image/webp');
        onR2.add(f);
        copied++;
      }
    } catch (e) {
      console.error(`  ✗ ${f}: ${(e as Error).message}`);
    }
  }
  console.log(`${files.length} photo files on this server · ${yes ? `${copied} copied to R2` : `${files.length - onR2.size} to copy`} · ${onR2.size} on R2 now`);

  // 2. point links at R2 (only for files that are really there)
  const moved = (url: string | null) => {
    const name = uploadName(url);
    if (!url || !name || url === publicUrl(name)) return null; // not ours, or already on R2
    return yes ? (onR2.has(name) ? publicUrl(name) : null) : existsSync(resolve(PUBLIC_DIR, name)) ? publicUrl(name) : null;
  };
  let avatars = 0;
  let hosts = 0;
  let missing = 0;
  for (const u of await prisma.user.findMany({ where: { avatarUrl: { contains: '/uploads/public/' } }, select: { id: true, avatarUrl: true } })) {
    const next = moved(u.avatarUrl);
    if (!next) {
      missing++;
      continue;
    }
    avatars++;
    if (yes) await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: next } });
  }
  for (const c of await prisma.companionProfile.findMany({ where: { photos: { contains: '/uploads/public/' } }, select: { id: true, photos: true } })) {
    const photos = JSON.parse(c.photos || '[]') as string[];
    const next = photos.map((p) => moved(p) ?? p);
    if (next.every((p, i) => p === photos[i])) continue;
    hosts++;
    if (yes) await prisma.companionProfile.update({ where: { id: c.id }, data: { photos: JSON.stringify(next) } });
  }
  console.log(`${yes ? 'Updated' : 'Would update'}: ${avatars} profile pictures, ${hosts} hosts’ photo lists${missing ? ` · ${missing} profile picture links left as they are (file not found)` : ''}`);
  if (!yes) console.log('Dry run — nothing changed. Add --yes to do it.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
