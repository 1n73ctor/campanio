import { Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { WhatsAppService } from './whatsapp.service';

type StatusEvent = { id?: string; status?: string; errors?: { code?: number; title?: string }[] };

/**
 * Delivery receipts from Meta for WhatsApp login codes (Meta app → WhatsApp → Configuration → Webhook, field
 * "messages"). A "failed" receipt (e.g. 131026: the number isn't on WhatsApp) lets the login page switch to SMS.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('whatsapp/webhook')
export class WhatsAppWebhookController {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
  ) {}

  /** Meta's one-time check when the webhook URL is saved. */
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    if (mode === 'subscribe' && config.whatsapp.verifyToken && token === config.whatsapp.verifyToken) return challenge;
    throw new ForbiddenException();
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') sig: string) {
    if (!this.wa.verifySignature(req.rawBody, sig)) throw new ForbiddenException('Invalid signature');
    const body = req.body as { entry?: { changes?: { value?: { statuses?: StatusEvent[] } }[] }[] };
    for (const entry of body.entry ?? [])
      for (const change of entry.changes ?? [])
        for (const s of change.value?.statuses ?? []) {
          if (!s.id || !s.status) continue;
          const err = s.errors?.[0];
          await this.prisma.otpCode.updateMany({
            where: { waMessageId: s.id },
            data: { waStatus: s.status, ...(err ? { waError: `${err.code ?? ''} ${err.title ?? ''}`.trim().slice(0, 200) } : {}) },
          });
        }
    return { ok: true };
  }
}
