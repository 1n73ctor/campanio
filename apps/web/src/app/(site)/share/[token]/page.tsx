import type { Metadata } from 'next';
import { ShareView } from './share-view';

export const metadata: Metadata = { title: 'Shared session', robots: { index: false, follow: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ShareView token={token} />;
}
