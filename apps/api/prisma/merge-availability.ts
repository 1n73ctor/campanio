/* eslint-disable no-console */
/**
 * One-off tidy-up: combines repeated or overlapping weekly slots that were saved before the server did it on save
 * (e.g. 10:00–18:00 four times → once).
 *
 * Dry run:  npm run availability:merge -w @companio/api
 * Do it:    npm run availability:merge -w @companio/api -- --yes
 */
import '../src/common/env';
import { PrismaClient } from '@prisma/client';
import { WEEKDAYS, mergeSlots, type TimeSlot } from '@companio/types';

const prisma = new PrismaClient();
const yes = process.argv.includes('--yes');

async function main() {
  let changed = 0;
  for (const c of await prisma.companionProfile.findMany({ select: { id: true, availability: true, user: { select: { name: true } } } })) {
    const av = JSON.parse(c.availability || '{}') as Record<string, TimeSlot[]>;
    const next: Record<string, TimeSlot[]> = {};
    for (const d of WEEKDAYS) if (av[d]?.length) next[d] = mergeSlots(av[d]);
    if (JSON.stringify(next) === JSON.stringify(Object.fromEntries(WEEKDAYS.filter((d) => av[d]?.length).map((d) => [d, av[d]])))) continue;
    changed++;
    console.log(`${c.user.name ?? c.id}: ${WEEKDAYS.filter((d) => next[d]).map((d) => `${d} ${next[d].map((s) => `${s.from}–${s.to}`).join(', ')}`).join(' · ')}`);
    if (yes) await prisma.companionProfile.update({ where: { id: c.id }, data: { availability: JSON.stringify(next) } });
  }
  console.log(`${changed} host${changed === 1 ? '' : 's'} ${yes ? 'tidied' : 'to tidy'}${yes ? '' : ' — dry run, add --yes to do it'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
