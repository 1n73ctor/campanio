/* eslint-disable no-console */
/**
 * One-time, when email verification goes live: people who signed up before it get their email marked as verified,
 * so nothing changes for them (they keep getting emails). New sign-ups and email changes verify by link.
 *   npm run db:verify-existing-emails -w @companio/api
 * Only touches accounts created before this moment, so running it again later never verifies a new sign-up.
 */
import '../src/common/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const r = await prisma.user.updateMany({
    where: { contactEmail: { not: null }, contactEmailVerifiedAt: null, createdAt: { lt: now }, status: { not: 'DELETED' } },
    data: { contactEmailVerifiedAt: now },
  });
  console.log(`✅ ${r.count} existing email address${r.count === 1 ? '' : 'es'} marked as verified`);
}
main()
  .catch((e) => {
    console.error(`❌ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
