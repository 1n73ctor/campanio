/* eslint-disable no-console */
/**
 * One-off: hosts who never uploaded a profile picture get their first host photo as it (and it follows their photo
 * order from then on, like new hosts).
 *
 * Dry run:  npm run avatars:auto -w @companio/api
 * Do it:    npm run avatars:auto -w @companio/api -- --yes
 */
import '../src/common/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const yes = process.argv.includes('--yes');

async function main() {
  const hosts = await prisma.companionProfile.findMany({ where: { user: { avatarUrl: null, status: { not: 'DELETED' } } }, select: { userId: true, photos: true, user: { select: { name: true } } } });
  let n = 0;
  for (const h of hosts) {
    const first = (JSON.parse(h.photos || '[]') as string[])[0];
    if (!first) continue;
    n++;
    console.log(`${h.user.name ?? h.userId} → first photo`);
    if (yes) await prisma.user.update({ where: { id: h.userId }, data: { avatarUrl: first, avatarAuto: true } });
  }
  console.log(`${n} host${n === 1 ? '' : 's'} ${yes ? 'updated' : 'to update — dry run, add --yes to do it'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
