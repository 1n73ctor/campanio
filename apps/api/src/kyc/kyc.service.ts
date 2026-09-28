import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DigilockerSession, User } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';
import { rmSync } from 'fs';
import { resolve } from 'path';
import type { AadhaarGender, DigilockerIdentityDto, KycFlag, KycOptionsDto, KycSubmissionDto } from '@companio/types';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { toKycDto } from '../common/mappers';
import { NotificationsService } from '../notifications/notifications.service';
import { CompanionFeeService } from '../companions/companion-fee.service';
import { PRIVATE_DIR, detectKind, readPrivateDoc, storePrivateBytes, storePrivateDoc } from '../files/uploads';
import { CashfreeError, cashfree, kycOptions, verificationMode } from './cashfree';

const MIN = 60_000;
/** a DigiLocker consent journey has to be finished within this time */
const JOURNEY_MS = 30 * MIN;
/** verified Aadhaar details wait this long for the selfie; after that they're deleted */
const VERIFIED_MS = 2 * 60 * MIN;
/** every journey costs money, so cap them per person */
const MAX_JOURNEYS_PER_DAY = 8;

const AADHAAR_GENDER: Record<string, AadhaarGender> = { M: 'MALE', F: 'FEMALE', T: 'TRANSGENDER' };

type Checks = { livenessPassed: boolean | null; livenessScore: number | null; faceMatched: boolean | null; faceMatchScore: number | null; flags: KycFlag[] };
type Upload = Express.Multer.File | undefined;

/**
 * Companion identity verification.
 *  - DigiLocker: the companion shares their Aadhaar record (name, DOB, gender, photo) through Cashfree — no document
 *    upload, nothing to forge. Their live selfie is checked for liveness and matched against the Aadhaar photo.
 *    If every check passes and auto-approval is on, they go live immediately.
 *  - Manual (fallback): photo of an ID + live selfie, with the same face checks when Cashfree is set up; always
 *    reviewed by an admin, since only a person can tell if an uploaded document is genuine.
 */
