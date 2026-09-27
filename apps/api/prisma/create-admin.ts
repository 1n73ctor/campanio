/* eslint-disable no-console */
/**
 * Creates (or resets the password of) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD — and nothing else.
 * Use this on a live server instead of the seed, which also inserts demo companions, bookings and reviews.
 *   npm run db:create-admin -w @companio/api
 */
import '../src/common/env';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Set ADMIN_EMAIL in apps/api/.env');
  if (password.length < 12 || password === 'admin12345') throw new Error('Set ADMIN_PASSWORD in apps/api/.env to 12+ characters (not the demo password)');

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN') throw new Error(`${email} belongs to a non-admin account`);
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, name: 'Admin', role: 'ADMIN', onboarded: true },
    update: { passwordHash, status: 'ACTIVE' },
  });
  console.log(existing ? `✅ admin password reset for ${email}` : `✅ admin created: ${email}`);
}

main()
  .catch((e) => {
    console.error(`❌ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
