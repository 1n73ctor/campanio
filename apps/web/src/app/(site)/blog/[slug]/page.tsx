import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass } from '@companio/ui';
import { JsonLd, Prose } from '@/components/misc';
import { POSTS } from '@/lib/blog';
import { fmtDate } from '@/lib/format';
import { SITE_URL } from '@/lib/env';

export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.excerpt, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { type: 'article', title: p.title, description: p.excerpt } } : {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) notFound();
  return (
    <article className="container-x max-w-2xl py-10">
      <Link href="/blog" className="text-sm font-semibold underline">
        ← Blog
      </Link>
      <p className="mt-6 text-5xl">{p.emoji}</p>
      <h1 className="mt-3 text-4xl font-extrabold leading-tight">{p.title}</h1>
      <p className="mt-2 text-sm text-ink-mute">{fmtDate(p.date)}</p>
      <div className="mt-8">
        <Prose>
          {p.body.map((b, i) =>
            typeof b === 'string' ? (
              <p key={i}>
                <Inline text={b} />
              </p>
            ) : 'h' in b ? (
              <h2 key={i}>{b.h}</h2>
            ) : (
              <ul key={i} className="space-y-1.5">
                {b.ul.map((li) => (
                  <li key={li}>
                    <Inline text={li} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </Prose>
      </div>
      <Link href="/explore" className={buttonClass('primary', 'lg', 'mt-10')}>
        Find a companion
      </Link>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date, description: p.excerpt, url: `${SITE_URL}/blog/${p.slug}` }} />
    </article>
  );
}

/** **bold** and [text](/internal/link) inside a paragraph. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link)
          return (
            <Link key={i} href={link[2]} className="font-semibold text-ink underline">
              {link[1]}
            </Link>
          );
        return part;
      })}
    </>
  );
}
