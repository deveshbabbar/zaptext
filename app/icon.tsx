// Generated favicon — replaces the 649 KB 2000x2000 `app/icon.png` that
// every visitor had to download just for a 32x32 tab icon. ImageResponse
// renders a tiny PNG at the edge, cached by the CDN.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#14130F',
          color: '#C8FF6E',
          fontSize: 22,
          fontWeight: 900,
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        Z
      </div>
    ),
    { ...size },
  );
}
