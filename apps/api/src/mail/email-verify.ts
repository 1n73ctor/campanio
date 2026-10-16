import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../common/config';

const DAYS = 7;
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (payload: string) => createHmac('sha256', `email-verify:${config.jwtSecret}`).update(payload).digest('base64url');

/** A signed link token proving whoever opens it can read this inbox. Tied to the address, so changing it voids old links. */
export function emailVerifyToken(userId: string, email: string) {
  const payload = b64(JSON.stringify({ u: userId, e: email.toLowerCase(), x: Date.now() + DAYS * 86400_000 }));
  return `${payload}.${sign(payload)}`;
}

export function readEmailVerifyToken(token: string): { userId: string; email: string } | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u: string; e: string; x: number };
    return typeof u === 'string' && typeof e === 'string' && x > Date.now() ? { userId: u, email: e } : null;
  } catch {
    return null;
  }
}

export const emailVerifyUrl = (userId: string, email: string) => `${config.webUrl}/verify-email?token=${emailVerifyToken(userId, email)}`;
