import type { Metadata } from 'next';
import { PageHeader, Prose } from '@/components/misc';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <div className="container-x max-w-3xl pb-10">
      <PageHeader title="Privacy policy" subtitle="Template aligned with India’s DPDP Act 2023 — have counsel review before launch." />
      <Prose>
        <h2>What we collect</h2>
        <ul>
          <li>Account: mobile number, email, name, date of birth, city, optional gender, bio and photo.</li>
          <li>
            Companions: a live selfie and either a photo of a government ID or, if you verify with DigiLocker, the name, date of birth, gender, photo and last 4
            digits from your Aadhaar record — never the full Aadhaar number or your address. Stored encrypted, access-restricted. If you don’t finish
            verifying, the Aadhaar details are deleted within a few hours.
          </li>
          <li>Bookings, chat messages, reviews, reports and payment records.</li>
          <li>Location — only when you choose to share it during an active booking or trigger SOS.</li>
        </ul>
        <h2>Why</h2>
        <p>To run bookings and payments, keep users safe (verification, moderation, SOS), prevent fraud, and meet legal obligations.</p>
        <h2>Who sees what</h2>
        <p>Other users see your first name, photo, city and reviews. Phone numbers are never shown. ID documents are visible only to our verification team via short-lived links.</p>
        <p>
          Identity checks for companions (DigiLocker, and checking that the selfie is a live person matching the ID photo) are run for us by Cashfree Payments, a
          verification provider regulated in India. DigiLocker only shares your Aadhaar after you sign in and allow it.
        </p>
        <h2>Cookies & advertising</h2>
        <p>
          With your consent, we use Google Analytics and the Meta Pixel to measure which ads and pages bring people to Companio (page visits, sign-ups, bookings and
          payments, with booking value but never your messages, documents or location). Nothing is loaded if you decline, and you can change your choice anytime via
          “Cookie settings” in the footer. Invite links store the inviter’s code on your device for 30 days so the referral reward can be applied when you sign up.
        </p>
        <h2>Your rights</h2>
        <p>Access, correct or delete your data from Account settings or by emailing privacy@getcompanio.in. Deleting your account (confirmed with a code sent to your phone) hides your profile from everyone immediately and signs you out. For safety and legal reasons we keep a private record of the account — your details, bookings, payments, reports and verification — that only our trust & safety team can access, for as long as needed to handle safety investigations and meet legal obligations. You can later sign up again with the same number as a new account.</p>
        <h2>Security</h2>
        <p>Encryption in transit, access controls, audit logs for admin actions, and signed expiring URLs for sensitive files.</p>
      </Prose>
    </div>
  );
}
