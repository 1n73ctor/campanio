import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../common/config';

/** Private files (KYC docs, selfies) are only reachable through short-lived signed URLs handed to admins. */
export function signPrivateUrl(fileName: string, ttlSeconds = 15 * 60) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(fileName, exp);
  return `${config.publicApiUrl}/files/private/${encodeURIComponent(fileName)}?exp=${exp}&sig=${sig}`;
}

export function verifyPrivateSig(fileName: string, exp: number, sig: string) {
  if (!exp || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(fileName, exp));
  const given = Buffer.from(sig ?? '');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function sign(fileName: string, exp: number) {
  return createHmac('sha256', config.jwtSecret).update(`${fileName}:${exp}`).digest('hex');
}
