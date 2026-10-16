import { formatINR } from '@companio/types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Branded, table-based HTML (works in Gmail/Outlook) + a plain-text version. */
export function welcomeEmail({ name, welcomeCredit, siteUrl, verifyUrl }: { name: string | null; welcomeCredit: number; siteUrl: string; verifyUrl: string }) {
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
<p style="margin:0 0 16px;font-size:16px;line-height:1.55;background:#FFF8EE;border:2px solid #141414;border-radius:14px;padding:12px 14px"><b>One quick thing:</b> confirm this is your email so we can send your meetup confirmations and receipts.<br><br>${btn(verifyUrl, 'Confirm my email', '#FF7AC6')}</p>
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

One quick thing: confirm this is your email so we can send your meetup confirmations and receipts: ${verifyUrl}

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

/** Any important notification as an email: title, message, optional detail rows, one button. */
export function notificationEmail({ firstName, title, body, details, button, siteUrl }: {
  firstName: string;
  title: string;
  body: string;
  details?: [string, string][];
  button?: { url: string; label: string };
  siteUrl: string;
}) {
  const rows = (details ?? [])
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b6b6b;font-size:14px;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-size:14px;font-weight:700">${esc(v)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#FFF8EE;font-family:Arial,Helvetica,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8EE;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:3px solid #141414;border-radius:24px">
<tr><td style="background:#FF7AC6;border-radius:20px 20px 0 0;padding:18px 28px;font-weight:800;font-size:20px">Companio</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:14px;color:#6b6b6b">Hi ${esc(firstName)},</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">${esc(title)}</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.55;white-space:pre-line">${esc(body)}</p>
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:2px solid #141414;border-radius:14px;padding:10px 16px;background:#FFF8EE">${rows}</table>` : ''}
${button ? `<p style="margin:0"><a href="${button.url}" style="display:inline-block;background:#C6F432;color:#141414;border:3px solid #141414;border-radius:999px;padding:12px 24px;font-weight:800;text-decoration:none;font-size:16px">${esc(button.label)} →</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;border-top:2px solid #eee;font-size:12px;color:#6b6b6b;line-height:1.6">You’re getting this because of activity on your Companio account. Feel unsafe during a meetup? Use SOS in the app or call 112. Questions? Reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Hi ${firstName},\n\n${title}\n\n${body}\n${(details ?? []).map(([k, v]) => `\n${k}: ${v}`).join('')}${button ? `\n\n${button.label}: ${button.url}` : ''}\n\n— Companio (${siteUrl.replace(/^https?:\/\//, '')}). Feel unsafe during a meetup? Use SOS in the app or call 112.`;
  return { subject: title, html, text };
}

/** "Confirm your email" — the link proves the address is theirs (and has no typo) before we send anything else there. */
export function verifyEmail({ firstName, verifyUrl, siteUrl }: { firstName: string; verifyUrl: string; siteUrl: string }) {
  const m = notificationEmail({
    firstName,
    title: 'Confirm your email address',
    body: 'Tap the button to confirm this is your email. We’ll use it for meetup confirmations, receipts and important account updates — never for spam, and it’s never shown to anyone.\n\nThe link works for 7 days. Didn’t add this email to Companio? Just ignore this message.',
    button: { url: verifyUrl, label: 'Confirm my email' },
    siteUrl,
  });
  return { ...m, subject: 'Confirm your email for Companio' };
}