@Injectable()
export class KycService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Kyc');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private notifications: NotificationsService,
    private fee: CompanionFeeService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_JOBS === 'true') return;
    this.timer = setInterval(() => void this.purgeStale().catch((e) => this.log.error(e)), 15 * MIN);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  options(): KycOptionsDto {
    return kycOptions();
  }

  // ---------- DigiLocker ----------

  async startDigilocker(user: User) {
    if (!cashfree.enabled()) throw new ServiceUnavailableException('DigiLocker verification isn’t available right now — please upload your ID instead');
    await this.assertCanSubmit(user);
    const today = await this.prisma.digilockerSession.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * MIN) } } });
    if (today >= MAX_JOURNEYS_PER_DAY) throw new HttpException('Too many DigiLocker attempts today. Try again tomorrow, or upload your ID instead.', HttpStatus.TOO_MANY_REQUESTS);

    const verificationId = `dl_${randomBytes(16).toString('hex')}`;
    let url: string;
    try {
      url = await cashfree.createDigilockerUrl(verificationId, `${config.webUrl}/companion/kyc?dl=1`);
    } catch (e) {
      throw this.providerDown(e);
    }
    await this.prisma.digilockerSession.create({ data: { userId: user.id, verificationId } });
    return { url };
  }

  /** Called when the companion comes back from DigiLocker: fetch their Aadhaar record and keep what we need. */
  async completeDigilocker(user: User): Promise<DigilockerIdentityDto> {
    const s = await this.prisma.digilockerSession.findFirst({
      where: { userId: user.id, status: { in: ['PENDING', 'VERIFIED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!s) throw new BadRequestException('Start the DigiLocker verification first');
    if (s.status === 'VERIFIED') {
      if (fresh(s)) return identity(s);
      throw new BadRequestException('Your DigiLocker verification expired — please verify again');
    }
    if (Date.now() - s.createdAt.getTime() > JOURNEY_MS) {
      await this.fail(s, 'EXPIRED');
      throw new BadRequestException('That DigiLocker session expired — please start again');
    }

    let status: string;
    try {
      status = await cashfree.digilockerStatus(s.verificationId);
    } catch (e) {
      throw this.providerDown(e);
    }
    if (status === 'PENDING') throw new ConflictException('You haven’t finished in DigiLocker yet. Complete the steps there, or start again.');
    if (status === 'CONSENT_DENIED') {
      await this.fail(s, status);
      throw new BadRequestException('You chose not to share your Aadhaar. Start again and tap “Allow”, or upload your ID instead.');
    }
    if (status !== 'AUTHENTICATED') {
      await this.fail(s, status);
      throw new BadRequestException('The DigiLocker link expired — please start again');
    }

    let doc: Awaited<ReturnType<typeof cashfree.digilockerAadhaar>>;
    try {
      doc = await cashfree.digilockerAadhaar(s.verificationId);
    } catch (e) {
      throw this.providerDown(e);
    }
    if (!doc) throw new ConflictException('DigiLocker is still preparing your Aadhaar — try again in a few seconds');
    if (doc.status !== 'SUCCESS') {
      await this.fail(s, doc.status);
      throw new BadRequestException(
        doc.status === 'AADHAAR_NOT_LINKED'
          ? 'There’s no Aadhaar in your DigiLocker yet. Link it in the DigiLocker app, or upload your ID instead.'
          : 'We couldn’t read your Aadhaar from DigiLocker — please upload your ID instead.',
      );
    }

    const name = (doc.name ?? '').trim();
    const last4 = (doc.uid ?? '').replace(/\D/g, '').slice(-4);
    const dob = parseDob(doc.dob);
    const birthYear = dob?.getUTCFullYear() ?? (Number(doc.year_of_birth) || null);
    if (!name || last4.length !== 4 || !birthYear) {
      await this.fail(s, 'INCOMPLETE_RECORD');
      throw new BadRequestException('Your Aadhaar record is missing details we need — please upload your ID instead.');
    }
    // conservative when only the year is known: born in 2008 counts as 17 until the whole of 2026 has passed
    const age = dob ? ageOn(dob) : new Date().getUTCFullYear() - birthYear - 1;
    if (age < 18) {
      await this.fail(s, 'UNDER_18');
      throw new ForbiddenException(
        dob ? 'Companions must be 18 or older, and your Aadhaar shows you’re under 18.' : 'Your Aadhaar only shows your year of birth, so we can’t confirm you’re 18 — please upload your ID instead.',
      );
    }
    const photo = doc.photo_link ? Buffer.from(doc.photo_link, 'base64') : null;
    const photoKind = photo ? detectKind(photo) : null;
    const photoPath = photo && (photoKind === 'jpg' || photoKind === 'png') ? storePrivateBytes(photo) : null;

    // only one request gets to turn this journey into a verified identity
    const done = await this.prisma.digilockerSession.updateMany({
      where: { id: s.id, status: 'PENDING' },
      data: { status: 'VERIFIED', name, dob, birthYear, gender: doc.gender?.toUpperCase().slice(0, 1) ?? null, last4, photoPath, verifiedAt: new Date() },
    });
    if (done.count !== 1) {
      if (photoPath) removePrivate(photoPath);
      const again = await this.prisma.digilockerSession.findUniqueOrThrow({ where: { id: s.id } });
      if (again.status === 'VERIFIED') return identity(again);
      throw new BadRequestException('Please start the DigiLocker verification again');
    }
    return identity(await this.prisma.digilockerSession.findUniqueOrThrow({ where: { id: s.id } }));
  }

  /** The verified Aadhaar details waiting for a selfie, if any (so a page refresh doesn't lose them). */
  async currentDigilocker(user: User): Promise<DigilockerIdentityDto | null> {
    const s = await this.verifiedSession(user.id);
    return s ? identity(s) : null;
  }

  /** "Not you?" — discard the verified details and start over. */
  async discardDigilocker(user: User) {
    const rows = await this.prisma.digilockerSession.findMany({ where: { userId: user.id, status: 'VERIFIED' } });
    for (const s of rows) await this.scrub(s, 'DISCARDED');
    return { ok: true };
  }

  // ---------- submission ----------

  async submit(
    user: User,
    input: { method: 'MANUAL' | 'DIGILOCKER'; idType?: string; idLast4?: string; idDoc: Upload; selfie: Upload },
  ): Promise<KycSubmissionDto> {
    await this.assertCanSubmit(user);
    const selfie = input.selfie?.buffer;
    if (!selfie?.length) throw new BadRequestException('Take a live selfie with your camera first');
    const selfieKind = detectKind(selfie);
    if (selfieKind !== 'jpg' && selfieKind !== 'png') throw new BadRequestException('Please take your selfie with the camera on this page');

    if (input.method === 'DIGILOCKER') {
      const s = await this.verifiedSession(user.id);
      if (!s) throw new BadRequestException('Verify your Aadhaar with DigiLocker first (it stays valid for 2 hours)');
      const checks = await this.faceChecks(selfie, s.photoPath ? readPrivateDoc(s.photoPath) : null);
      const identityHash = hashIdentity(s.name!, s.dob ? s.dob.toISOString().slice(0, 10) : String(s.birthYear), s.last4!);
      const flags = [...checks.flags, ...this.profileFlags(user, s), ...(await this.duplicateFlags(identityHash, user.id))];
      // the sandbox "verifies" made-up identities, so a person always reviews what it produces
      const auto =
        verificationMode() !== 'sandbox' &&
        (await this.settings.get()).kycAutoApprove === 1 &&
        flags.length === 0 &&
        checks.livenessPassed === true &&
        checks.faceMatched === true;
      const selfiePath = storePrivateDoc(input.selfie);

      const k = await this.prisma.$transaction(async (tx) => {
        // the submission now holds what's needed; the journey keeps no personal data of its own
        const used = await tx.digilockerSession.updateMany({
          where: { id: s.id, status: 'VERIFIED' },
          data: { status: 'USED', name: null, dob: null, birthYear: null, gender: null, last4: null, photoPath: null },
        });
        if (used.count !== 1) throw new BadRequestException('This DigiLocker verification was already used — please verify again');
        const created = await tx.kycSubmission.create({
          data: {
            userId: user.id,
            method: 'DIGILOCKER',
            idType: 'AADHAAR',
            idLast4: s.last4!,
            idDocPath: s.photoPath ?? selfiePath, // no Aadhaar photo is rare; the reviewer sees ID_PHOTO_NOT_COMPARED
            selfiePath,
            verifiedName: s.name,
            verifiedDob: s.dob,
            verifiedGender: s.gender,
            ...checkColumns(checks),
            flags: JSON.stringify(flags),
            identityHash,
            ...(auto ? { status: 'APPROVED', autoApproved: true, reviewedAt: new Date(), reviewNote: 'Approved automatically: Aadhaar via DigiLocker, live selfie matches' } : {}),
          },
          include: { user: true },
        });
        await tx.companionProfile.update({ where: { userId: user.id }, data: { kycStatus: auto ? 'APPROVED' : 'PENDING', ...(auto ? { isListed: true } : {}) } });
        // the government record is the better source for age checks shown to admins
        if (!user.dob && s.dob) await tx.user.update({ where: { id: user.id }, data: { dob: s.dob } });
        return created;
      });
      if (auto)
        await this.notifications.notify(user.id, {
          type: 'kyc.approved',
          title: "You're verified ✅ and live!",
          body: 'Your profile is now visible to members. Set your availability to get bookings.',
          link: '/companion/dashboard',
        });
      return toKycDto(k);
    }

    // manual upload
    if (!input.idType || !input.idLast4) throw new BadRequestException('Choose your ID type and enter its last 4 characters');
    const idDoc = input.idDoc?.buffer;
    if (!idDoc?.length) throw new BadRequestException('Upload a photo of your ID');
    const idKind = detectKind(idDoc);
    if (!idKind) throw new BadRequestException('Please upload a JPG, PNG, WebP or PDF file');
    // PDFs and WebP can't go to face match; the reviewer compares those by eye
    const checks = await this.faceChecks(selfie, idKind === 'jpg' || idKind === 'png' ? idDoc : null);
    const idDocPath = storePrivateDoc(input.idDoc);
    const selfiePath = storePrivateDoc(input.selfie);
    const [k] = await this.prisma.$transaction([
      this.prisma.kycSubmission.create({
        data: {
          userId: user.id,
          method: 'MANUAL',
          idType: input.idType,
          idLast4: input.idLast4.toUpperCase(),
          idDocPath,
          selfiePath,
          ...checkColumns(checks),
          flags: JSON.stringify(checks.flags),
        },
        include: { user: true },
      }),
      this.prisma.companionProfile.update({ where: { userId: user.id }, data: { kycStatus: 'PENDING' } }),
    ]);
    return toKycDto(k);
  }

  // ---------- checks ----------

  /**
   * Liveness on the selfie, then selfie ↔ ID photo. A selfie with no face (or several) is sent back to retake;
   * anything else that fails becomes a flag for the reviewer rather than a hard rejection, since bad lighting can
   * trip these checks for genuine people too.
   */
  private async faceChecks(selfie: Buffer, idPhoto: Buffer | null): Promise<Checks> {
    const out: Checks = { livenessPassed: null, livenessScore: null, faceMatched: null, faceMatchScore: null, flags: [] };
    if (!cashfree.enabled()) return out;
    const vid = () => `kyc_${randomBytes(16).toString('hex')}`;
    try {
      const lv = await cashfree.faceLiveness(vid(), selfie);
      if (lv.status === 'FACE_NOT_DETECTED') throw new BadRequestException('We couldn’t see your face in the selfie — retake it facing the camera in good light');
      if (lv.status === 'MULTIPLE_FACES_DETECTED' || lv.status === 'MULTIPLE_FACE_DETECTED')
        throw new BadRequestException('Only you should be in the selfie — please retake it');
      out.livenessPassed = lv.passed;
      out.livenessScore = lv.score;
      if (!lv.passed) out.flags.push('LIVENESS_FAILED');
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.providerProblem('liveness', e);
      out.flags.push('CHECKS_UNAVAILABLE');
    }
    if (!idPhoto) {
      out.flags.push('ID_PHOTO_NOT_COMPARED');
      return out;
    }
    try {
      const fm = await cashfree.faceMatch(vid(), selfie, idPhoto);
      if (fm.status !== 'SUCCESS') out.flags.push('ID_PHOTO_NOT_COMPARED');
      else {
        out.faceMatched = fm.matched;
        out.faceMatchScore = fm.score;
        if (!fm.matched) out.flags.push('FACE_MISMATCH');
      }
    } catch (e) {
      this.providerProblem('face match', e);
      if (!out.flags.includes('CHECKS_UNAVAILABLE')) out.flags.push('CHECKS_UNAVAILABLE');
    }
    return out;
  }

  /** The profile has to describe the same person as the government record. */
  private profileFlags(user: User, s: DigilockerSession): KycFlag[] {
    const flags: KycFlag[] = [];
    // matters most for women-only bookings: they rely on the companion's gender being real
    if ((user.gender === 'FEMALE' && s.gender === 'M') || (user.gender === 'MALE' && s.gender === 'F')) flags.push('GENDER_MISMATCH');
    if (user.name && !namesOverlap(user.name, s.name ?? '')) flags.push('NAME_MISMATCH');
    if (user.dob && (s.dob ? user.dob.toISOString().slice(0, 10) !== s.dob.toISOString().slice(0, 10) : user.dob.getUTCFullYear() !== s.birthYear))
      flags.push('DOB_MISMATCH');
    return flags;
  }

  /** Same Aadhaar behind another account — possibly someone coming back after a ban. */
  private async duplicateFlags(identityHash: string, userId: string): Promise<KycFlag[]> {
    const others = await this.prisma.kycSubmission.findMany({
      where: { identityHash, userId: { not: userId } },
      select: { user: { select: { status: true } } },
    });
    if (!others.length) return [];
    return [others.some((o) => o.user.status === 'BANNED' || o.user.status === 'SUSPENDED') ? 'BANNED_IDENTITY' : 'DUPLICATE_IDENTITY'];
  }

  // ---------- helpers ----------

  private async assertCanSubmit(user: User) {
    const p = await this.prisma.companionProfile.findUnique({ where: { userId: user.id } });
    if (!p) throw new NotFoundException('Apply as a companion first');
    if (p.kycStatus === 'PENDING') throw new BadRequestException('Your verification is already under review');
    if (p.kycStatus === 'APPROVED') throw new BadRequestException('You are already verified');
    await this.fee.assertCanSubmitKyc(user);
  }

  private async verifiedSession(userId: string) {
    const s = await this.prisma.digilockerSession.findFirst({ where: { userId, status: 'VERIFIED' }, orderBy: { verifiedAt: 'desc' } });
    return s && fresh(s) ? s : null;
  }

  private async fail(s: DigilockerSession, reason: string) {
    await this.prisma.digilockerSession.updateMany({ where: { id: s.id, status: 'PENDING' }, data: { status: 'FAILED', failReason: reason.slice(0, 40) } });
  }

  /** Deletes the Aadhaar details of a journey that was never used. */
  private async scrub(s: DigilockerSession, reason: string) {
    if (s.photoPath) removePrivate(s.photoPath);
    await this.prisma.digilockerSession.update({
      where: { id: s.id },
      data: { status: 'FAILED', failReason: reason, name: null, dob: null, birthYear: null, gender: null, last4: null, photoPath: null },
    });
  }

  /** Aadhaar details nobody used within the window are deleted, not kept around. */
  async purgeStale() {
    const stale = await this.prisma.digilockerSession.findMany({ where: { status: 'VERIFIED', verifiedAt: { lt: new Date(Date.now() - VERIFIED_MS) } } });
    for (const s of stale) await this.scrub(s, 'EXPIRED_UNUSED');
    await this.prisma.digilockerSession.updateMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - JOURNEY_MS) } },
      data: { status: 'FAILED', failReason: 'EXPIRED' },
    });
  }

  private providerProblem(what: string, e: unknown) {
    const err = e as CashfreeError;
    // 422 = the Cashfree Secure ID balance ran out; 401/403 = wrong keys or the server IP isn't whitelisted
    this.log.error(`Cashfree ${what} failed: HTTP ${err.status ?? '?'} ${err.code ?? ''} ${err.message}`);
  }

  private providerDown(e: unknown) {
    this.providerProblem('DigiLocker', e);
    return new ServiceUnavailableException('DigiLocker isn’t responding right now. Try again in a few minutes, or upload your ID instead.');
  }
}

