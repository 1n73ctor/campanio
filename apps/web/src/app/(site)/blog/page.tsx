import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@companio/ui';
import { PageHeader } from '@/components/misc';
import { allPosts } from '@/lib/posts';
import { fmtDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Blog', description: 'Guides on making friends in a new city, safety, and earning as a host.', alternates: { canonical: '/blog' } };

export const revalidate = 300;

export default async function Blog() {
  const posts = await allPosts();
  return (
    <div className="container-x max-w-5xl">
      <PageHeader eyebrow="Blog" title="Stories & guides" />
      <div className="grid gap-5 md:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`}>
            <Card interactive tone={p.tone} className="flex h-full flex-col p-5">
              <span className="text-4xl">{p.emoji}</span>
              <h2 className="mt-3 text-xl font-extrabold leading-tight">{p.title}</h2>
              <p className="mt-2 flex-1 text-sm text-ink-soft">{p.excerpt}</p>
              <p className="mt-4 text-xs font-semibold">{fmtDate(p.date)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
