// Next.js App Router auto-generates the site's Open Graph image from this
// file at build time. Output is served at /opengraph-image-<hash>.png and
// auto-injected as `og:image` into every page's metadata, replacing the
// previous broken pointer to `/og-image.png` (file did not exist).

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ZapText — AI WhatsApp Bots for Indian SMBs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #14130F 0%, #2a2722 100%)',
          color: '#FFFDF7',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: 80,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: '#C8FF6E',
              color: '#14130F',
              fontSize: 56,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace',
            }}
          >
            Z
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex' }}>ZapText</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              maxWidth: 980,
              display: 'flex',
            }}
          >
            Bots that book, collect, close.
          </div>
          <div
            style={{
              fontSize: 30,
              color: '#A8A395',
              lineHeight: 1.4,
              maxWidth: 900,
              display: 'flex',
            }}
          >
            WhatsApp AI for Indian businesses · Hindi + regional · Multi-bot · FSSAI/RERA compliant · Voice-note ready · Try free.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              padding: '14px 24px',
              borderRadius: 14,
              background: '#C8FF6E',
              color: '#14130F',
              fontSize: 24,
              fontWeight: 800,
              display: 'flex',
            }}
          >
            ₹599/mo · No setup fee
          </div>
          <div style={{ fontSize: 22, color: '#A8A395', fontFamily: 'monospace', display: 'flex' }}>
            zaptext.shop
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
