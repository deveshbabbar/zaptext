// Apple touch icon (iOS / iPadOS home-screen). Same approach as
// `app/icon.tsx` — render the real brand Z-bolt from
// `public/favicon.png` via ImageResponse at 180x180 so iOS clients
// receive a small, correctly-branded icon instead of either a hardcoded
// "Z" letter or the full 2 MB source PNG.

import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const FAVICON_DATA_URL = (() => {
  const buf = readFileSync(join(process.cwd(), 'public', 'favicon.png'));
  return `data:image/png;base64,${buf.toString('base64')}`;
})();

export default function AppleIcon() {
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
          src={FAVICON_DATA_URL}
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
