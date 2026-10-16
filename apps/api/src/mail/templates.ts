import { formatINR } from '@companio/types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Branded, table-based HTML (works in Gmail/Outlook) + a plain-text version. */
export function welcomeEmail({ name, welcomeCredit, siteUrl }: { name: string | null; welcomeCredit: number; siteUrl: string }) {
  const first = (name ?? '').trim().split(/\s+/)[0] || 'there';
  const credit = welcomeCredit > 0 ? `Your ${formatINR(welcomeCredit)} welcome credit is already in your wallet — it comes off your first meetup automatically.` : '';
  const btn = (href: string, label: string, bg: string, color = '#141414') =>
    `<a href="${href}" style="display:inline-block;background:${bg};color:${color};border:3px solid #141414;border-radius:999px;padding:12px 24px;font-weight:800;text-decoration:none;font-family:Arial,sans-serif;font-size:16px">${label}</a>`;
  const html = `<!doctype html><html><body style="margin:0;background:#FFF8EE;font-family:Arial,Helvetica,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8EE;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:3px solid #141414;border-radius:24px">
<tr><td style="background:#FF7AC6;border-radius:20px 20px 0 0;padding:22px 28px;font-weight:800;font-size:22px">Companio</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:28px;line-height:1.15">Welcome, ${esc(first)}! 👋</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.55">You’re in. Companio is the safe way to meet a verified local host for the things that are better together — coffee chats, city walks, food walks, festivals and more.</p>
${credit ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;background:#EDFBC0;border:2px solid #141414;border-radius:14px;padding:12px 14px">🎁 ${esc(credit)}</p>` : ''}
<p style="margin:0 0 20px">${btn(`${siteUrl}/explore`, 'Find your buddy →', '#C6F432')}</p>
<p style="margin:0 0 8px;font-weight:800;font-size:16px">Safe by design</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.7">✓ Every host is ID + live-selfie verified<br>📍 Meetups in public places only<br>🆘 Live location sharing and SOS on every meetup<br>💰 Your payment is held until you meet</p>
<p style="margin:0 0 8px;font-weight:800;font-size:16px">Good company yourself?</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.55">Host coffee chats, city walks or gym sessions — set your own hours and rate, and withdraw to UPI.</p>
<p style="margin:0 0 4px">${btn(`${siteUrl}/become-a-companion`, 'Become a host', '#ffffff')}</p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:2px solid #eee;font-size:12px;color:#6b6b6b;line-height:1.6">Companio is strictly platonic and 18+. You’re receiving this because you just created an account at ${esc(siteUrl.replace(/^https?:\/\//, ''))}. Questions? Just reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Welcome, ${first}!

You're in. Companio is the safe way to meet a verified local host for the things that are better together — coffee chats, city walks, food walks, festivals and more.
${credit ? `\n${credit}\n` : ''}
Find your buddy: ${siteUrl}/explore

Safe by design:
- Every host is ID + live-selfie verified
- Meetups in public places only
- Live location sharing and SOS on every meetup
- Your payment is held until you meet

Good company yourself? Become a host: ${siteUrl}/become-a-companion

Companio is strictly platonic and 18+. Questions? Just reply to this email.`;
  return { subject: `Welcome to Companio, ${first} 👋`, html, text };
}
