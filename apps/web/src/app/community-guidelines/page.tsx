import type { Metadata } from 'next';
import { PageHeader, Prose } from '@/components/misc';

export const metadata: Metadata = { title: 'Community guidelines', alternates: { canonical: '/community-guidelines' } };

export default function Guidelines() {
  return (
    <div className="container-x max-w-3xl pb-10">
      <PageHeader eyebrow="Rules" title="Community guidelines" subtitle="Short version: be kind, be on time, keep it platonic and in public." />
      <Prose>
        <h2>1. Strictly platonic</h2>
        <p>Companio is for friendship and activities. <strong>Any sexual, romantic or intimate request — explicit or implied — is banned.</strong> So is sexual content in photos, profiles or chat. Violations lead to a permanent ban and, where required, reporting to authorities.</p>
        <h2>2. 18+ only</h2>
        <p>You must be at least 18 years old. We verify companions’ age via government ID.</p>
        <h2>3. Public places only</h2>
        <p>Meet at cafés, malls, gyms, parks, monuments, venues. Never at private residences or hotel rooms.</p>
        <h2>4. Keep it on Companio</h2>
        <p>No off-platform payments, no pushing for personal numbers or social handles before you’re both comfortable. Chat automatically hides contact details.</p>
        <h2>5. Respect & consent</h2>
        <p>No harassment, hate speech, threats or discrimination. “No” means no — for anything. Either person can end a session at any time.</p>
        <h2>6. Be reliable</h2>
        <p>Show up on time. Cancel early if you must. Repeated late cancellations or no-shows affect your standing.</p>
        <h2>7. Honest profiles</h2>
        <p>Use your real name and recent photos. Impersonation and fake profiles are removed.</p>
        <h2>Enforcement</h2>
        <p>Our moderators review reports and flagged messages daily. Actions range from warnings to suspension to permanent bans, depending on severity.</p>
      </Prose>
    </div>
  );
}
