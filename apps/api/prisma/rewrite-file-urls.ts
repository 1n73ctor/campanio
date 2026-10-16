/* eslint-disable no-console */
/**
 * Points saved photo links (profile photos, host gallery) at FILES_BASE_URL, e.g. after moving them from
 * https://api.getcompanio.in/uploads/… to https://getcompanio.in/uploads/…:
 *   npm run db:rewrite-file-urls -w @companio/api
 * Only the part before /uploads/ changes; the file itself stays where it is. Safe to run again.
 */
import '../src/common/env';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/common/config';

const prisma = new PrismaClient();
const OLD = /^https?:\/\/[^/]+(?=\/uploads\/)/;
const fix = (url: string) => url.replace(OLD, config.filesBaseUrl);

async function main() {
  let users = 0;
  for (const u of await prisma.user.findMany({ where: { avatarUrl: { contains: '/uploads/' } }, select: { id: true, avatarUrl: true } })) {
    const next = fix(u.avatarUrl!);
    if (next !== u.avatarUrl) {
      await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: next } });
      users++;
    }
  }
  let profiles = 0;
  for (const c of await prisma.companionProfile.findMany({ where: { photos: { contains: '/uploads/' } }, select: { id: true, photos: true } })) {
    const photos = JSON.parse(c.photos) as string[];
    const next = JSON.stringify(photos.map(fix));
    if (next !== c.photos) {
      await prisma.companionProfile.update({ where: { id: c.id }, data: { photos: next } });
      profiles++;
    }
  }
  console.log(`✅ Photo links now use ${config.filesBaseUrl}: ${users} profile photo(s), ${profiles} host gallery(ies) updated`);
}
main()
  .catch((e) => {
    console.error(`❌ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
