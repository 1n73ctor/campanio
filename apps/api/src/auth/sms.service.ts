import { Injectable, Logger } from '@nestjs/common';
import { config } from '../common/config';

/** SMS gateway seam. Swap the body of `send` for MSG91 / Twilio / Gupshup in production. */
@Injectable()
export class SmsService {
  private log = new Logger('SMS');
  async send(phone: string, text: string) {
    if (config.smsProvider === 'console') {
      this.log.log(`→ ${phone}: ${text}`);
      return;
    }
    throw new Error(`SMS provider "${config.smsProvider}" is not configured`);
  }
}
