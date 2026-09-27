import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Companio — Rent a friend, not a date';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#FFF8EE', border: '16px solid #141414' }}>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#E4449C', letterSpacing: 4 }}>COMPANIO</div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 900, color: '#141414', lineHeight: 1.02, marginTop: 20 }}>Rent a friend,</div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 900, color: '#141414', lineHeight: 1.02 }}>
          <span style={{ background: '#C6F432', padding: '0 18px', border: '6px solid #141414' }}>not a date.</span>
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#3a3a3a', marginTop: 36 }}>Verified companions · 100% platonic · Escrow payments · SOS</div>
      </div>
    ),
    size,
  );
}
