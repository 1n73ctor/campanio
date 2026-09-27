import type { Metadata } from 'next';
import { Card, toneSolid, cn } from '@companio/ui';
import { ApplyForm } from '@/components/apply-form';
import { Faq } from '@/components/misc';

export const metadata: Metadata = {
  title: 'Become a companion — earn doing what you love',
  description: 'Get paid to be good company. Set your own rate and hours, get verified, and withdraw earnings to UPI. 18+, platonic-only.',
  alternates: { canonical: '/become-a-companion' },
};

const STEPS = [
  { t: 'Create your profile', b: 'Pick your activities, languages, city and hourly rate.', tone: 'pink' as const },
  { t: 'Verify your ID', b: 'Upload a government ID and take a live selfie. Reviewed within 24h.', tone: 'lime' as const },
  { t: 'Set availability', b: 'Choose the hours you’re free each week. Pause anytime.', tone: 'sky' as const },
  { t: 'Meet & earn', b: 'Accept requests, meet in public, get paid to your wallet after each session.', tone: 'sunny' as const },
];

export default function BecomePage() {
  return (
    <>
      <section className="border-b-3 border-ink bg-sunny">
        <div className="container-x py-14">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">Good company is a skill. Get paid for it.</h1>
          <p className="mt-4 max-w-2xl text-lg">Show people your city, spot them at the gym, be the plus-one who makes the party. You choose when, where and how much.</p>
        </div>
      </section>
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <Card key={s.t} className="p-5">
                <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full border-3 border-ink font-display font-extrabold', toneSolid[s.tone])}>{i + 1}</span>
                <h3 className="mt-3 font-extrabold">{s.t}</h3>
                <p className="mt-1 text-sm text-ink-soft">{s.b}</p>
              </Card>
            ))}
          </div>
          <Card tone="lavender" className="p-6">
            <h2 className="text-xl font-extrabold">The deal</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>💸 You keep <b>85%</b> of your rate — paid to your wallet after every session</li>
              <li>🏦 Withdraw to any UPI ID, usually within 24h</li>
              <li>🛡️ Members are phone-verified, 18+, and bound by the same guidelines</li>
              <li>🚫 Platonic only. No private residences, no hotel rooms, no exceptions</li>
              <li>🚨 SOS & live location protect you on every booking too</li>
            </ul>
          </Card>
          <Faq
            items={[
              { q: 'Who can become a companion?', a: 'Anyone 18+ with a valid government ID, a friendly attitude and reliability. We review every application.' },
              { q: 'How do payouts work?', a: 'The member’s payment is held in escrow. After the session (or the 24h review window), your earnings move to your Companio wallet. Withdraw to UPI anytime above ₹500.' },
              { q: 'What if a member makes me uncomfortable?', a: 'Leave, hit SOS if needed, and report them. We take every report seriously and ban people who break the rules.' },
            ]}
          />
        </div>
        <div>
          <ApplyForm />
        </div>
      </div>
    </>
  );
}
