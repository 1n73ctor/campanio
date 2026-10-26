import { formatINR, type Category, type City } from '@companio/types';
import type { CityGuide } from '@companio/types';
import { CITY_GUIDES } from './city-guides';

/** Unique copy for each category × city landing page so they don't read as duplicate content. */
/** `rates`: hourly rates of the hosts listed on the page, for a real price range. */
export function landingCopy(cat: Category, city?: City, rates: number[] = [], stored?: CityGuide) {
  const where = city ? ` in ${city.name}` : '';
  const title = city ? `Find a ${cat.noun} in ${city.name}` : `Find a ${cat.noun} near you`;
  const description = city
    ? `Meet a verified, ID-checked ${cat.noun} in ${city.name}. ${cat.blurb} Transparent pricing, secure escrow payments, live-location sharing and 24/7 SOS.`
    : `Meet a verified ${cat.noun} in cities across India. ${cat.blurb} Strictly platonic, safety-first, pay securely via UPI.`;
  const faqs = [
    {
      q: `How much does a ${cat.noun}${where} cost?`,
      a:
        rates.length > 0
          ? `Hosts set their own hourly rate. Right now, ${cat.name.toLowerCase()} hosts${where} on Companio charge ${
              Math.min(...rates) === Math.max(...rates) ? formatINR(rates[0]) : `between ${formatINR(Math.min(...rates))} and ${formatINR(Math.max(...rates))}`
            } per hour. You also pay a small connection fee (plus GST) that keeps the platform safe. You'll see the full breakdown before paying.`
          : `Hosts set their own hourly rate — most${where} charge between ₹299 and ₹999 per hour. You also pay a small connection fee (plus GST) that keeps the platform safe. You'll see the full breakdown before paying.`,
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
  // a guide published from Admin → City guides wins over the built-in one
  const guide = city ? (stored ?? CITY_GUIDES[city.slug]) : undefined;
  return { title, description, faqs: [...faqs, ...(guide?.faqs ?? [])], guide, spots: guide?.spots[cat.slug] };
}
