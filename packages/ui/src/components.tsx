import * as React from 'react';
import { cn } from './cn';

// ---------- Button ----------
export type ButtonVariant = 'primary' | 'lime' | 'sky' | 'sunny' | 'white' | 'dark' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-pink text-ink',
  lime: 'bg-lime text-ink',
  sky: 'bg-sky text-ink',
  sunny: 'bg-sunny text-ink',
  white: 'bg-white text-ink',
  dark: 'bg-ink text-paper',
  danger: 'bg-danger text-white',
  ghost: 'bg-transparent text-ink border-transparent shadow-none hover:bg-ink/5',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-chunky',
  md: 'h-11 px-5 text-[15px] rounded-chunky',
  lg: 'h-14 px-7 text-lg rounded-blob',
};

/** Class builder so framework links (next/link) can look like buttons. */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) =>
  cn(
    'inline-flex items-center justify-center gap-2 font-display font-bold whitespace-nowrap select-none',
    variant === 'ghost' ? 'border-3' : 'brutal brutal-press',
    'disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    extra,
  );

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

// ---------- Card ----------
export type Tone = 'white' | 'pink' | 'lime' | 'lavender' | 'sky' | 'sunny' | 'tangerine' | 'mint' | 'paper';
export const toneBg: Record<Tone, string> = {
  white: 'bg-white',
  paper: 'bg-paper',
  pink: 'bg-pink-soft',
  lime: 'bg-lime-soft',
  lavender: 'bg-lavender-soft',
  sky: 'bg-sky-soft',
  sunny: 'bg-sunny-soft',
  tangerine: 'bg-tangerine-soft',
  mint: 'bg-mint-soft',
};
export const toneSolid: Record<Exclude<Tone, 'white' | 'paper'>, string> = {
  pink: 'bg-pink',
  lime: 'bg-lime',
  lavender: 'bg-lavender',
  sky: 'bg-sky',
  sunny: 'bg-sunny',
  tangerine: 'bg-tangerine',
  mint: 'bg-mint',
};

export function Card({ tone = 'white', className, interactive, ...rest }: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone; interactive?: boolean }) {
  return <div className={cn('brutal rounded-blob', toneBg[tone], interactive && 'brutal-press', className)} {...rest} />;
}

// ---------- Badge / Chip ----------
export function Badge({ tone = 'white', className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone | 'dark' | 'danger' }) {
  const bg = tone === 'dark' ? 'bg-ink text-paper' : tone === 'danger' ? 'bg-danger text-white' : tone === 'white' || tone === 'paper' ? toneBg[tone] : toneSolid[tone];
  return <span className={cn('inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold', bg, className)} {...rest} />;
}

export function Chip({ active, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-semibold transition',
        active ? 'bg-ink text-paper shadow-none' : 'bg-white shadow-brutal-sm hover:-translate-y-[1px]',
        className,
      )}
      {...rest}
    />
  );
}

// ---------- Form ----------
const fieldBase = 'w-full rounded-chunky border-3 border-ink bg-white px-3.5 text-[15px] placeholder:text-ink-mute focus:outline-none focus:shadow-brutal-sm disabled:bg-paper-deep';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...rest} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-[96px] py-2.5', className)} {...rest} />;
});
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn(fieldBase, 'h-11 pr-8', className)} {...rest} />;
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="font-display text-sm font-bold">{label}</span>
      {children}
      {error ? <span className="block text-sm font-semibold text-danger">{error}</span> : hint ? <span className="block text-xs text-ink-mute">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-sm', className)}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-md border-3 border-ink bg-white checked:bg-lime checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M3 8.5l3 3 7-7%22 stroke=%22%23141414%22 stroke-width=%222.5%22 fill=%22none%22/></svg>')] bg-center bg-no-repeat" {...rest} />
      <span>{label}</span>
    </label>
  );
}

