'use client';

import { useEffect, useState } from 'react';
import type { PlatformSettings } from '@companio/types';
import { Button, Callout, Card, Field, Input } from '@companio/ui';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { formatINR } from '@/admin/lib/format';

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
              <Input type="number" min={0} step={f.key.endsWith('Pct') ? 0.5 : 1} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })} />
            </Field>
          ))}
          <div className="sm:col-span-2">
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.admin.updateSettings(form);
                  toast('Settings saved');
                  reload();
                } catch (e) {
                  toast(errMsg(e), 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save settings
            </Button>
          </div>
        </Card>
        <Callout tone="sky" title="Example: ₹499/hr × 2h">
          Member pays {formatINR(exampleSubtotal)} + {formatINR(form.connectionFee)} fee + {formatINR(gst)} GST = <b>{formatINR(exampleSubtotal + form.connectionFee + gst)}</b>.
          <br />
          Companion earns {formatINR(exampleSubtotal - commission)}. Platform keeps {formatINR(form.connectionFee + gst + commission)}.
        </Callout>
      </div>
    </>
  );
}
