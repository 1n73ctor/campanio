/**
 * Lightweight chat moderation. Masks off-platform contact details (phone, email, UPI IDs, links) —
 * these are the #1 vector for scams and unsafe off-platform meetups — and flags sexual/solicitation
 * language for admin review. Companio is strictly platonic.
 */
const PHONE = /(?:\+?91[\s-]?)?\b[6-9]\d(?:[\s-]?\d){8}\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UPI = /\b[\w.-]{2,}@(?:ok\w+|ybl|ibl|axl|paytm|upi|apl|icici|sbi|hdfcbank)\b/gi;
const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;
const SOCIAL = /\b(?:whats\s?app|insta(?:gram)?|snap(?:chat)?|telegram)\b/gi;
const EXPLICIT = [
  'sex', 'sexy', 'nude', 'nudes', 'hookup', 'hook up', 'escort', 'massage with', 'happy ending', 'one night',
  'intimate', 'naked', 'bed', 'hotel room', 'fwb', 'friends with benefits', 'sugar daddy', 'sugar baby', 'overnight stay',
];
const EXPLICIT_RE = new RegExp(`\\b(?:${EXPLICIT.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i');

export interface FilterResult {
  body: string;
  flagged: boolean;
  reason: string | null;
}

export function filterMessage(input: string): FilterResult {
  const reasons: string[] = [];
  let body = input.trim();
  const mask = (re: RegExp, label: string) => {
    if (re.test(body)) {
      reasons.push(label);
      body = body.replace(re, '•••');
    }
    re.lastIndex = 0;
  };
  mask(UPI, 'upi');
  mask(EMAIL, 'email');
  mask(PHONE, 'phone');
  mask(LINK, 'link');
  if (SOCIAL.test(body)) reasons.push('social-handle');
  SOCIAL.lastIndex = 0;
  if (EXPLICIT_RE.test(body)) reasons.push('explicit');
  return { body, flagged: reasons.length > 0, reason: reasons.length ? reasons.join(',') : null };
}
