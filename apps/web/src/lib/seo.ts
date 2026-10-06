import type { Category, City } from '@companio/types';

/** Unique copy for each category × city landing page so they don't read as duplicate content. */
export function landingCopy(cat: Category, city?: City) {
  const where = city ? ` in ${city.name}` : '';
  const title = city ? `Find a ${cat.noun} in ${city.name}` : `Find a ${cat.noun} near you`;
  const description = city
    ? `Meet a verified, ID-checked ${cat.noun} in ${city.name}. ${cat.blurb} Transparent pricing, secure escrow payments, live-location sharing and 24/7 SOS.`
    : `Meet a verified ${cat.noun} in cities across India. ${cat.blurb} Strictly platonic, safety-first, pay securely via UPI.`;
  const faqs = [
    {
      q: `How much does a ${cat.noun}${where} cost?`,
      a: `Hosts set their own hourly rate — most${where} charge between ₹299 and ₹999 per hour. You also pay a small connection fee (plus GST) that keeps the platform safe. You'll see the full breakdown before paying.`,
    },
    {
      q: `Is it safe to meet a ${cat.noun} through Companio?`,
      a: 'Every host is ID-verified with a live selfie check. Meetups happen in public places, the session only starts when you share your 4-digit code in person, you can share live location with a trusted contact, and SOS reaches our safety team instantly.',
    },
    {
      q: 'Is Companio a dating app?',
      a: 'No. Companio is strictly platonic — you meet a verified local host for an activity, nothing more. Any sexual or romantic solicitation gets accounts banned.',
    },
    {
      q: 'What if my host cancels or doesn’t show up?',
      a: 'Your payment sits in escrow until the session happens. If the host declines, cancels or never starts the session, you get a full refund to your wallet automatically.',
    },
  ];
  return { title, description, faqs };
}
