'use client';

import { useState } from 'react';
import { REPORT_REASONS, humanize, type ReportReason } from '@companio/types';
import { Button, Field, Modal, Select, Textarea } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { useToast } from './toast';

export function ReportDialog({ open, onClose, targetUserId, bookingId, messageId, name }: { open: boolean; onClose: () => void; targetUserId: string; bookingId?: string; messageId?: string; name?: string | null }) {
  const { api } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>(messageId ? 'INAPPROPRIATE_BEHAVIOUR' : 'SAFETY_CONCERN');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.reports.create({ targetUserId, bookingId, messageId, reason, details: details || undefined });
      if (block) await api.me.block(targetUserId);
      toast(r.message);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Report ${name ?? 'user'}`}
      footer={
        <>
          <Button variant="white" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={submit}>
            Submit report
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">Reports are confidential. If you’re in danger right now, call <a href="tel:112" className="font-bold underline">112</a>.</p>
      <Field label="What happened?">
        <Select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Details (optional)">
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1500} placeholder="Anything that helps our safety team" />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="h-4 w-4" /> Also block {name ?? 'this user'}
      </label>
    </Modal>
  );
}
