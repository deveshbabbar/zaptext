// Apple touch icon (home-screen). Generated at the edge instead of being
// served from the 649 KB `public/logo.png` that the previous metadata
// override pointed iOS clients at.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#14130F',
          color: '#C8FF6E',
          fontSize: 130,
          fontWeight: 900,
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
        }}
      >
        Z
      </div>
    ),
    { ...size },
  );
}
