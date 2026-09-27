'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SafetyShareViewDto } from '@companio/types';
import { Avatar, Button, Callout, Card, Field, Modal, Textarea } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg, timeAgo } from '@/lib/format';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
const STATUS_TONE: Record<string, string> = { IN_PROGRESS: 'bg-lime', ACCEPTED: 'bg-sky', REQUESTED: 'bg-sunny', COMPLETED: 'bg-mint', DISPUTED: 'bg-pink' };

/** What a trusted contact sees. Refreshes itself so the status and location stay current. */
export function ShareView({ token }: { token: string }) {
  const { api } = useAuth();
  const [v, setV] = useState<SafetyShareViewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);

  const load = useCallback(() => api.safety.view(token).then((d) => { setV(d); setError(null); }).catch((e) => setError(errMsg(e))), [api, token]);
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !v) {
    return (
      <div className="container-x max-w-xl py-16">
        <Callout tone="white" title="This link isn’t available">
          {error}
        </Callout>
      </div>
    );
  }
  if (!v) return <div className="container-x py-16 text-center text-ink-soft">Loading…</div>;

  const loc = v.location;
  const d = 0.008;
  const mapSrc = loc && `https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - d},${loc.lat - d},${loc.lng + d},${loc.lat + d}&layer=mapnik&marker=${loc.lat},${loc.lng}`;

  return (
    <div className="container-x max-w-2xl space-y-5 py-8">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pink-deep">Shared with you</p>
        <h1 className="mt-1 text-3xl font-extrabold">{v.sharerName}’s Companio session</h1>
        <p className="mt-1 text-ink-soft">{v.sharerName} shared this so you can keep an eye on them. This page updates automatically.</p>
      </div>

      {v.alertActive && (
        <Callout tone="pink" title="Safety team alerted">
          An alert is open for this session and the Companio safety team is on it.
        </Callout>
      )}

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold ${STATUS_TONE[v.status] ?? 'bg-white'}`}>{v.statusLabel}</span>
          <span className="text-xs text-ink-mute">link works until {fmt(v.expiresAt)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={v.other.firstName} src={v.other.avatarUrl} size={56} />
          <div>
            <p className="font-display text-lg font-extrabold">
              Meeting {v.other.firstName} {v.other.verified && '✅'}
            </p>
            <p className="text-sm text-ink-soft">{v.other.verifiedLabel}</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>🎯 {v.activity}</p>
          <p>
            🕒 {fmt(v.startAt)} – {fmtTime(v.endAt)}
          </p>
          <p className="sm:col-span-2">📍 {v.meetingPoint}</p>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loc && mapSrc ? (
          <>
            <iframe title={`${v.sharerName}'s location`} src={mapSrc} className="h-72 w-full border-0" />
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span>
                📍 {v.sharerName}’s live location · updated {timeAgo(loc.updatedAt)}
              </span>
              <a href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" className="font-bold underline">
                Open in Google Maps
              </a>
            </div>
          </>
        ) : (
          <p className="p-5 text-sm text-ink-soft">
            📍 {v.sharerName} hasn’t turned on live location. It appears here once they do (it’s available once the booking is confirmed).
          </p>
        )}
      </Card>

      <Card tone="sunny" className="space-y-3 p-5">
        <p className="font-display text-lg font-extrabold">Worried about {v.sharerName}?</p>
        <p className="text-sm">Try calling them first. If you can’t reach them or think something is wrong, alert our safety team — we’ll contact them straight away.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="danger" className="flex-1" onClick={() => setAlertOpen(true)}>
            🚨 Alert Companio safety team
          </Button>
          <a href="tel:112" className="flex-1 rounded-chunky border-3 border-ink bg-white py-2.5 text-center font-display font-bold">
            📞 Call 112 (emergency)
          </a>
        </div>
      </Card>

      <Modal open={alertOpen} onClose={() => { setAlertOpen(false); setGuidance(null); }} title="Alert our safety team?">
        {guidance ? (
          <Callout tone="lime" title="Alert sent">
            {guidance}
          </Callout>
        ) : (
          <>
            <p className="text-sm">We’ll contact {v.sharerName} immediately and check the session. Use this whenever you’re genuinely worried.</p>
            <Field label="What’s worrying you? (optional)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={`e.g. ${v.sharerName} isn’t answering calls`} />
            </Field>
            <Button
              variant="danger"
              size="lg"
              className="w-full"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api.safety.alert(token, note || undefined);
                  setGuidance(r.guidance);
                  load();
                } catch (e) {
                  setGuidance(errMsg(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send alert
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}
