// Next.js App Router auto-generates the site's Open Graph image from this
// file at build time. Output is served at /opengraph-image-<hash>.png and
// auto-injected as `og:image` into every page's metadata.
//
// Brand mark is the real `public/logo.png` wordmark, loaded once from
// disk and embedded as a data URL — Satori inside ImageResponse can't
// fetch local /public assets at build time, so we hand it the bytes.

import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const alt = 'ZapText — AI WhatsApp Bots for Indian SMBs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LOGO_DATA_URL = (() => {
  const buf = readFileSync(join(process.cwd(), 'public', 'logo.png'));
  return `data:image/png;base64,${buf.toString('base64')}`;
})();

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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              background: '#FFFDF7',
              borderRadius: 18,
              padding: '14px 22px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_DATA_URL}
              alt=""
              width={260}
              height={72}
              style={{ width: 260, height: 72, objectFit: 'contain' }}
            />
          </div>
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
