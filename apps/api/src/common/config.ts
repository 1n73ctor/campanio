import './env';
const bool = (v: string | undefined, d = false) => (v === undefined ? d : ['1', 'true', 'yes'].includes(v.toLowerCase()));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  publicApiUrl: (process.env.PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  webUrl: (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  otpDevEcho: bool(process.env.OTP_DEV_ECHO) && process.env.NODE_ENV !== 'production',
  smsProvider: process.env.SMS_PROVIDER ?? 'console',
  /** Firebase project whose phone sign-ins we accept (web sends the SMS through Firebase). Empty = disabled. */
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? 'mock') as 'mock' | 'razorpay',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  },
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  /** base64 of 32 random bytes; encrypts KYC documents at rest (openssl rand -base64 32) */
  kycEncryptionKey: process.env.KYC_ENCRYPTION_KEY ?? '',
  /**
   * Cashfree Secure ID: DigiLocker (Aadhaar) + face liveness + face match for companion verification.
   * Empty keys = off: companions upload a photo of their ID instead, and an admin checks it by eye.
   */
  cashfree: {
    /**
     * CASHFREE_VRS_ENV=demo: a pretend DigiLocker + face check served by this API, for trying the flow on a laptop
     * without a Cashfree account. Never on a production server (see productionProblems).
     */
    demo: process.env.CASHFREE_VRS_ENV === 'demo' && process.env.NODE_ENV !== 'production',
    clientId: process.env.CASHFREE_VRS_CLIENT_ID ?? '',
    clientSecret: process.env.CASHFREE_VRS_CLIENT_SECRET ?? '',
    baseUrl: (
      process.env.CASHFREE_VRS_BASE_URL ||
      (process.env.CASHFREE_VRS_ENV === 'production' ? 'https://api.cashfree.com/verification' : 'https://sandbox.cashfree.com/verification')
    ).replace(/\/$/, ''),
    /** only if you chose "Public Key" 2FA in Cashfree instead of whitelisting the server's IP */
    publicKeyPath: process.env.CASHFREE_VRS_PUBLIC_KEY_PATH ?? '',
    /** selfie ↔ ID photo similarity needed to count as the same person (Cashfree recommends 0.75) */
    faceMatchThreshold: Number(process.env.FACE_MATCH_THRESHOLD ?? 0.75),
  },
  /** serve the Swagger API docs (always on in development; off in production unless set) */
  docsEnabled: process.env.NODE_ENV !== 'production' || ['1', 'true', 'yes'].includes((process.env.API_DOCS ?? '').toLowerCase()),
};

/** Settings that must never reach a public server. Returns human-readable problems; empty = OK. */
export function productionProblems(): string[] {
  if (process.env.NODE_ENV !== 'production') return [];
  const p: string[] = [];
  if (config.jwtSecret === 'dev-secret-change-me' || config.jwtSecret.length < 32) p.push('JWT_SECRET must be a random string of 32+ characters (openssl rand -hex 48)');
  if (config.paymentProvider === 'mock' && !['1', 'true', 'yes'].includes((process.env.ALLOW_MOCK_PAYMENTS ?? '').toLowerCase()))
    p.push('PAYMENT_PROVIDER=mock lets anyone "pay" with the fake gateway — use razorpay (or set ALLOW_MOCK_PAYMENTS=true on a private staging server)');
  if (config.paymentProvider === 'razorpay' && (!config.razorpay.keyId || !config.razorpay.keySecret || !config.razorpay.webhookSecret))
    p.push('PAYMENT_PROVIDER=razorpay needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET');
  if (config.corsOrigins.some((o) => o.includes('localhost'))) p.push('CORS_ORIGINS still lists localhost — set it to your live website and admin URLs');
  // upload links (KYC documents, photos) are built from PUBLIC_API_URL, and photo links are saved in the database
  if (/localhost|127\.0\.0\.1/.test(config.publicApiUrl)) p.push('PUBLIC_API_URL points to localhost — set it to this API\'s public https:// address');
  if (/localhost|127\.0\.0\.1/.test(config.webUrl)) p.push('WEB_URL points to localhost — set it to your website\'s https:// address');
  if (Buffer.from(config.kycEncryptionKey, 'base64').length !== 32) p.push('KYC_ENCRYPTION_KEY must be 32 random bytes in base64 (openssl rand -base64 32) — it encrypts ID documents on disk');
  const cf = config.cashfree;
  if (process.env.CASHFREE_VRS_ENV === 'demo') p.push('CASHFREE_VRS_ENV=demo is a pretend DigiLocker for local testing — use production (or sandbox with ALLOW_SANDBOX_KYC=true)');
  if (!!cf.clientId !== !!cf.clientSecret) p.push('Set both CASHFREE_VRS_CLIENT_ID and CASHFREE_VRS_CLIENT_SECRET (or neither, to turn DigiLocker verification off)');
  // the sandbox approves every test identity, so a live site on it would "verify" anyone
  if (cf.clientId && cf.baseUrl.includes('sandbox') && !['1', 'true', 'yes'].includes((process.env.ALLOW_SANDBOX_KYC ?? '').toLowerCase()))
    p.push('Cashfree verification is on the sandbox — set CASHFREE_VRS_ENV=production with production keys (or ALLOW_SANDBOX_KYC=true on a private staging server)');
  if (!(cf.faceMatchThreshold > 0 && cf.faceMatchThreshold < 1)) p.push('FACE_MATCH_THRESHOLD must be between 0 and 1 (e.g. 0.75)');
  return p;
}
