import { Global, Injectable, Logger, Module } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../common/config';
import { CATEGORIES, formatINR } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { notificationEmail, welcomeEmail } from './templates';

/**
 * Notifications that also go out by email — things people need even when the app is closed. Chat, location and
 * small wallet extras stay in-app only. Admin broadcasts aren't emailed (one message to everyone would hit the
 * mailbox's sending limits and land in spam).
 */
const EMAIL_TYPES: Record<string, string> = {
  'kyc.submitted': 'Open dashboard',
  'kyc.approved': 'Set your availability',
  'kyc.rejected': 'Fix and re-submit',
  'companion.applied': 'Continue',
  'booking.requested': 'Review the request',
  'booking.accepted': 'View meetup',
  'booking.declined': 'Find another host',
  'booking.cancelled': 'View meetup',
  'booking.expired': 'View meetup',
  'booking.completed': 'Leave a review',
  'booking.paid_out': 'Open wallet',
  'booking.disputed': 'View meetup',
  'dispute.resolved': 'View meetup',
  'payment.captured': 'Continue',
  'payment.parked': 'Open wallet',
  refund: 'Open wallet',
  'wallet.refund': 'Open wallet',
  'payout.paid': 'Open wallet',
  'payout.rejected': 'Open wallet',
  'moderation.warning': 'Read the guidelines',
  'report.update': 'Open notifications',
  'review.new': 'See the review',
  'admin.message': 'Open Companio',
  sos: 'Open SOS alerts',
};
const IST = { timeZone: 'Asia/Kolkata' } as const;

/**
 * Outgoing email through the mailbox's SMTP server (Hostinger: smtp.hostinger.com:465).
 * Never throws: a mail problem must not break sign-up. Off until SMTP_* is set.
 */
@Injectable()
export class MailService {
  private log = new Logger('Mail');
  constructor(private prisma?: PrismaService) {}
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

  /** Emails an important notification (see EMAIL_TYPES), with the meetup's details when it's about one. Never throws. */
  async forNotification(userId: string, n: { type: string; title: string; body: string; link?: string }) {
    const label = EMAIL_TYPES[n.type];
    if (!label || !this.enabled || !this.prisma) return;
    try {
      const u = await this.prisma.user.findUnique({ where: { id: userId } });
      const to = u?.contactEmail ?? u?.email;
      if (!u || !to || u.status === 'DELETED') return;
      const url = n.link ? `${config.webUrl}${n.link.startsWith('/') ? n.link : `/${n.link}`}` : config.webUrl;
      const details = await this.meetupDetails(n.link, userId);
      await this.send(
        to,
        notificationEmail({ firstName: (u.name ?? '').trim().split(/\s+/)[0] || 'there', title: n.title, body: n.body, details, button: { url, label }, siteUrl: config.webUrl }),
      );
    } catch (e) {
      this.log.error(`notification email failed: ${(e as Error).message}`);
    }
  }

  /** Activity, when, where and the amount — from the reader's side (member pays, host earns). No start code. */
  private async meetupDetails(link: string | undefined, userId: string): Promise<[string, string][] | undefined> {
    const id = link?.match(/^\/bookings\/([\w-]+)/)?.[1];
    if (!id || !this.prisma) return undefined;
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { user: true, companion: true } });
    if (!b) return undefined;
    const isHost = b.companionUserId === userId;
    const other = (isHost ? b.user.name : b.companion.name)?.trim().split(/\s+/)[0] ?? '—';
    const when = `${b.startAt.toLocaleDateString('en-IN', { ...IST, weekday: 'short', day: 'numeric', month: 'short' })}, ${b.startAt.toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' })} (${b.hours}h)`;
    return [
      ['Activity', CATEGORIES.find((c) => c.slug === b.category)?.name ?? b.category],
      [isHost ? 'Member' : 'Host', other],
      ['When', when],
      ['Meeting point', b.meetingPoint],
      isHost ? ['You earn', formatINR(b.companionPayout)] : ['Total', formatINR(b.total)],
    ];
  }

  /** Once, when someone finishes signing up. */
  sendWelcome(to: string, name: string | null, welcomeCredit: number) {
    return this.send(to, welcomeEmail({ name, welcomeCredit, siteUrl: config.webUrl }));
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
