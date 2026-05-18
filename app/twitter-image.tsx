// Twitter card image — same shape as Open Graph. Next.js convention
// auto-injects this as `twitter:image` for every page.
//
// Note: Turbopack rejects re-exporting `runtime`/`size`/`alt` from
// `./opengraph-image`, so we duplicate the small constants here.
//
// Runs on the default nodejs runtime (NOT edge) because
// `./opengraph-image` reads `public/logo.png` from disk via `fs` at
// module init.

import OpengraphImage from './opengraph-image';

export const alt = 'ZapText — AI WhatsApp Bots for Indian SMBs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function TwitterImage() {
  return OpengraphImage();
}
