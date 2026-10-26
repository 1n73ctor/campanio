import type { Post } from '@companio/types';
import { POSTS } from './blog';
import { safe, serverApi } from './server-api';

/** Built-in posts plus those published from Admin → Blog, newest first. */
export async function allPosts(): Promise<Post[]> {
  const stored = await safe(serverApi(300).content.posts(), []);
  const seen = new Set(POSTS.map((p) => p.slug));
  return [...POSTS, ...stored.filter((p) => !seen.has(p.slug))].sort((a, b) => b.date.localeCompare(a.date));
}
