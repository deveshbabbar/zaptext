// Browser-tab favicon. Renders the brand Z-bolt from
// `public/favicon.png` via `ImageResponse` so the browser only ever
// downloads a 32x32 PNG even though the source artwork is large.
//
// Why not file-convention (`app/icon.png`)? The source favicon.png is
// ~2 MB at high resolution; serving it raw forces every visitor to pull
// the full file just for a tab icon. Loading it once via Node fs and
// re-rasterising to 32x32 inside ImageResponse keeps the wire payload
// small while still showing the real logo.
//
// `fs` requires the nodejs runtime (default). `readFile` lives inside
// the default export per Next.js 16's documented pattern — module-init
// IIFE reads can break if Turbopack/Vercel ever imports this module
// from a context where CWD differs from the project root. The module-
// level `let` memo means the read still happens at most once per
// warm lambda.

import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

let cachedDataUrl: string | null = null;
async function loadFaviconDataUrl(): Promise<string> {
  if (cachedDataUrl) return cachedDataUrl;
  const buf = await readFile(join(process.cwd(), 'public', 'favicon.png'));
  cachedDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  return cachedDataUrl;
}

export default async function Icon() {
  const dataUrl = await loadFaviconDataUrl();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt=""
          width={32}
          height={32}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size },
  );
}
