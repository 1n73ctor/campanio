import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../common/config';

/**
 * Login codes on WhatsApp through Meta's WhatsApp Cloud API, using an approved "Authentication" template (Meta writes
 * its text: "<code> is your verification code…" with a Copy code button). People without WhatsApp get the code by SMS
 * (Firebase) instead: the website switches when this send fails, when Meta reports it undelivered (webhook), or when
 * they tap "Send by SMS instead".
 */
@Injectable()
export class WhatsAppService {
  private log = new Logger('WhatsApp');

  get enabled() {
    return !!(config.whatsapp.token && config.whatsapp.phoneNumberId && config.whatsapp.template);
  }

  /** Sends the code. Returns Meta's message id, or throws (the caller falls back to SMS). */
  async sendOtp(phone: string, code: string): Promise<string> {
    const { token, phoneNumberId, template, language, apiVersion, apiBase } = config.whatsapp;
    const r = await fetch(`${apiBase}/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            // the "Copy code" button carries the same code
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string } };
    const id = body.messages?.[0]?.id;
    if (!r.ok || !id) {
      this.log.warn(`code not sent on WhatsApp (${r.status} ${body.error?.code ?? ''}): ${body.error?.message ?? 'no message id'}`);
      throw new Error(body.error?.message ?? 'WhatsApp send failed');
    }
    return id;
  }

  /** Meta signs webhook calls with the app secret (X-Hub-Signature-256: sha256=<hex>). */
  verifySignature(raw: Buffer | undefined, header: string | undefined) {
    if (!config.whatsapp.appSecret || !raw || !header?.startsWith('sha256=')) return false;
    const want = Buffer.from(createHmac('sha256', config.whatsapp.appSecret).update(raw).digest('hex'));
    const got = Buffer.from(header.slice(7));
    return want.length === got.length && timingSafeEqual(want, got);
  }
}
