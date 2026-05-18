// Apple touch icon (iOS / iPadOS home-screen). Same approach as
// `app/icon.tsx` — render the real brand Z-bolt from
// `public/favicon.png` via ImageResponse at 180x180 so iOS clients
// receive a small, correctly-branded icon instead of either a hardcoded
// "Z" letter or the full 2 MB source PNG.
//
// `readFile` lives inside the default export per Next.js 16 docs to
// avoid a module-init IIFE that could fail if CWD differs at import
// time. Module-level cache memoises the result for warm lambdas.

import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

let cachedDataUrl: string | null = null;
async function loadFaviconDataUrl(): Promise<string> {
  if (cachedDataUrl) return cachedDataUrl;
  const buf = await readFile(join(process.cwd(), 'public', 'favicon.png'));
  cachedDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  return cachedDataUrl;
}

export default async function AppleIcon() {
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
          background: '#FFFDF7',
          borderRadius: 36,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt=""
          width={150}
          height={150}
          style={{ width: 150, height: 150, objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size },
  );
}
