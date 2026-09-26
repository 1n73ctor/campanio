/** Brand mark rendered by next/og (inline styles only — no Tailwind in ImageResponse). */
export function BrandMark({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FF7AC6' }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24">
        <circle cx="8.5" cy="10" r="3.2" fill="#141414" />
        <circle cx="15.5" cy="10" r="3.2" fill="#141414" />
        <path d="M5 17c1.8-2 4.6-2 7-0.2 2.4-1.8 5.2-1.8 7 0.2" stroke="#141414" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
