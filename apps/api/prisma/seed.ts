/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CATEGORIES, CITIES } from '@companio/types';

const prisma = new PrismaClient();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const FIRST_F = ['Priya', 'Ananya', 'Ishita', 'Kavya', 'Meera', 'Riya', 'Sana', 'Tara', 'Nisha', 'Diya', 'Aditi', 'Zoya', 'Pooja', 'Simran', 'Neha'];
const FIRST_M = ['Arjun', 'Kabir', 'Vihaan', 'Rohan', 'Ishaan', 'Dev', 'Aditya', 'Karan', 'Nikhil', 'Siddharth', 'Yash', 'Rahul', 'Aman', 'Varun', 'Manav'];
const LAST = ['Sharma', 'Verma', 'Iyer', 'Reddy', 'Kapoor', 'Mehta', 'Nair', 'Bose', 'Gupta', 'Singh', 'Rao', 'Joshi', 'Das', 'Khan', 'Patel'];
const LANGS: Record<string, string[]> = {
  jaipur: ['Hindi', 'English', 'Rajasthani'],
  delhi: ['Hindi', 'English', 'Punjabi'],
  mumbai: ['Hindi', 'English', 'Marathi'],
  bengaluru: ['English', 'Kannada', 'Hindi'],
  pune: ['Marathi', 'English', 'Hindi'],
  hyderabad: ['Telugu', 'English', 'Hindi'],
  chennai: ['Tamil', 'English'],
  kolkata: ['Bengali', 'English', 'Hindi'],
  ahmedabad: ['Gujarati', 'Hindi', 'English'],
  chandigarh: ['Punjabi', 'Hindi', 'English'],
};
const HEADLINES: Record<string, string[]> = {
  'gym-partner': ['Certified trainer who makes leg day fun', 'Your 6am accountability buddy'],
  'movie-buddy': ['Popcorn critic with strong opinions', 'Will watch anything once (even horror)'],
  'city-guide': ['Born-and-raised local, know every gali', 'Heritage walks + street food trails'],
  'study-buddy': ['CA finalist, pomodoro pro', 'Engineering grad — happy to co-work'],
  'shopping-buddy': ['Stylist-in-training, brutally honest', 'Bargaining champion of the bazaar'],
  'event-plus-one': ['Great at small talk, better at dancing', 'Networking events without the awkwardness'],
  'coffee-chat': ['Good listener, better coffee finder', 'Deep talks or light banter — your call'],
  'travel-buddy': ['Weekend trekker & road-trip DJ', 'Day trips planned down to the chai stops'],
  'gaming-partner': ['Board-game café regular', 'Arcade high scores & FIFA nights'],
  'walk-and-talk': ['Sunrise walks and good vibes', 'Park jogs at your pace'],
};

let rng = 42;
const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
const pickN = <T>(a: T[], n: number) => [...a].sort(() => rand() - 0.5).slice(0, n);

const quote = (rate: number, hours: number) => {
  const subtotal = rate * hours;
  const connectionFee = 99;
  const gst = Math.round(connectionFee * 0.18);
  const commission = Math.round(subtotal * 0.15);
  return { hourlyRate: rate, subtotal, connectionFee, gst, total: subtotal + connectionFee + gst, commission, companionPayout: subtotal - commission };
};

const AVAIL = JSON.stringify({
  mon: [{ from: '17:00', to: '22:00' }],
  tue: [{ from: '17:00', to: '22:00' }],
  wed: [{ from: '17:00', to: '22:00' }],
  thu: [{ from: '17:00', to: '22:00' }],
  fri: [{ from: '16:00', to: '23:00' }],
  sat: [{ from: '09:00', to: '23:00' }],
  sun: [{ from: '09:00', to: '21:00' }],
});

function placeholderDoc(name: string, label: string) {
  const dir = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads', 'private');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, name),
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="100%" height="100%" rx="18" fill="#FFF3C4" stroke="#111" stroke-width="6"/><text x="50%" y="46%" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#111">${label}</text><text x="50%" y="62%" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#555">sample file (seed data)</text></svg>`,
  );
}

