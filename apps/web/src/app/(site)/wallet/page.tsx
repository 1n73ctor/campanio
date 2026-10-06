'use client';

import { useEffect, useState } from 'react';
import { formatINR, type PayoutDto, type WalletDto } from '@companio/types';
import { Button, Card, EmptyState, Field, Input, Modal, StatusBadge, cn } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader, PageHeader } from '@/components/misc';
import { useToast } from '@/components/toast';
import { InviteCard } from '@/components/invite-card';
import { errMsg, fmtDateTime } from '@/lib/format';

export default function WalletPage() {
  const user = useRequireAuth();
  const { api } = useAuth();
  const toast = useToast();
  const [w, setW] = useState<WalletDto | null>(null);
  const [payouts, setPayouts] = useState<PayoutDto[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.wallet.get().then(setW).catch(() => {});
    if (user?.companion) api.wallet.payouts().then(setPayouts).catch(() => {});
  };
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || !w) return <FullLoader />;
  // an API from before spend-only credit sends neither field
  const credit = w.promoBalance ?? 0;
  const withdrawable = w.withdrawable ?? w.balance;

  const withdraw = async () => {
    setBusy(true);
    try {
      await api.wallet.requestPayout(Number(amount), upi.trim());
      toast('Payout requested — usually processed within 24h');
      setOpen(false);
      setAmount('');
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-3xl pb-10">
      <PageHeader title="Wallet" subtitle="Refunds land here instantly and can be used on your next meetup." />
      <Card tone="lime" className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider">Balance</p>
          <p className="font-display text-5xl font-extrabold tabular-nums">{formatINR(w.balance)}</p>
          {credit > 0 && (
            <p className="mt-1 text-sm">
              {formatINR(withdrawable)} {user.companion ? 'withdrawable' : 'money'} · <b>{formatINR(credit)} credit</b> — for bookings only, can’t be withdrawn
            </p>
          )}
        </div>
        {user.companion && (
          <Button variant="dark" size="lg" onClick={() => setOpen(true)} disabled={withdrawable <= 0}>
            Withdraw to UPI
          </Button>
        )}
      </Card>

      <InviteCard className="mt-6" />

      {payouts.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-display text-lg font-extrabold">Payouts</h2>
          <ul className="divide-y-2 divide-dashed divide-ink/10">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {formatINR(p.amount)} → {p.upiId}
                  <span className="block text-xs text-ink-mute">{fmtDateTime(p.createdAt)}{p.reference && ` · UTR ${p.reference}`}{p.note && ` · ${p.note}`}</span>
                </span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-3 mt-8 font-display text-xl font-extrabold">Transactions</h2>
      {w.txns.length === 0 ? (
        <EmptyState emoji="👛" title="No transactions yet" />
      ) : (
        <Card className="divide-y-2 divide-dashed divide-ink/10 px-5">
          {w.txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold">{t.reason}</p>
                <p className="text-xs text-ink-mute">
                  {fmtDateTime(t.createdAt)}
                  {t.promoAmount > 0 &&
                    (t.type === 'DEBIT'
                      ? ` · ${formatINR(t.promoAmount)} paid with credit`
                      : t.promoAmount === t.amount
                        ? ' · credit, for meetups only'
                        : ` · ${formatINR(t.promoAmount)} back as credit`)}
                </p>
              </div>
              <div className="text-right">
                <p className={cn('font-display font-extrabold tabular-nums', t.type === 'CREDIT' ? 'text-lime-deep' : '')}>
                  {t.type === 'CREDIT' ? '+' : '−'} {formatINR(t.amount)}
                </p>
                <p className="text-xs text-ink-mute">bal {formatINR(t.balanceAfter)}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Withdraw earnings" footer={<Button loading={busy} disabled={!amount || !upi} onClick={withdraw}>Request payout</Button>}>
        <Field
          label="Amount"
          hint={credit > 0 ? `You can withdraw ${formatINR(withdrawable)}. Your ${formatINR(credit)} credit is for meetups only.` : `Available ${formatINR(withdrawable)}`}
        >
          <Input type="number" min={1} max={withdrawable} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="UPI ID">
          <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@okaxis" />
        </Field>
      </Modal>
    </div>
  );
}
