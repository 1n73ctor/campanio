import type { ReactNode } from 'react';
import { Spinner, cn } from '@companio/ui';

export function PageHeader({ eyebrow, title, subtitle, actions, className }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow && <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.2em] text-pink-deep">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function FullLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-3">
      {items.map((f) => (
        <details key={f.q} className="group rounded-chunky border-3 border-ink bg-white p-4 shadow-brutal-sm open:bg-lavender-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-bold">
            {f.q}
            <span className="text-xl transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-ink-soft">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="space-y-4 text-[17px] leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">{children}</div>;
}