const fresh = (s: DigilockerSession) => !!s.verifiedAt && Date.now() - s.verifiedAt.getTime() < VERIFIED_MS;

function identity(s: DigilockerSession): DigilockerIdentityDto {
  return { name: s.name ?? '', dob: s.dob ? s.dob.toISOString().slice(0, 10) : null, gender: s.gender ? (AADHAAR_GENDER[s.gender] ?? null) : null, last4: s.last4 ?? '' };
}

function checkColumns(c: Checks) {
  return { livenessPassed: c.livenessPassed, livenessScore: c.livenessScore, faceMatched: c.faceMatched, faceMatchScore: c.faceMatchScore };
}

/** "02-02-1995" (Aadhaar's format) → UTC date */
function parseDob(v: string | null | undefined): Date | null {
  const m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec((v ?? '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? d : null;
}

function ageOn(dob: Date, now = new Date()) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

const nameTokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

/** "Priya" matches "PRIYA SHARMA"; a nickname or a different person doesn't. */
function namesOverlap(profileName: string, recordName: string) {
  const record = new Set(nameTokens(recordName));
  const mine = nameTokens(profileName);
  return mine.length === 0 || mine.some((t) => record.has(t));
}

/** Keyed, so the hash can't be reversed by trying every name/DOB/last-4 combination without the server's secret. */
function hashIdentity(name: string, dob: string, last4: string) {
  return createHmac('sha256', config.kycEncryptionKey || config.jwtSecret)
    .update(`${nameTokens(name).join(' ')}|${dob}|${last4}`)
    .digest('hex');
}

function removePrivate(name: string) {
  try {
    rmSync(resolve(PRIVATE_DIR, name.replace(/[/\\]/g, '')), { force: true });
  } catch {
    /* already gone */
  }
}
