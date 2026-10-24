import { CATEGORIES } from '@companio/types';
import { cn, toneBg } from '@companio/ui';

/** Top photo of a host card; hosts without a photo get their main activity's colour, emoji and initial. */
export function CardPhoto({ src, name, categories, alt, className, noInitial }: { src: string | null | undefined; name: string; categories: string[]; alt: string; className?: string; noInitial?: boolean }) {
  if (src) return <img src={src} alt={alt} loading="lazy" className={cn('h-full w-full object-cover', className)} />;
  const cat = CATEGORIES.find((x) => x.slug === categories[0]);
  return (
    <div className={cn('relative flex h-full w-full items-center justify-center', toneBg[cat?.color ?? 'lavender'])}>
      <span className="absolute -bottom-4 -right-2 rotate-12 text-8xl opacity-30" aria-hidden>
        {cat?.emoji ?? '✨'}
      </span>
      {!noInitial && <span className="flex h-20 w-20 items-center justify-center rounded-full border-3 border-ink bg-white font-display text-4xl font-extrabold shadow-brutal">{name[0]}</span>}
    </div>
  );
}
