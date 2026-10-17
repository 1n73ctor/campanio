'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChatPricesDto, ChatUnlockKind, ConversationDto } from '@companio/types';
import { Button, Coin, CoinAmount, Modal, cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg, fmtDateTime } from '@/lib/format';
import { useToast } from './toast';

/** "Message" on a host's profile: opens a paid chat (timed or for good) with coins from the wallet. */
export function MessageHost({ companionId, companionUserId, name }: { companionId: string; companionUserId: string; name: string }) {
  const { api, user, ready } = useAuth();
  const router = useRouter();
  const [prices, setPrices] = useState<ChatPricesDto | null>(null);
  const [conv, setConv] = useState<ConversationDto | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (user) api.chats.withHost(companionId).then((r) => (setPrices(r.prices), setConv(r.conversation))).catch(() => {});
    else api.chats.prices().then(setPrices).catch(() => {});
  }, [api, user, ready, companionId]);

  if (!prices?.enabled || user?.id === companionUserId || user?.role === 'ADMIN') return null;

  const click = () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    if (conv?.canWrite) return router.push(`/messages/${conv.id}`);
    setOpen(true);
  };

  return (
    <>
      <Button variant="white" size="lg" className="w-full" onClick={click}>
        💬 {conv?.canWrite ? `Open chat with ${name}` : `Message ${name}`}
      </Button>
      {!conv?.canWrite && (
        <p className="-mt-1 text-center text-xs text-ink-mute">
          From <Coin size={14} /> {prices.timedPrice} coins · refunded if {name} doesn’t reply in {prices.refundHours}h
        </p>
      )}
      <UnlockChat open={open} onClose={() => setOpen(false)} companionId={companionId} name={name} prices={prices} conversation={conv} onOpened={(c) => router.push(`/messages/${c.id}`)} />
    </>
  );
}

/** Choose timed or permanent, pay with coins. Shared by the profile button and an expired chat. */
export function UnlockChat({
  open,
  onClose,
  companionId,
  name,
  prices,
  conversation,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  companionId: string;
  name: string;
  prices: ChatPricesDto;
  conversation: ConversationDto | null;
  onOpened: (c: ConversationDto) => void;
}) {
  const { api } = useAuth();
  const toast = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [kind, setKind] = useState<ChatUnlockKind>('TIMED');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) api.wallet.get().then((w) => setBalance(w.balance)).catch(() => setBalance(null));
  }, [open, api]);

  const price = kind === 'PERMANENT' ? prices.permanentPrice : prices.timedPrice;
  const short = balance !== null && balance < price;
  const extending = !!conversation?.accessUntil && new Date(conversation.accessUntil).getTime() > Date.now();

  const unlock = async () => {
    setBusy(true);
    try {
      const c = await api.chats.unlock(companionId, kind);
      toast(kind === 'PERMANENT' ? `Chat with ${name} is open for good 🎉` : `Chat open until ${fmtDateTime(c.accessUntil!)}`);
      onClose();
      onOpened(c);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const Option = ({ k, title, sub, p }: { k: ChatUnlockKind; title: string; sub: string; p: number }) => (
    <button
      type="button"
      onClick={() => setKind(k)}
      className={cn('w-full rounded-chunky border-3 border-ink p-4 text-left', kind === k ? 'bg-lime shadow-brutal-sm' : 'bg-white')}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-extrabold">{title}</span>
        <CoinAmount n={p} size={22} className="font-display text-lg font-extrabold" />
      </span>
      <span className="mt-1 block text-sm text-ink-soft">{sub}</span>
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Message ${name}`}
      footer={
        short ? (
          <Link href="/wallet#add-coins" className="w-full">
            <Button className="w-full">Add coins</Button>
          </Link>
        ) : (
          <Button className="w-full" loading={busy} disabled={balance === null} onClick={unlock}>
            <span className="inline-flex items-center gap-1.5">
              Pay <CoinAmount n={price} /> and open chat
            </span>
          </Button>
        )
      }
    >
      <div className="space-y-3">
        <Option k="TIMED" title={`${prices.timedHours} hours`} sub={extending ? `Adds ${prices.timedHours}h to your chat time.` : `Write to ${name} for the next ${prices.timedHours} hours.`} p={prices.timedPrice} />
        <Option k="PERMANENT" title="Forever" sub={`Message ${name} any time, no time limit.`} p={prices.permanentPrice} />
        <p className="text-sm">
          Your coins: <b>{balance === null ? '…' : <CoinAmount n={balance} className="align-middle" />}</b>
          {short && <span className="font-semibold text-danger"> — not enough for this option</span>}
        </p>
        <ul className="space-y-1 text-xs text-ink-soft">
          <li>↩️ If {name} doesn’t reply within {prices.refundHours} hours, your coins come back automatically.</li>
          <li>🛡️ Keep it platonic. Phone numbers, links and payment details are hidden for your safety.</li>
        </ul>
      </div>
    </Modal>
  );
}
