import { constants, publicEncrypt } from 'crypto';
import { readFileSync } from 'fs';
import type { KycOptionsDto, VerificationMode } from '@companio/types';
import { config } from '../common/config';
import { demoDigilocker } from './demo-digilocker';

/**
 * Cashfree Secure ID (verification) API: DigiLocker, face liveness and face match.
 * Docs: https://www.cashfree.com/docs/api-reference/vrs/getting-started
 * Uses the Secure ID keys (not the payment gateway keys). The server's IP must be whitelisted in Cashfree, or a
 * public key configured (CASHFREE_VRS_PUBLIC_KEY_PATH) so every request carries a signature.
 */
export class CashfreeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export type DigilockerStatus = 'PENDING' | 'AUTHENTICATED' | 'EXPIRED' | 'CONSENT_DENIED';

export interface DigilockerAadhaar {
  status: string; // SUCCESS | AADHAAR_NOT_LINKED | …
  name: string | null;
  dob: string | null; // DD-MM-YYYY
  gender: string | null; // M | F | T
  uid: string | null; // masked, e.g. xxxxxxxx5647
  photo_link: string | null; // base64 JPEG
  year_of_birth?: number | null;
}

const API_VERSION = '2024-12-01';
const TIMEOUT_MS = 20_000;

let publicKey: string | null | undefined;
function signature(): string | null {
  if (publicKey === undefined) publicKey = config.cashfree.publicKeyPath ? readFileSync(config.cashfree.publicKeyPath, 'utf8') : null;
  if (!publicKey) return null;
  // clientId.unixTime, RSA-OAEP encrypted with Cashfree's public key; valid for 5 minutes
  const data = Buffer.from(`${config.cashfree.clientId}.${Math.floor(Date.now() / 1000)}`);
  return publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING }, data).toString('base64');
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown> | FormData): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    'x-client-id': config.cashfree.clientId,
    'x-client-secret': config.cashfree.clientSecret,
    'x-api-version': API_VERSION,
  };
  const sig = signature();
  if (sig) headers['x-cf-signature'] = sig;
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${config.cashfree.baseUrl}${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new CashfreeError(`Verification service unreachable (${(e as Error).name})`, 503);
  }
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!res.ok) throw new CashfreeError(data?.message ?? `Verification service error (HTTP ${res.status})`, res.status, data?.code);
  return { status: res.status, data };
}

/** JPEG or PNG (the only formats the face APIs take), sent as a file part */
const image = (buf: Buffer) => new Blob([new Uint8Array(buf)], { type: buf[0] === 0x89 ? 'image/png' : 'image/jpeg' });
const ext = (buf: Buffer) => (buf[0] === 0x89 ? 'png' : 'jpg');

/** live = real checks; sandbox = Cashfree's test environment (made-up identities); demo = pretend, on a laptop */
export function verificationMode(): VerificationMode {
  if (config.cashfree.demo) return 'demo';
  if (!config.cashfree.clientId || !config.cashfree.clientSecret) return 'off';
  return config.cashfree.baseUrl.includes('sandbox') ? 'sandbox' : 'live';
}

export function kycOptions(): KycOptionsDto {
  const mode = verificationMode();
  return { mode, digilocker: mode !== 'off', faceChecks: mode !== 'off' };
}

const demo = () => config.cashfree.demo;

export const cashfree = {
  enabled: () => verificationMode() !== 'off',

  /** A consent link (valid 10 minutes) where the user signs in to DigiLocker and shares their Aadhaar. */
  async createDigilockerUrl(verificationId: string, redirectUrl: string) {
    if (demo()) return demoDigilocker.createUrl(verificationId, redirectUrl);
    const { data } = await call<{ url: string; reference_id: number }>('POST', '/digilocker', {
      verification_id: verificationId,
      document_requested: ['AADHAAR'],
      redirect_url: redirectUrl,
    });
    if (!data.url?.startsWith('https://')) throw new CashfreeError('Verification service returned no DigiLocker link', 502);
    return data.url;
  },

  async digilockerStatus(verificationId: string) {
    if (demo()) return demoDigilocker.status(verificationId);
    const { data } = await call<{ status: DigilockerStatus }>('GET', `/digilocker?verification_id=${encodeURIComponent(verificationId)}`);
    return data.status;
  },

  /** null while DigiLocker is still preparing the document (HTTP 202) — ask again in a few seconds. */
  async digilockerAadhaar(verificationId: string): Promise<DigilockerAadhaar | null> {
    if (demo()) return demoDigilocker.aadhaar(verificationId);
    const { status, data } = await call<DigilockerAadhaar>('GET', `/digilocker/document/AADHAAR?verification_id=${encodeURIComponent(verificationId)}`);
    return status === 202 ? null : data;
  },

  /** Is this a live person, not a printed photo, screen or mask? */
  async faceLiveness(verificationId: string, selfie: Buffer) {
    if (demo()) return demoDigilocker.liveness();
    const f = new FormData();
    f.append('verification_id', verificationId);
    f.append('image', image(selfie), `selfie.${ext(selfie)}`);
    const { data } = await call<{ status: string; liveness?: boolean; liveness_score?: number }>('POST', '/face-liveness', f);
    return { passed: data.status === 'SUCCESS' && data.liveness === true, score: typeof data.liveness_score === 'number' ? data.liveness_score : null, status: data.status };
  },

  /** Are the two photos the same person? */
  async faceMatch(verificationId: string, selfie: Buffer, idPhoto: Buffer) {
    if (demo()) return demoDigilocker.match();
    const f = new FormData();
    f.append('verification_id', verificationId);
    f.append('first_image', image(selfie), `selfie.${ext(selfie)}`);
    f.append('second_image', image(idPhoto), `id.${ext(idPhoto)}`);
    f.append('threshold', String(config.cashfree.faceMatchThreshold));
    const { data } = await call<{ status: string; face_match_result?: string; face_match_score?: number }>('POST', '/face-match', f);
    return { matched: data.status === 'SUCCESS' && data.face_match_result === 'YES', score: typeof data.face_match_score === 'number' ? data.face_match_score : null, status: data.status };
  },
};