async function main() {
  console.log('🌱 seeding…');
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@companio.local').toLowerCase();
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'admin12345', 10),
      name: 'Asha (Trust & Safety)',
      role: 'ADMIN',
      onboarded: true,
    },
  });

  // --- companions across every city ---
  let phoneSeq = 9100000000;
  const companions: { userId: string; profileId: string; rate: number; categories: string[]; city: string; name: string }[] = [];
  for (const city of CITIES) {
    const count = city.slug === 'jaipur' || city.slug === 'mumbai' || city.slug === 'delhi' || city.slug === 'bengaluru' ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const female = rand() > 0.45;
      const name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
      const cats = pickN(CATEGORIES.map((c) => c.slug), 2 + Math.floor(rand() * 2));
      const rate = [299, 349, 399, 449, 499, 599, 699, 799, 999][Math.floor(rand() * 9)];
      const age = 19 + Math.floor(rand() * 12);
      const user = await prisma.user.create({
        data: {
          phone: `+91${phoneSeq++}`,
          name,
          dob: new Date(Date.now() - age * 365.25 * DAY),
          gender: female ? 'FEMALE' : 'MALE',
          city: city.slug,
          bio: `${city.name} local. ${pick(['Chai over coffee.', 'Dog person.', 'Always hungry.', 'Plant parent.', 'Cricket nerd.', 'Bollywood encyclopedia.'])}`,
          role: 'COMPANION',
          onboarded: true,
          guidelinesAccepted: new Date(),
          createdAt: new Date(Date.now() - Math.floor(rand() * 120) * DAY),
          wallet: { create: {} },
        },
      });
      const headline = pick(HEADLINES[cats[0]]);
      const p = await prisma.companionProfile.create({
        data: {
          userId: user.id,
          headline,
          about: `Hey, I'm ${name.split(' ')[0]}! ${headline}. I love meeting new people in ${city.name} and keeping things easy-going, respectful and fun. Public places only, always on time, and I'll happily suggest spots if you're new in town.`,
          hourlyRate: rate,
          categories: cats.join(','),
          languages: pickN(LANGS[city.slug], 2).join(','),
          city: city.slug,
          availability: AVAIL,
          kycStatus: 'APPROVED',
          isListed: true,
          ratingAvg: 0,
          ratingCount: 0,
          completedBookings: 0,
        },
      });
      await prisma.kycSubmission.create({
        data: { userId: user.id, idType: 'AADHAAR', idLast4: String(1000 + Math.floor(rand() * 8999)), idDocPath: 'seed-id.svg', selfiePath: 'seed-selfie.svg', status: 'APPROVED', reviewerId: admin.id, reviewedAt: new Date() },
      });
      companions.push({ userId: user.id, profileId: p.id, rate, categories: cats, city: city.slug, name });
    }
  }
  placeholderDoc('seed-id.svg', 'AADHAAR •••• (sample)');
  placeholderDoc('seed-selfie.svg', 'LIVE SELFIE (sample)');

  // --- demo accounts ---
  const member = await prisma.user.create({
    data: {
      phone: '+919000000001',
      name: 'Aarav Mehta',
      dob: new Date('2001-04-12'),
      gender: 'MALE',
      city: 'jaipur',
      bio: 'New in Jaipur for work, looking to explore!',
      onboarded: true,
      guidelinesAccepted: new Date(),
      wallet: { create: {} },
    },
  });
  const priyaUser = await prisma.user.create({
    data: {
      phone: '+919000000002',
      name: 'Priya Rathore',
      dob: new Date('1999-09-02'),
      gender: 'FEMALE',
      city: 'jaipur',
      bio: 'Pink City native. Chai, heritage walks and board games.',
      role: 'COMPANION',
      onboarded: true,
      guidelinesAccepted: new Date(),
      wallet: { create: {} },
    },
  });
  const priya = await prisma.companionProfile.create({
    data: {
      userId: priyaUser.id,
      headline: 'Born-and-raised local, know every gali',
      about:
        "I'm Priya — I grew up in the old city and I've been showing friends-of-friends around for years. Heritage walks through Johari Bazaar, sunset at Nahargarh, the best pyaaz kachori in town, or just a coffee and a chat. Strictly platonic, always in public places, and I'm big on being on time.",
      hourlyRate: 499,
      categories: 'city-guide,coffee-chat,shopping-buddy',
      languages: 'Hindi,English,Rajasthani',
      city: 'jaipur',
      availability: AVAIL,
      kycStatus: 'APPROVED',
      isListed: true,
    },
  });
  await prisma.kycSubmission.create({
    data: { userId: priyaUser.id, idType: 'AADHAAR', idLast4: '4821', idDocPath: 'seed-id.svg', selfiePath: 'seed-selfie.svg', status: 'APPROVED', reviewerId: admin.id, reviewedAt: new Date() },
  });
  const pendingUser = await prisma.user.create({
    data: {
      phone: '+919000000003',
      name: 'Rohan Verma',
      dob: new Date('2000-01-20'),
      gender: 'MALE',
      city: 'pune',
      role: 'COMPANION',
      onboarded: true,
      guidelinesAccepted: new Date(),
      wallet: { create: {} },
    },
  });
  await prisma.companionProfile.create({
    data: {
      userId: pendingUser.id,
      headline: 'Your 6am accountability buddy',
      about: 'Gym regular for 6 years, happy to help you build a routine, spot you on big lifts and keep you consistent. Public gyms only.',
      hourlyRate: 399,
      categories: 'gym-partner,walk-and-talk',
      languages: 'Marathi,English,Hindi',
      city: 'pune',
      kycStatus: 'PENDING',
      isListed: false,
      availability: AVAIL,
    },
  });
  placeholderDoc('pending-id.svg', 'PAN •••• 7Q2K (sample)');
  placeholderDoc('pending-selfie.svg', 'LIVE SELFIE (sample)');
  await prisma.kycSubmission.create({ data: { userId: pendingUser.id, idType: 'PAN', idLast4: '7Q2K', idDocPath: 'pending-id.svg', selfiePath: 'pending-selfie.svg' } });

  // --- bookings in every state for the demo pair (member ↔ Priya) ---
  const ledger = async (userId: string, type: 'CREDIT' | 'DEBIT', amount: number, reason: string, refType?: string, refId?: string, at?: Date) => {
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const balance = w.balance + (type === 'CREDIT' ? amount : -amount);
    await prisma.wallet.update({ where: { id: w.id }, data: { balance } });
    await prisma.walletTxn.create({ data: { walletId: w.id, type, amount, reason, refType, refId, balanceAfter: balance, createdAt: at } });
  };
  await ledger(member.id, 'CREDIT', 500, 'Welcome credit 🎁', 'promo', 'welcome');

  const reviewers: string[] = [];
  for (let i = 0; i < 12; i++) {
    const u = await prisma.user.create({
      data: { phone: `+91${8000000000 + i}`, name: `${pick([...FIRST_F, ...FIRST_M])} ${pick(LAST)}`, dob: new Date('1998-01-01'), city: pick(CITIES).slug, onboarded: true, guidelinesAccepted: new Date(), wallet: { create: {} }, createdAt: new Date(Date.now() - Math.floor(rand() * 13) * DAY) },
    });
    reviewers.push(u.id);
  }

  const mk = async (o: {
    userId: string;
    companionUserId: string;
    rate: number;
    hours: number;
    category: string;
    startIn: number;
    status: string;
    escrow?: 'HELD' | 'RELEASED' | 'REFUNDED' | 'FROZEN';
    meetingPoint?: string;
  }) => {
    const q = quote(o.rate, o.hours);
    const startAt = new Date(Date.now() + o.startIn);
    // paid a day before the session (or a few hours ago for upcoming bookings) — keeps the admin charts realistic
    const paidAt = o.status === 'PENDING_PAYMENT' ? null : new Date(Math.min(startAt.getTime() - DAY, Date.now() - 3 * HOUR));
    const b = await prisma.booking.create({
      data: {
        userId: o.userId,
        companionUserId: o.companionUserId,
        category: o.category,
        startAt,
        endAt: new Date(startAt.getTime() + o.hours * HOUR),
        hours: o.hours,
        meetingPoint: o.meetingPoint ?? 'Tapri Central, C-Scheme',
        status: o.status,
        ...q,
        startCode: String(1000 + Math.floor(rand() * 8999)),
        paidAt,
        createdAt: paidAt ?? new Date(),
        acceptedAt: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'].includes(o.status) ? paidAt : null,
        startedAt: ['IN_PROGRESS', 'COMPLETED', 'DISPUTED'].includes(o.status) ? startAt : null,
        completedAt: o.status === 'COMPLETED' ? new Date(startAt.getTime() + o.hours * HOUR) : null,
      },
    });
    if (o.escrow) {
      const released = o.escrow === 'RELEASED' ? q.companionPayout : 0;
      const refunded = o.escrow === 'REFUNDED' ? q.total : 0;
      await prisma.escrow.create({
        data: { bookingId: b.id, amount: q.total, status: o.escrow, released, refunded, retained: o.escrow === 'RELEASED' ? q.total - released : 0, heldAt: paidAt ?? new Date(), settledAt: released || refunded ? new Date() : null },
      });
      if (released) await ledger(o.companionUserId, 'CREDIT', released, 'Earnings · completed booking', 'booking-earning', b.id, b.completedAt ?? undefined);
      await prisma.payment.create({ data: { bookingId: b.id, userId: o.userId, provider: 'mock', providerOrderId: `seed_${b.id}`, providerPaymentId: `seed_pay_${b.id}`, amount: q.total, status: 'PAID', createdAt: paidAt ?? undefined } });
    }
    return b;
  };

  // Priya's completed history with reviews
  const comments = [
    'Priya made Jaipur feel like home in one afternoon. Best kachori of my life!',
    'Super punctual, friendly and knows every hidden spot. 10/10.',
    'Great conversation, zero awkwardness. Will book again.',
    'Helped me find the perfect lehenga without getting scammed on price 😂',
    'Felt completely safe and comfortable. Highly recommend.',
  ];
  for (let i = 0; i < 5; i++) {
    const b = await mk({ userId: reviewers[i], companionUserId: priyaUser.id, rate: 499, hours: 2 + (i % 2), category: 'city-guide', startIn: -(i + 3) * DAY, status: 'COMPLETED', escrow: 'RELEASED' });
    await prisma.review.create({ data: { bookingId: b.id, authorId: reviewers[i], targetId: priyaUser.id, rating: i === 3 ? 4 : 5, comment: comments[i] } });
  }

  // reviews & completed bookings for other companions (for realistic ratings)
  for (const c of companions) {
    const n = Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const author = pick(reviewers);
      const b = await mk({ userId: author, companionUserId: c.userId, rate: c.rate, hours: 2, category: c.categories[0], startIn: -Math.floor(1 + rand() * 12) * DAY, status: 'COMPLETED', escrow: 'RELEASED' });
      await prisma.review.create({ data: { bookingId: b.id, authorId: author, targetId: c.userId, rating: rand() > 0.2 ? 5 : 4, comment: pick(['Lovely experience!', 'Really friendly and on time.', 'Made my weekend 🙌', 'Chill vibes, great company.', null as unknown as string]) } });
    }
  }

  // member's bookings: one upcoming confirmed, one awaiting acceptance, one completed-in-window, one past
  const upcoming = await mk({ userId: member.id, companionUserId: priyaUser.id, rate: 499, hours: 3, category: 'city-guide', startIn: 3 * DAY, status: 'ACCEPTED', escrow: 'HELD', meetingPoint: 'Hawa Mahal main gate' });
  await prisma.message.createMany({
    data: [
      { bookingId: upcoming.id, senderId: member.id, body: 'Hi Priya! Excited for the heritage walk 🙌', createdAt: new Date(Date.now() - 20 * HOUR) },
      { bookingId: upcoming.id, senderId: priyaUser.id, body: "Hey Aarav! Me too. Wear comfy shoes — we'll do Hawa Mahal → Johari Bazaar → kachori stop.", createdAt: new Date(Date.now() - 19 * HOUR) },
      { bookingId: upcoming.id, senderId: member.id, body: 'Perfect. Can I pay the guide fee at the fort on the spot?', createdAt: new Date(Date.now() - 18 * HOUR) },
      { bookingId: upcoming.id, senderId: priyaUser.id, body: 'Yep, entry tickets are separate. See you at the main gate!', createdAt: new Date(Date.now() - 17 * HOUR) },
    ],
  });
  const other = companions.find((c) => c.city === 'jaipur')!;
  await mk({ userId: member.id, companionUserId: other.userId, rate: other.rate, hours: 2, category: other.categories[0], startIn: 5 * DAY, status: 'REQUESTED', escrow: 'HELD', meetingPoint: 'World Trade Park, Malviya Nagar' });
  const past = await mk({ userId: member.id, companionUserId: priyaUser.id, rate: 499, hours: 2, category: 'coffee-chat', startIn: -10 * DAY, status: 'COMPLETED', escrow: 'RELEASED', meetingPoint: 'Curious Life Coffee Roasters' });
  await prisma.review.create({ data: { bookingId: past.id, authorId: member.id, targetId: priyaUser.id, rating: 5, comment: 'Such an easy, fun chat — gave me a whole list of places to explore.' } });

  // request waiting for Priya to accept
  await mk({ userId: reviewers[6], companionUserId: priyaUser.id, rate: 499, hours: 2, category: 'shopping-buddy', startIn: 2 * DAY, status: 'REQUESTED', escrow: 'HELD', meetingPoint: 'Bapu Bazaar entrance' });

  // disputed booking + open report + flagged message
  const mumbaiC = companions.find((c) => c.city === 'mumbai')!;
  const disputed = await mk({ userId: reviewers[7], companionUserId: mumbaiC.userId, rate: mumbaiC.rate, hours: 2, category: mumbaiC.categories[0], startIn: -1 * DAY, status: 'DISPUTED', escrow: 'FROZEN', meetingPoint: 'Carter Road promenade' });
  await prisma.dispute.create({ data: { bookingId: disputed.id, raisedById: reviewers[7], reason: 'Companion arrived 50 minutes late', details: 'We only had about an hour together out of the two I paid for.', previousStatus: 'COMPLETED' } });
  const flagged = await prisma.message.create({ data: { bookingId: disputed.id, senderId: mumbaiC.userId, body: "Let's just talk on •••, I'll send you my number", flagged: true, flagReason: 'phone,social-handle' } });
  await prisma.report.create({ data: { reporterId: reviewers[7], targetUserId: mumbaiC.userId, bookingId: disputed.id, messageId: flagged.id, reason: 'SCAM_OR_OFF_PLATFORM_PAYMENT', details: 'Kept asking to move to WhatsApp and pay directly next time.' } });

  // payout request from Priya
  const payout = await prisma.payout.create({ data: { userId: priyaUser.id, amount: 1000, upiId: 'priya.rathore@okaxis' } });
  await ledger(priyaUser.id, 'DEBIT', 1000, 'Payout to priya.rathore@okaxis', 'payout', payout.id);

  // resolved SOS (history)
  await prisma.sosAlert.create({ data: { bookingId: upcoming.id, userId: member.id, lat: 26.9239, lng: 75.8267, status: 'RESOLVED', note: 'Accidental press — confirmed safe by phone.', resolvedAt: new Date(Date.now() - DAY), createdAt: new Date(Date.now() - DAY - HOUR) } });

  // notifications for the demo member
  await prisma.notification.createMany({
    data: [
      { userId: member.id, type: 'booking.accepted', title: 'Priya accepted your booking ✅', body: 'See you at Hawa Mahal main gate.', link: `/bookings/${upcoming.id}` },
      { userId: member.id, type: 'promo', title: 'Welcome to Companio 👋', body: '₹500 welcome credit added to your wallet.', link: '/wallet', readAt: new Date() },
    ],
  });

  // recompute ratings
  const profiles = await prisma.companionProfile.findMany();
  for (const p of profiles) {
    const agg = await prisma.review.aggregate({ where: { targetId: p.userId, hidden: false }, _avg: { rating: true }, _count: true });
    const done = await prisma.booking.count({ where: { companionUserId: p.userId, status: 'COMPLETED' } });
    await prisma.companionProfile.update({ where: { id: p.id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count, completedBookings: done } });
  }

  console.log(`✅ seeded ${profiles.length} companions`);
  console.log('   admin     →', adminEmail, '/', process.env.ADMIN_PASSWORD ?? 'admin12345');
  console.log('   member    → +91 90000 00001 (OTP shown in API response in dev)');
  console.log('   companion → +91 90000 00002 (Priya, Jaipur)');
  console.log('   pending   → +91 90000 00003 (Rohan, KYC under review)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
