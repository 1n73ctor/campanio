import { Global, Injectable, Logger, Module } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../common/config';
import type { User } from '@prisma/client';
import { CATEGORIES, formatINR } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { notificationEmail, verifyEmail, welcomeEmail } from './templates';
import { emailVerifyUrl } from './email-verify';

/**
 * Notifications that also go out by email — things people need even when the app is closed. Chat, location and
 * small wallet extras stay in-app only. A message from an admin to one person is emailed separately (sendAdminMessage),
 * when the admin ticks "also email". Admin broadcasts aren't emailed (one message to everyone would hit the
 * mailbox's sending limits and land in spam).
 */
const EMAIL_TYPES: Record<string, string> = {
  'kyc.submitted': 'Open dashboard',
  'kyc.approved': 'Set your availability',
  'kyc.rejected': 'Fix and re-submit',
  'companion.applied': 'Continue',
  'booking.requested': 'Review the request',
  'chat.new': 'Reply now',
  'booking.accepted': 'View meetup',
  'booking.declined': 'Find another host',
  'booking.cancelled': 'View meetup',
  'booking.expired': 'View meetup',
  'booking.completed': 'Leave a review',
  'booking.paid_out': 'Open wallet',
  'booking.reminder': 'View meetup',
  'booking.disputed': 'View meetup',
  'dispute.resolved': 'View meetup',
  'payment.captured': 'Continue',
  'payment.parked': 'Open wallet',
  refund: 'Open wallet',
  'wallet.refund': 'Open wallet',
  'payout.requested': 'Open wallet',
  'payout.paid': 'Open wallet',
  'payout.rejected': 'Open wallet',
  'moderation.warning': 'Read the guidelines',
  'report.update': 'Open notifications',
  'review.new': 'See the review',
  sos: 'Open SOS alerts',
};
const IST = { timeZone: 'Asia/Kolkata' } as const;
const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || 'there';
const when = (d: Date) => `${d.toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' })}`;

/**
 * Where we may email someone: admins at their sign-in address; members only once they've confirmed their address
 * (a typo or someone else's address never gets meetup details).
 */
export function mailTo(u: Pick<User, 'role' | 'status' | 'email' | 'contactEmail' | 'contactEmailVerifiedAt'> | null) {
  if (!u || u.status === 'DELETED') return null;
  if (u.contactEmail && u.contactEmailVerifiedAt) return u.contactEmail;
  return u.role === 'ADMIN' ? u.email : null;
}

/**
 * Outgoing email through the mailbox's SMTP server (Hostinger: smtp.hostinger.com:465).
 * Never throws: a mail problem must not break sign-up. Off until SMTP_* is set.
 */
