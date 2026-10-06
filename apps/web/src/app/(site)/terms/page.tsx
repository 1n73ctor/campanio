import type { Metadata } from 'next';
import { PageHeader, Prose } from '@/components/misc';

export const metadata: Metadata = { title: 'Terms of service', alternates: { canonical: '/terms' } };

export default function Terms() {
  return (
    <div className="container-x max-w-3xl pb-10">
      <PageHeader title="Terms of service" subtitle="Template — have counsel review before launch." />
      <Prose>
        <p>These terms govern your use of Companio (“we”, “us”). By creating an account you agree to them and to our Community Guidelines.</p>
        <h2>Eligibility</h2>
        <p>You must be 18 or older and able to form a binding contract under Indian law.</p>
        <h2>What Companio is</h2>
        <p>Companio is a marketplace connecting members with independent hosts for platonic, in-person activities in public places. Hosts are not our employees. We are not a dating, escort or adult service and prohibit any such use.</p>
        <h2>Payments & fees</h2>
        <p>Members pay the host’s rate plus a connection fee and applicable GST. Payments are held in escrow and released per the cancellation and dispute policy described on the How it works page. Hosts receive their rate minus the platform commission.</p>
        <h2>Cancellations, refunds & disputes</h2>
        <p>Refunds are credited to your Companio wallet. Disputes must be raised within 24 hours of a session. Our decision on disputes is final within the platform.</p>
        <h2>Conduct</h2>
        <p>You agree to follow the Community Guidelines. We may suspend or terminate accounts that violate them.</p>
        <h2>Liability</h2>
        <p>To the extent permitted by law, Companio is not liable for the conduct of users. Use safety features and meet in public.</p>
        <h2>Account deletion</h2>
        <p>You can delete your account anytime from Account settings. We retain transaction records as required by law.</p>
      </Prose>
    </div>
  );
}
