import { ImageResponse } from 'next/og';
import { BrandMark } from '@/components/brand-mark';

export function generateStaticParams() {
  return [{ size: '192' }, { size: '512' }];
}

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = size === '512' ? 512 : 192;
  return new ImageResponse(<BrandMark size={s} />, { width: s, height: s });
}
