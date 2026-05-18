// Browser-tab favicon. Renders the brand Z-bolt from
// `public/favicon.png` via `ImageResponse` so the browser only ever
// downloads a 32x32 PNG even though the source artwork is large.
//
// Why not file-convention (`app/icon.png`)? The source favicon.png is
// ~2 MB at high resolution; serving it raw forces every visitor to pull
// the full file just for a tab icon. Loading it once at build via Node
// fs and re-rasterising to 32x32 inside ImageResponse keeps the wire
// payload small while still showing the real logo.
//
// `fs` requires the nodejs runtime (default). Next.js still statically
// optimises this route at build time.

import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

const FAVICON_DATA_URL = (() => {
  const buf = readFileSync(join(process.cwd(), 'public', 'favicon.png'));
  return `data:image/png;base64,${buf.toString('base64')}`;
})();

export default function Icon() {
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
          src={FAVICON_DATA_URL}
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
