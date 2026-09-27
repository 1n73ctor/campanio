'use client';

import type { ReactNode } from 'react';
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

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-xs text-ink-mute">{total} total</p>;
  return (
    <div className="mt-4 flex items-center gap-3 text-sm">
      <Button size="sm" variant="white" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </Button>
      <span className="font-semibold">
        Page {page} of {pages} · {total} total
      </span>
      <Button size="sm" variant="white" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </Button>
    </div>
  );
}
