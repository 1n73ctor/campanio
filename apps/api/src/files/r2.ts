import { AwsClient } from 'aws4fetch';
import { config } from '../common/config';

/** Cloudflare R2 (S3-compatible) for public photos — on when all R2_* settings are present. */
export const r2Enabled = () => {
  const r = config.r2;
  return !!(r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket && r.publicUrl);
};

let client: AwsClient | null = null;
const aws = () => (client ??= new AwsClient({ accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey, service: 's3', region: 'auto' }));
const objectUrl = (key: string) => `https://${config.r2.accountId}.r2.cloudflarestorage.com/${config.r2.bucket}/${encodeURIComponent(key)}`;

/** Saves a public photo. File names are random and never reused, so browsers and Cloudflare may cache it for a year. */
export async function r2Put(key: string, body: Buffer, contentType: string) {
  const res = await aws().fetch(objectUrl(key), {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' },
  });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

export async function r2Exists(key: string) {
  const res = await aws().fetch(objectUrl(key), { method: 'HEAD' });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`R2 check failed (${res.status})`);
  return true;
}

export async function r2Get(key: string): Promise<Buffer | null> {
  const res = await aws().fetch(objectUrl(key));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
