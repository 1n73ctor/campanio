import type { Category, City } from '@companio/types';

/** Unique copy for each category × city landing page so they don't read as duplicate content. */
export function landingCopy(cat: Category, city?: City) {
  const where = city ? ` in ${city.name}` : '';
  const title = city ? `Hire a ${cat.noun} in ${city.name}` : `Find a ${cat.noun} near you`;
  const description = city
    ? `Book a verified, ID-checked ${cat.noun} in ${city.name}. ${cat.blurb} Transparent pricing, secure escrow payments, live-location sharing and 24/7 SOS.`
    : `Book a verified ${cat.noun} in cities across India. ${cat.blurb} Strictly platonic, safety-first, pay securely via UPI.`;
  const faqs = [
    {
      q: `How much does a ${cat.noun}${where} cost?`,
      a: `Companions set their own hourly rate — most${where} charge between ₹299 and ₹999 per hour. You also pay a small connection fee (plus GST) that keeps the platform safe. You'll see the full breakdown before paying.`,
    },
    {
      q: `Is it safe to meet a ${cat.noun} through Companio?`,
      a: 'Every companion is ID-verified with a live selfie check. Meetups happen in public places, the session only starts when you share your 4-digit code in person, you can share live location with a trusted contact, and SOS reaches our safety team instantly.',
    },
    {
      q: 'Is Companio a dating app?',
      a: 'No. Companio is strictly platonic — think friend-for-hire for activities. Any sexual or romantic solicitation gets accounts banned.',
    },
    {
      q: 'What if my companion cancels or doesn’t show up?',
      a: 'Your payment sits in escrow until the session happens. If the companion declines, cancels or never starts the session, you get a full refund to your wallet automatically.',
    },
  ];
  return { title, description, faqs };
}