// ---------- Avatar ----------
const AVATAR_TONES = ['bg-pink', 'bg-lime', 'bg-lavender', 'bg-sky', 'bg-sunny', 'bg-tangerine', 'bg-mint'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ name, src, size = 48, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const initials = (name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const tone = AVATAR_TONES[hash(name ?? '?') % AVATAR_TONES.length];
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-3 border-ink font-display font-extrabold', tone, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden={!name}
    >
      {src ? <img src={src} alt={name ?? ''} className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

// ---------- Misc ----------
export function Stars({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-bold', className)}>
      <span aria-hidden className="text-sunny-deep">★</span>
      {value ? value.toFixed(1) : 'New'}
      {count !== undefined && count > 0 && <span className="font-medium text-ink-mute">({count})</span>}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block animate-spin rounded-full border-[3px] border-current border-r-transparent', className ?? 'h-5 w-5')} role="status" aria-label="Loading" />;
}

export function EmptyState({ emoji = '🫥', title, body, action }: { emoji?: string; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card tone="paper" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="text-5xl">{emoji}</span>
      <h3 className="text-xl font-extrabold">{title}</h3>
      {body && <p className="max-w-md text-ink-soft">{body}</p>}
      {action}
    </Card>
  );
}

export function Callout({ tone = 'sunny', title, children, className }: { tone?: Tone; title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-chunky border-3 border-ink px-4 py-3 text-sm', toneBg[tone], className)}>
      {title && <p className="mb-0.5 font-display font-bold">{title}</p>}
      <div className="text-ink-soft">{children}</div>
    </div>
  );
}

export function Stat({ label, value, tone = 'white', hint }: { label: string; value: React.ReactNode; tone?: Tone; hint?: React.ReactNode }) {
  return (
    <Card tone={tone} className="p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </Card>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-blob border-3 border-ink bg-paper shadow-brutal-lg sm:max-w-lg sm:rounded-blob" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b-3 border-ink px-5 py-3">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full border-2 border-ink bg-white font-bold">×</button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t-3 border-ink px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-chunky border-3 border-ink bg-white p-1 shadow-brutal-sm', className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn('rounded-lg px-3.5 py-1.5 text-sm font-bold transition', value === it.value ? 'bg-ink text-paper' : 'hover:bg-ink/5')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-8 w-14 rounded-full border-3 border-ink transition disabled:opacity-50', checked ? 'bg-lime' : 'bg-white')}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-ink transition-all', checked ? 'left-[26px]' : 'left-0.5 bg-white')} />
    </button>
  );
}

const STATUS_TONE: Record<string, Tone | 'dark' | 'danger'> = {
  PENDING_PAYMENT: 'white',
  REQUESTED: 'sunny',
  ACCEPTED: 'sky',
  IN_PROGRESS: 'lime',
  COMPLETED: 'mint',
  DECLINED: 'white',
  EXPIRED: 'white',
  CANCELLED: 'white',
  DISPUTED: 'danger',
  PENDING: 'sunny',
  APPROVED: 'mint',
  REJECTED: 'danger',
  NOT_SUBMITTED: 'white',
  OPEN: 'sunny',
  RESOLVED: 'mint',
  ACTIONED: 'mint',
  DISMISSED: 'white',
  ACTIVE: 'lime',
  SUSPENDED: 'tangerine',
  BANNED: 'danger',
  DELETED: 'white',
  PAID: 'mint',
  HELD: 'sky',
  FROZEN: 'danger',
  RELEASED: 'mint',
  REFUNDED: 'lavender',
  SETTLED: 'lavender',
};
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'white'}>{label ?? status.replace(/_/g, ' ').toLowerCase()}</Badge>;
}

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-xl font-extrabold', className)}>
      <span className="inline-flex h-9 w-9 -rotate-6 items-center justify-center rounded-xl border-3 border-ink bg-pink shadow-brutal-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <circle cx="8.5" cy="10" r="3.2" fill="#141414" />
          <circle cx="15.5" cy="10" r="3.2" fill="#141414" />
          <path d="M5 17c1.8-2 4.6-2 7-0.2 2.4-1.8 5.2-1.8 7 0.2" stroke="#141414" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      {withText && <span>companio</span>}
    </span>
  );
}
