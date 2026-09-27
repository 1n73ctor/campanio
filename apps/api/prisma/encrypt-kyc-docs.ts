/* eslint-disable no-console */
/**
 * Encrypts ID documents that were stored before encryption at rest existed. Safe to run any number of times:
 * already-encrypted files are skipped. deploy.sh runs it on every deploy.
 */
import '../src/common/env';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PRIVATE_DIR, encryptDoc, isEncryptedDoc } from '../src/files/uploads';

if (!process.env.KYC_ENCRYPTION_KEY) {
  console.log('KYC_ENCRYPTION_KEY not set — skipping (documents stay unencrypted)');
  process.exit(0);
}
let done = 0;
for (const name of readdirSync(PRIVATE_DIR)) {
  const path = join(PRIVATE_DIR, name);
  const data = readFileSync(path);
  if (isEncryptedDoc(data)) continue;
  writeFileSync(path, encryptDoc(data), { mode: 0o600 });
  done++;
}
console.log(`✅ encrypted ${done} document(s) in ${PRIVATE_DIR}`);
