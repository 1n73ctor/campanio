import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, buttonClass, toneSolid, cn } from '@companio/ui';
import { Faq, PageHeader } from '@/components/misc';

export const metadata: Metadata = { title: 'How it works', description: 'How meetup a host on Companio works — from search to escrow to meetup.', alternates: { canonical: '/how-it-works' } };

const STEPS = [
  { e: '🔎', t: 'Find your person', b: 'Filter by activity, city, price, language and gender. Every host is ID-verified with a live selfie, and every review comes from a real meetup.', tone: 'pink' as const },
  { e: '🗓️', t: 'Request a time', b: 'Choose a date, duration and a public meeting point. See the exact price — hourly rate + a small connection fee + GST — before you pay.', tone: 'lime' as const },
  { e: '🔐', t: 'Pay into escrow', b: 'Pay by UPI, card or wallet. The money is held safely until your session happens. If the host declines or doesn’t respond, you’re refunded automatically.', tone: 'sky' as const },
  { e: '💬', t: 'Chat & plan', b: 'Once paid, chat in-app to plan the details. Phone numbers and payment handles are hidden so nobody pushes you off-platform.', tone: 'lavender' as const },
  { e: '🤝', t: 'Meet with a start code', b: 'Your meetup shows a 4-digit start code. Share it when you meet in person — that starts the session. Live location and SOS are one tap away.', tone: 'sunny' as const },
  { e: '⭐', t: 'Confirm & review', b: 'Confirm it went well to release payment, and leave a review. Something off? Raise it within 24 hours and payment stays on hold while we review.', tone: 'tangerine' as const },
];

export default function HowItWorks() {
  return (
    <div className="container-x max-w-4xl">
      <PageHeader eyebrow="How it works" title="From “anyone free?” to plans in minutes" />
      <ol className="space-y-5">
        {STEPS.map((s, i) => (
          <li key={s.t}>
            <Card className="flex gap-5 p-6">
              <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-blob border-3 border-ink text-2xl', toneSolid[s.tone])}>{s.e}</span>
              <div>
                <h2 className="text-xl font-extrabold">
                  {i + 1}. {s.t}
                </h2>
                <p className="mt-1 text-ink-soft">{s.b}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <h2 className="mb-4 mt-14 text-2xl font-extrabold">Refunds & cancellations</h2>
      <Faq
        items={[
          { q: 'The host declined or never replied', a: 'Full 100% refund — including the connection fee and GST — straight to your Companio wallet.' },
          { q: 'I cancel before the host accepts', a: 'Full refund.' },
          { q: 'I cancel 24h+ before the start time', a: 'The host’s fee is refunded; the connection fee (which covers verification and safety) and GST are non-refundable after acceptance.' },
          { q: 'I cancel less than 24h before', a: '50% of the host’s fee is refunded. The rest compensates the host for holding the slot.' },
          { q: 'The host cancels', a: 'Always a full 100% refund — including the connection fee and GST — and it counts against their standing.' },
          { q: 'Something went wrong during the session', a: 'Tap “Report a problem” within 24 hours. Payment is frozen and our team reviews the chat and details, then decides on a full, partial or no refund.' },
        ]}
      />
      <div className="mt-10 text-center">
        <Link href="/explore" className={buttonClass('primary', 'lg')}>
          Find a companion
        </Link>
      </div>
    </div>
  );
}
