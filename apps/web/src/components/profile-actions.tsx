'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ReportDialog } from './report-dialog';
import { useToast } from './toast';

export function ProfileActions({ companionUserId, name }: { companionUserId: string; name: string }) {
  const { user, api } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!user || user.id === companionUserId) return null;
  return (
    <div className="mt-3 flex justify-center gap-4 text-sm font-semibold text-ink-mute">
      <button className="hover:underline" onClick={() => setOpen(true)}>
        🚩 Report
      </button>
      <button
        className="hover:underline"
        onClick={async () => {
          if (!confirm(`Block ${name}? They won't be able to book or message you.`)) return;
          await api.me.block(companionUserId);
          toast(`${name} blocked`);
        }}
      >
        ⛔ Block
      </button>
      <ReportDialog open={open} onClose={() => setOpen(false)} targetUserId={companionUserId} name={name} />
    </div>
  );
}
