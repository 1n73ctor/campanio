import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass } from '@companio/ui';
import { JsonLd } from '@/components/misc';
import { PostBody } from '@/components/post-body';
import { POSTS } from '@/lib/blog';
import { allPosts } from '@/lib/posts';
import { fmtDate } from '@/lib/format';
import { SITE_URL } from '@/lib/env';

// built-in posts are pre-rendered; ones published from the admin render on first visit (then cached)
export const dynamicParams = true;
export const revalidate = 300;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = (await allPosts()).find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.excerpt, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { type: 'article', title: p.title, description: p.excerpt } } : {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = (await allPosts()).find((x) => x.slug === slug);
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
        <PostBody body={p.body} />
      </div>
      <Link href="/explore" className={buttonClass('primary', 'lg', 'mt-10')}>
        Find a companion
      </Link>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date, description: p.excerpt, url: `${SITE_URL}/blog/${p.slug}` }} />
    </article>
  );
}