@Injectable()
export class MailService {
  private log = new Logger('Mail');
  constructor(
    private prisma?: PrismaService,
    private settings?: SettingsService,
  ) {}
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
      const to = mailTo(u);
      if (!u || !to) return;
      const url = n.link ? `${config.webUrl}${n.link.startsWith('/') ? n.link : `/${n.link}`}` : config.webUrl;
      const details = await this.meetupDetails(n.link, userId);
      await this.send(
        to,
        notificationEmail({ firstName: firstName(u.name), title: n.title, body: n.body, details, button: { url, label }, siteUrl: config.webUrl }),
      );
    } catch (e) {
      this.log.error(`notification email failed: ${(e as Error).message}`);
    }
  }

  /**
   * An admin's message to one person, by email as well. Goes to the address on their profile even if it isn't confirmed
   * yet: the admin wrote it and sees which address it goes to. Returns that address, or null if nothing was sent.
   */
  async sendAdminMessage(userId: string, n: { title: string; body: string; link?: string }) {
    if (!this.enabled || !this.prisma) return null;
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    const to = u && u.status !== 'DELETED' ? mailTo(u) ?? u.contactEmail : null;
    if (!u || !to) return null;
    const url = n.link ? `${config.webUrl}${n.link}` : config.webUrl;
    const sent = await this.send(to, notificationEmail({ firstName: firstName(u.name), title: n.title, body: n.body, button: { url, label: 'Open Companio' }, siteUrl: config.webUrl }));
    return sent ? to : null;
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

  /** Once, when someone finishes signing up. Carries the "confirm your email" button. */
  sendWelcome(u: Pick<User, 'id' | 'name' | 'contactEmail'>, welcomeCredit: number) {
    if (!u.contactEmail) return Promise.resolve(false);
    return this.send(u.contactEmail, welcomeEmail({ name: u.name, welcomeCredit, siteUrl: config.webUrl, verifyUrl: emailVerifyUrl(u.id, u.contactEmail) }));
  }

  /** "Confirm your email" (after changing it, or "resend link"). */
  sendVerification(u: Pick<User, 'id' | 'name' | 'contactEmail'>) {
    if (!u.contactEmail) return Promise.resolve(false);
    return this.send(u.contactEmail, verifyEmail({ firstName: firstName(u.name), verifyUrl: emailVerifyUrl(u.id, u.contactEmail), siteUrl: config.webUrl }));
  }

  /** Payment receipt with the GST breakdown, for a meetup or the host registration fee. Never throws. */
  async sendReceipt(paymentId: string) {
    if (!this.enabled || !this.prisma) return;
    try {
      const p = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { user: true, booking: { include: { companion: true } } } });
      const to = mailTo(p?.user ?? null);
      if (!p || p.status !== 'PAID' || !to) return;
      const paid: [string, string][] = [
        ...(p.walletAmount - p.walletPromo > 0 ? [['Paid from wallet', formatINR(p.walletAmount - p.walletPromo)] as [string, string]] : []),
        ...(p.walletPromo > 0 ? [['Paid with credit', formatINR(p.walletPromo)] as [string, string]] : []),
        ...(p.amount > 0 ? [['Paid online', formatINR(p.amount)] as [string, string]] : []),
      ];
      const ref: [string, string][] = [
        ['Receipt no.', p.id.slice(-10).toUpperCase()],
        ['Date', when(p.updatedAt)],
        ...(p.providerPaymentId && p.amount > 0 ? [['Payment ID', p.providerPaymentId] as [string, string]] : []),
      ];
      let title: string, body: string, details: [string, string][], link: string;
      const b = p.booking;
      if (b) {
        const category = CATEGORIES.find((c) => c.slug === b.category)?.name ?? b.category;
        title = `Receipt: ${category} with ${firstName(b.companion.name)}`;
        body = `Thanks — your payment is held safely until your meetup happens. ${firstName(b.companion.name)} has been asked to confirm; we’ll email you as soon as they do. If the host declines or cancels, you get it all back.`;
        details = [
          ['Meetup', `${category}, ${when(b.startAt)} (${b.hours}h)`],
          [`Host time (${b.hours}h × ${formatINR(b.hourlyRate)})`, formatINR(b.subtotal)],
          ['Connection fee', formatINR(b.connectionFee)],
          [`GST (${b.subtotal + b.connectionFee ? Math.round((b.gst * 100) / (b.subtotal + b.connectionFee)) : 18}%)`, formatINR(b.gst)],
          ['Total', formatINR(b.total)],
          ...paid,
          ...ref,
        ];
        link = `/bookings/${b.id}`;
      } else {
        const total = p.amount + p.walletAmount;
        const gstPct = (await this.settings?.get())?.gstPct ?? 18;
        const base = Math.round((total * 100) / (100 + gstPct));
        title = 'Receipt: host registration fee';
        body = 'Thanks — your host registration fee is paid. Next, finish your profile and verify your ID to go live.';
        details = [['Registration fee', formatINR(base)], [`GST (${gstPct}%)`, formatINR(total - base)], ['Total', formatINR(total)], ...paid, ...ref];
        link = '/become-a-companion';
      }
      await this.send(to, {
        ...notificationEmail({ firstName: firstName(p.user.name), title, body, details, button: { url: `${config.webUrl}${link}`, label: b ? 'View meetup' : 'Continue' }, siteUrl: config.webUrl }),
        subject: title,
      });
    } catch (e) {
      this.log.error(`receipt email failed: ${(e as Error).message}`);
    }
  }

  /** Something an admin has to act on (new ID verification to review, new dispute). Email only, to every active admin. */
  async toAdmins(title: string, body: string, link: string) {
    if (!this.enabled || !this.prisma) return;
    try {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      for (const a of admins) {
        const to = mailTo(a);
        if (to) await this.send(to, notificationEmail({ firstName: firstName(a.name), title, body, button: { url: `${config.webUrl}${link}`, label: 'Open admin panel' }, siteUrl: config.webUrl }));
      }
    } catch (e) {
      this.log.error(`admin alert email failed: ${(e as Error).message}`);
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
