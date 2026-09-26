import type { Metadata } from 'next';
import { Card, Callout } from '@companio/ui';
import { PageHeader } from '@/components/misc';

export const metadata: Metadata = { title: 'Safety', description: 'ID verification, escrow, live location, SOS and moderation — how Companio keeps members and companions safe.', alternates: { canonical: '/safety' } };

const BLOCKS = [
  { e: '🪪', t: 'Verified companions', b: 'Government ID + live-selfie liveness check before any companion is listed. Our team reviews every submission manually.' },
  { e: '📱', t: 'Verified members', b: 'Every member signs up with an OTP-verified mobile number and confirms they’re 18+.' },
  { e: '🔢', t: 'Start codes', b: 'Sessions only begin when the member shares their 4-digit code in person — so both sides know they met the right person.' },
  { e: '📍', t: 'Live location', b: 'Share your live location during a booking. Our safety team can see it if you trigger SOS.' },
  { e: '🚨', t: 'SOS button', b: 'Visible on every active booking. It alerts our 24/7 safety team instantly with your location. Always call 112 in an emergency.' },
  { e: '🔐', t: 'Escrow', b: 'Payments are held until the session happens. No cash, no off-platform deals, automatic refunds for no-shows.' },
  { e: '🙈', t: 'Private chat', b: 'Phone numbers, emails, UPI IDs and links are automatically hidden in chat until you’re comfortable.' },
  { e: '🚩', t: 'Report & block', b: 'Report any person or message in two taps. Blocking stops all contact. Our moderators act fast — up to permanent bans.' },
];

export default function SafetyPage() {
  return (
    <div className="container-x max-w-5xl">
      <PageHeader eyebrow="Safety" title="Safety isn’t a feature. It’s the product." subtitle="Here’s everything we do — and what you can do — to make every meetup feel safe." />
      <Callout tone="pink" title="In immediate danger?" className="mb-8">
        Call <a className="font-bold underline" href="tel:112">112</a> (national emergency) first, then use SOS in the app.
      </Callout>
      <div className="grid gap-4 sm:grid-cols-2">
        {BLOCKS.map((b) => (
          <Card key={b.t} className="p-5">
            <span className="text-3xl">{b.e}</span>
            <h2 className="mt-2 text-lg font-extrabold">{b.t}</h2>
            <p className="mt-1 text-sm text-ink-soft">{b.b}</p>
          </Card>
        ))}
      </div>
      <Card tone="lime" className="mt-10 p-6">
        <h2 className="text-xl font-extrabold">Our tips for every meetup</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-soft">
          <li>Always meet in a busy public place. Never at a home, hotel or secluded spot.</li>
          <li>Tell a friend where you’re going and share your live location.</li>
          <li>Keep chat and payment on Companio. Anyone asking to move off-platform is a red flag.</li>
          <li>Arrange your own transport. Don’t accept rides from someone you’ve just met.</li>
          <li>Trust your gut — you can end a session at any time.</li>
        </ul>
      </Card>
    </div>
  );
}
