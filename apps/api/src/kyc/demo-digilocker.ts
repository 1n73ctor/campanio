import { Body, Controller, Get, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import type { DigilockerAadhaar, DigilockerStatus } from './cashfree';

/**
 * CASHFREE_VRS_ENV=demo — a pretend DigiLocker and face check, so the whole verification flow can be tried on a
 * laptop without a Cashfree account (Cashfree's sandbox only returns people to https:// addresses, not localhost).
 * Nothing is really checked. Unreachable in production: config.cashfree.demo is always false there.
 * State lives in memory, so restarting the API expires any DigiLocker link that's open.
 */
type Outcome = 'pass' | 'mismatch' | 'spoof' | 'noface';
const journeys = new Map<string, { redirect: string; status: DigilockerStatus; record?: DigilockerAadhaar }>();
let selfieOutcome: Outcome = 'pass';

/** grey silhouette standing in for the photo on the Aadhaar record */
const PHOTO = 'iVBORw0KGgoAAAANSUhEUgAAAJYAAAC+CAIAAABYnGHuAAACKklEQVR42u3dwW0EMQwEwQnbETgEh7Zvvx3FxWAccOJQBXQELOxrJSrP75+qixEgFEIhRGgKCIVQCBEKoRAKIUIhFEIhRCiEQiiECIVQCIUQoRAKoRAiFEIhFEKEQiiEQohQCGf19f2DsIbqvyFslVtmmcvxFkCGXLtl+LUrBl47ZPi1K4Zfu2LgtUOGX7ti+LUrIkR4k99MxfBrVwy/dkWECK/0G6UYfu2KCBEiRNjrN0QRIcK7/SYoIkSI8HLCBX7HFREiRIgQIUKECBEiRIiwlnCN31lFX6GvECFChAgRIkSIECFChAgp+muPECFC50idI0WI0J0KhAgRIqTolq+79ggR2jtj7wxF25/sYEOIcBPhYx/pAsLHVuAFhEMgh8/Hhnwb8lcrVkzGazFei9mo2DUQL6d5OW0FZPUEvCJan7d8EQqhECI0BYRCKIQIhVAIhRChEAqhPxVXE978v7eY0KkZJ9icYHMUGKE7FS6ngZxK6KJ2N6F1CcWEVgd1E1qjV0xosXM3oTebugmX+R1UDLx2yPBrVwy/dsXwa1cMv3bF8GtXDL92xfBrVwy/dkWECPmdVgy/dsXwa1dEiJDfacXwa1dEiJDfacXwa1dEiJDfaUWE1xMCOK6I8G5Co5+giPBiQkMfoogQoUoJjXuOIkKEaiQ06FGKCBGqjtCIpykiRCiE+iih4Q5URIhQCIUQIb9yRYQIhVAIESJEKIRCiBAhQiHUG4QvOErf3L02/OUAAAAASUVORK5CYII=';

export const demoDigilocker = {
  createUrl(verificationId: string, redirect: string) {
    journeys.set(verificationId, { redirect, status: 'PENDING' });
    return `${config.publicApiUrl}/dev/digilocker/${verificationId}`;
  },
  status: (verificationId: string): DigilockerStatus => journeys.get(verificationId)?.status ?? 'EXPIRED',
  aadhaar: (verificationId: string): DigilockerAadhaar | null => journeys.get(verificationId)?.record ?? null,
  liveness() {
    if (selfieOutcome === 'noface') return { passed: false, score: null, status: 'FACE_NOT_DETECTED' };
    if (selfieOutcome === 'spoof') return { passed: false, score: 0.18, status: 'REAL_FACE_NOT_DETECTED' };
    return { passed: true, score: 0.96, status: 'SUCCESS' };
  },
  match() {
    return selfieOutcome === 'mismatch' ? { matched: false, score: 0.22, status: 'SUCCESS' } : { matched: true, score: 0.93, status: 'SUCCESS' };
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@ApiExcludeController()
@Controller('dev/digilocker')
export class DemoDigilockerController {
  constructor(private prisma: PrismaService) {}

  @Get(':id')
  async page(@Param('id') id: string, @Res() res: Response) {
    if (!config.cashfree.demo) throw new NotFoundException();
    const j = journeys.get(id);
    const s = j && (await this.prisma.digilockerSession.findUnique({ where: { verificationId: id }, include: { user: true } }));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!j || !s) return res.end(shell('<p>This link has expired (the API restarted). Go back to Companio and start again.</p>'));
    const u = s.user;
    const g = u.gender === 'MALE' ? 'M' : u.gender === 'FEMALE' ? 'F' : '';
    const opt = (v: string, label: string, cur: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
    res.end(
      shell(`
      <h2>Companio wants to see your Aadhaar</h2>
      <p class="muted">In the real DigiLocker you’d sign in with your Aadhaar mobile number and an OTP. Here you choose what “your Aadhaar” says — change a field to see how Companio flags it.</p>
      <form method="post">
        <label>Name on Aadhaar<input name="name" value="${esc(u.name ?? 'Test Person')}" required maxlength="80"></label>
        <label>Date of birth<input name="dob" type="date" value="${u.dob ? u.dob.toISOString().slice(0, 10) : '1996-08-14'}" required></label>
        <label>Gender<select name="gender">${opt('F', 'Female', g)}${opt('M', 'Male', g)}${opt('T', 'Transgender', g)}</select></label>
        <label>Last 4 digits of Aadhaar<input name="last4" value="4821" pattern="[0-9]{4}" required></label>
        <label>How the selfie check should turn out
          <select name="face">${opt('pass', 'Live person, matches the Aadhaar photo', 'pass')}${opt('mismatch', 'Doesn’t look like the Aadhaar photo', '')}${opt('spoof', 'Not a live person (photo of a photo)', '')}${opt('noface', 'No face in the selfie', '')}</select>
        </label>
        <div class="row"><button name="action" value="deny" class="ghost">Deny</button><button name="action" value="allow">Allow</button></div>
      </form>`),
    );
  }

  @Post(':id')
  consent(@Param('id') id: string, @Body() b: Record<string, string>, @Res() res: Response) {
    if (!config.cashfree.demo) throw new NotFoundException();
    const j = journeys.get(id);
    if (!j) throw new NotFoundException('This link has expired');
    if (b.action !== 'allow') j.status = 'CONSENT_DENIED';
    else {
      const [y, m, d] = String(b.dob ?? '').split('-');
      selfieOutcome = (['pass', 'mismatch', 'spoof', 'noface'] as const).find((o) => o === b.face) ?? 'pass';
      j.status = 'AUTHENTICATED';
      j.record = {
        status: 'SUCCESS',
        name: String(b.name ?? '').slice(0, 80),
        dob: y && m && d ? `${d}-${m}-${y}` : null,
        gender: ['F', 'M', 'T'].includes(b.gender) ? b.gender : 'F',
        uid: `xxxxxxxx${/^\d{4}$/.test(b.last4) ? b.last4 : '4821'}`,
        photo_link: PHOTO,
      };
    }
    res.redirect(302, j.redirect);
  }
}

function shell(body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DigiLocker (local demo)</title>
<style>
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f3f6fb;color:#1b2430}
header{background:#1f4e9c;color:#fff;padding:14px 20px;font-weight:700;font-size:18px}
.demo{background:#ffe08a;padding:10px 20px;font-size:14px;font-weight:600}
main{max-width:460px;margin:24px auto;padding:0 16px}
form{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 10px #0001}
label{display:block;margin:0 0 14px;font-size:14px;font-weight:600}
input,select{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px;border:1px solid #c6cfdb;border-radius:8px;font:inherit}
.row{display:flex;gap:10px;justify-content:flex-end}
button{padding:10px 22px;border:0;border-radius:8px;background:#1f4e9c;color:#fff;font:inherit;font-weight:700;cursor:pointer}
button.ghost{background:#e4e9f1;color:#1b2430}
.muted{color:#5b6675;font-size:14px}
</style></head><body><header>DigiLocker</header>
<div class="demo">LOCAL DEMO — not the real DigiLocker. It only exists on this computer (CASHFREE_VRS_ENV=demo).</div>
<main>${body}</main></body></html>`;
}
