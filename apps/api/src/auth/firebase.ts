import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** Google's public keys for Firebase Auth ID tokens (rotated by Google; jose caches them). */
const FIREBASE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let googleKeys: JWTVerifyGetKey | null = null;

/** How recently the user must have entered the SMS code — we swap the token for a 30-day session, so it must be fresh. */
const MAX_AUTH_AGE_MS = 10 * 60_000;

/**
 * Verifies a Firebase Auth ID token from a phone-number sign-in, following Firebase's documented checks
 * (RS256 signature by Google, issuer/audience = our project, subject present, auth_time in the past).
 * Returns the verified phone number; throws on anything else.
 */
export async function verifyFirebasePhoneToken(idToken: string, projectId: string, keys?: JWTVerifyGetKey): Promise<{ uid: string; phone: string }> {
  const { payload } = await jwtVerify(idToken, keys ?? (googleKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS))), {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (!payload.sub) throw new Error('token has no subject');

  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time * 1000 : NaN;
  const now = Date.now();
  if (!(authTime <= now + 60_000)) throw new Error('auth_time is missing or in the future');
  if (now - authTime > MAX_AUTH_AGE_MS) throw new Error('sign-in is too old; verify the phone again');

  const provider = (payload.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  if (provider !== 'phone') throw new Error(`expected a phone sign-in, got "${provider}"`);

  const phone = payload.phone_number;
  if (typeof phone !== 'string' || !/^\+91[6-9]\d{9}$/.test(phone)) throw new Error('only Indian mobile numbers are supported');
  return { uid: payload.sub, phone };
}
