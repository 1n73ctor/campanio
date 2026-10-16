'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card, Spinner, cn } from '@companio/ui';

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return <Card tone="pink" className="p-4 font-semibold">⚠️ {error}</Card>;
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b-3 border-ink bg-paper-deep">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-display text-xs font-extrabold uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-ink/10">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-ink-mute">Nothing here 🎉</p>}
    </Card>
  );
}

export const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cn('px-4 py-3 align-top', className)}>{children}</td>;

/** Page numbers to show: first, last, and a window around the current page, with gaps as null ("…"). */
function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - prev === 2) out.push(p - 1); // a gap of one page: just show it
    else if (p - prev > 2) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const [jump, setJump] = useState('');
  useEffect(() => setJump(''), [page]);
  if (pages <= 1) return <p className="mt-3 text-xs text-ink-mute">{total} total</p>;
  const go = (p: number) => {
    const n = Math.min(pages, Math.max(1, Math.round(p)));
    if (n !== page) onPage(n);
  };
  const jumpTo = Number(jump);
  const jumpOk = jump !== '' && Number.isInteger(jumpTo) && jumpTo >= 1 && jumpTo <= pages && jumpTo !== page;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="white" disabled={page <= 1} onClick={() => go(1)} aria-label="First page">
          « First
        </Button>
        <Button size="sm" variant="white" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
          ‹ Prev
        </Button>
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-ink-mute">
              …
            </span>
          ) : (
            <Button key={p} size="sm" variant={p === page ? 'primary' : 'white'} onClick={() => go(p)} aria-current={p === page ? 'page' : undefined} className="min-w-9 tabular-nums">
              {p}
            </Button>
          ),
        )}
        <Button size="sm" variant="white" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page">
          Next ›
        </Button>
        <Button size="sm" variant="white" disabled={page >= pages} onClick={() => go(pages)} aria-label="Last page">
          Last »
        </Button>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (jumpOk) go(jumpTo);
        }}
      >
        <label htmlFor="pager-jump" className="text-ink-soft">
          Go to page
        </label>
        <input
          id="pager-jump"
          type="number"
          inputMode="numeric"
          min={1}
          max={pages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          placeholder={String(page)}
          className="w-20 rounded-xl border-2 border-ink bg-white px-2 py-1 tabular-nums"
        />
        <Button size="sm" variant="white" type="submit" disabled={!jumpOk}>
          Go
        </Button>
      </form>
      <span className="text-ink-soft">
        Page {page} of {pages} · {total} total
      </span>
    </div>
  );
}
