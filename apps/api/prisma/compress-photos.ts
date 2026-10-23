/* eslint-disable no-console */
/**
 * Shrinks photos uploaded before uploads were compressed: every profile picture and host photo that isn't WebP yet
 * (or is bigger than 400 KB) is resized and re-saved as WebP, and the links in the database are updated. The original
 * files are moved to uploads-originals/ next to the uploads folder, so nothing is lost.
 *
 * Dry run (shows what would change):  npm run photos:compress -w @companio/api
 * Do it:                              npm run photos:compress -w @companio/api -- --yes
 */
import '../src/common/env';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PUBLIC_DIR, compressImage } from '../src/files/uploads';

const prisma = new PrismaClient();
const yes = process.argv.includes('--yes');
const BIG = 400 * 1024;
const fileOf = (url: string | null | undefined) => url?.match(/\/uploads\/public\/([\w.-]+)$/)?.[1] ?? null;

async function main() {
  const backupDir = resolve(dirname(PUBLIC_DIR), 'uploads-originals');
  const done = new Map<string, string>(); // old name → new name
  let before = 0;
  let after = 0;

  const shrink = async (name: string, maxSide: number) => {
    if (done.has(name)) return done.get(name)!;
    const path = join(PUBLIC_DIR, name);
    if (!existsSync(path)) return null;
    const size = statSync(path).size;
    if (name.endsWith('.webp') && size <= BIG) return null;
    const out = await compressImage(readFileSync(path), maxSide).catch(() => null);
    if (!out || out.length >= size) return null;
    const next = `${Date.now()}-${randomBytes(12).toString('hex')}.webp`;
    before += size;
    after += out.length;
    console.log(`  ${name}  ${(size / 1024).toFixed(0)} KB → ${(out.length / 1024).toFixed(0)} KB`);
    if (yes) {
      writeFileSync(join(PUBLIC_DIR, next), out, { mode: 0o644 });
      mkdirSync(backupDir, { recursive: true });
      renameSync(path, join(backupDir, name));
    }
    done.set(name, next);
    return next;
  };

  const users = await prisma.user.findMany({ where: { avatarUrl: { contains: '/uploads/public/' } }, select: { id: true, avatarUrl: true } });
  for (const u of users) {
    const name = fileOf(u.avatarUrl);
    const next = name && (await shrink(name, 800));
    if (next && yes) await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: u.avatarUrl!.replace(name, next) } });
  }
  const hosts = await prisma.companionProfile.findMany({ select: { id: true, photos: true } });
  for (const h of hosts) {
    const photos = JSON.parse(h.photos || '[]') as string[];
    let changed = false;
    const updated: string[] = [];
    for (const url of photos) {
      const name = fileOf(url);
      const next = name && (await shrink(name, 1600));
      if (next) changed = true;
      updated.push(next ? url.replace(name!, next) : url);
    }
    if (changed && yes) await prisma.companionProfile.update({ where: { id: h.id }, data: { photos: JSON.stringify(updated) } });
  }
  console.log(`\n${done.size} photo(s): ${(before / 1024 / 1024).toFixed(1)} MB → ${(after / 1024 / 1024).toFixed(1)} MB`);
  if (!yes && done.size) console.log('Dry run — nothing changed. Re-run with --yes to do it (originals are kept in uploads-originals/).');
  else if (yes && done.size) console.log(`Done. Originals moved to ${backupDir}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
