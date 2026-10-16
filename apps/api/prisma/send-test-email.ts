/* eslint-disable no-console */
/**
 * Checks the email settings by sending the welcome email to an address of your choice:
 *   npm run mail:test -w @companio/api -- you@example.com
 */
import '../src/common/env';
import { MailService } from '../src/mail/mail.service';
import { config } from '../src/common/config';

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) throw new Error('Usage: npm run mail:test -w @companio/api -- you@example.com');
  const mail = new MailService();
  if (!mail.enabled) throw new Error('Email is off — set SMTP_HOST, SMTP_USER and SMTP_PASS in apps/api/.env');
  console.log(`Sending via ${config.mail.host}:${config.mail.port} as ${config.mail.from} …`);
  if (!(await mail.sendWelcome(to, 'Test', 0))) throw new Error('Not sent — see the error above (wrong password, or the mail server blocked it)');
  console.log(`✅ Sent to ${to} — check the inbox (and spam folder)`);
}
main().catch((e) => {
  console.error(`❌ ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
