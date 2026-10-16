import { Global, Injectable, Logger, Module } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../common/config';
import { welcomeEmail } from './templates';

/**
 * Outgoing email through the mailbox's SMTP server (Hostinger: smtp.hostinger.com:465).
 * Never throws: a mail problem must not break sign-up. Off until SMTP_* is set.
 */
@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private transport: Transporter | null = null;

  get enabled() {
    return !!(config.mail.host && config.mail.user && config.mail.pass);
  }

  private tx() {
    if (!this.transport)
      this.transport = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465,
        auth: { user: config.mail.user, pass: config.mail.pass },
        connectionTimeout: 15_000,
      });
    return this.transport;
  }

  async send(to: string, mail: { subject: string; html: string; text: string }) {
    if (!this.enabled) return false;
    try {
      await this.tx().sendMail({ from: config.mail.from, replyTo: config.mail.replyTo, to, ...mail });
      return true;
    } catch (e) {
      this.log.error(`email "${mail.subject}" not sent: ${(e as Error).message}`);
      return false;
    }
  }

  /** Once, when someone finishes signing up. */
  sendWelcome(to: string, name: string | null, welcomeCredit: number) {
    return this.send(to, welcomeEmail({ name, welcomeCredit, siteUrl: config.webUrl }));
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
