import type { Metadata } from 'next';
import { ViewAsStart } from './view-as-start';

export const metadata: Metadata = { title: 'Admin view', robots: { index: false, follow: false } };

export default function ViewAsPage() {
  return <ViewAsStart />;
}
