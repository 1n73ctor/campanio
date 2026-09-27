'use client';

import { useEffect, useState } from 'react';
import { COMPANION_FEE_KEYS, companionFeeFor, type Gender, type PlatformSettings } from '@companio/types';
import { Button, Callout, Card, Field, NumberInput, Toggle } from '@companio/ui';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { formatINR } from '@/admin/lib/format';

const FEE_GENDERS: { gender: Gender; label: string }[] = [
  { gender: 'MALE', label: 'Male' },
  { gender: 'FEMALE', label: 'Female' },
  { gender: 'NON_BINARY', label: 'Non-binary' },
  { gender: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say / not set' },
];

const FIELDS: { key: keyof PlatformSettings; label: string; hint: string; suffix: string }[] = [
  { key: 'connectionFee', label: 'Connection fee', hint: 'Flat fee per booking, charged to the member', suffix: '₹' },
  { key: 'gstPct', label: 'GST on connection fee', hint: 'Applied to the connection fee only', suffix: '%' },
  { key: 'commissionPct', label: 'Platform commission', hint: 'Taken from the companion’s booking value', suffix: '%' },
  { key: 'freeCancelHours', label: 'Free cancellation window', hint: 'Hours before start for a full subtotal refund after acceptance', suffix: 'h' },
  { key: 'lateCancelRefundPct', label: 'Late cancellation refund', hint: '% of subtotal refunded when the member cancels late', suffix: '%' },
  { key: 'autoReleaseHours', label: 'Dispute window / auto-release', hint: 'Hours after completion before escrow auto-releases', suffix: 'h' },
  { key: 'requestExpiryHours', label: 'Request expiry', hint: 'Hours a companion has to accept before auto-refund', suffix: 'h' },
  { key: 'minPayout', label: 'Minimum payout', hint: 'Smallest withdrawal a companion can request', suffix: '₹' },
];

export default function SettingsPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api.admin.settings(), []);
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);

  if (error) return <ErrorBox error={error} />;
  if (!form) return <Loading />;

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.admin.updateSettings(form);
      // an API server running older code silently drops settings it doesn't know (like the registration fee)
      if (!('companionFeeMaleOn' in saved)) {
        toast('Saved, but your API server is out of date and ignored the registration fee settings. Deploy the latest API (./deploy/deploy.sh).', 'error');
      } else toast('Settings saved');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const exampleSubtotal = 499 * 2;
  const gst = Math.round((form.connectionFee * form.gstPct) / 100);
  const commission = Math.round((exampleSubtotal * form.commissionPct) / 100);

  return (
    <>
      <PageTitle title="Platform settings" subtitle="Business rules enforced by the API. Changes apply to new bookings immediately and are audit-logged." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="grid gap-4 p-6 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={`${f.label} (${f.suffix})`} hint={f.hint}>
              <NumberInput decimals={f.key.endsWith('Pct')} value={form[f.key]} onValueChange={(n) => setForm((x) => (x ? { ...x, [f.key]: n } : x))} />
            </Field>
          ))}
          <div className="sm:col-span-2">
            <Button loading={busy} onClick={save}>
              Save settings
            </Button>
          </div>
        </Card>
        <Callout tone="sky" title="Example: ₹499/hr × 2h">
          Member pays {formatINR(exampleSubtotal)} + {formatINR(form.connectionFee)} fee + {formatINR(gst)} GST = <b>{formatINR(exampleSubtotal + form.connectionFee + gst)}</b>.
          <br />
          Companion earns {formatINR(exampleSubtotal - commission)}. Platform keeps {formatINR(form.connectionFee + gst + commission)}.
        </Callout>
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-extrabold">Companion registration fee</h2>
          <p className="mt-1 text-sm text-ink-soft">
            One-time fee to apply as a companion, set per gender. GST ({form.gstPct}%) is added on top. When it’s off, applicants of that gender never see a payment
            screen. Companions who applied before a fee was switched on aren’t charged.
          </p>
          <div className="mt-4 divide-y-2 divide-ink/10">
            {FEE_GENDERS.map(({ gender, label }) => {
              const key = COMPANION_FEE_KEYS[gender];
              const onKey = `${key}On` as keyof PlatformSettings;
              const on = form[onKey] === 1;
              const preview = companionFeeFor(form as unknown as Record<string, number>, gender);
              return (
                <div key={gender} className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_auto_160px_1fr]">
                  <span className="font-bold">{label}</span>
                  <Toggle checked={on} onChange={(v) => setForm({ ...form, [onKey]: v ? 1 : 0 })} label={`Charge ${label.toLowerCase()} applicants`} />
                  <NumberInput
                    aria-label={`${label} fee (₹, before GST)`}
                    value={form[key]}
                    disabled={!on}
                    onValueChange={(n) => setForm((x) => (x ? { ...x, [key]: Math.round(n) } : x))}
                  />
                  <span className="text-sm text-ink-soft">
                    {!on ? 'No fee — no payment screen' : preview.required ? <>Applicant pays <b className="text-ink">{formatINR(preview.total)}</b> ({formatINR(preview.amount)} + {formatINR(preview.gst)} GST)</> : 'Enter an amount above ₹0'}
                  </span>
                </div>
              );
            })}
          </div>
          <Button className="mt-4" loading={busy} onClick={save}>
            Save fee settings
          </Button>
        </Card>
      </div>
    </>
  );
}
