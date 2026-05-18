// Lightweight URL validation for owner-supplied image URLs (product
// thumbnails, etc.). The strings end up rendered in <img src> on
// storefront / dashboard surfaces and (potentially) consumed by
// server-side fetchers later, so we apply a minimal SSRF/XSS gate:
//
//   - Must parse as an absolute URL.
//   - Scheme must be exactly `https:` (rejects javascript:, data:,
//     ftp:, blob:, plain http: — and refuses non-TLS image hosting
//     which Chrome would mixed-content-block anyway).
//   - Host must not be loopback, link-local, RFC1918 private, or
//     `*.local` / `*.internal`. Same allowlist style as the
//     /api/scrape SSRF guard.
//   - No embedded userinfo (`user:pass@host`) — defeats credential
//     smuggling tricks against any future server-side fetcher.
//
// Returns the canonicalised URL string if valid, otherwise null.
export function safeImageUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  const h = parsed.hostname.toLowerCase();
  if (!h) return null;
  if (['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '0'].includes(h)) return null;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return null;
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.)/.test(h)) return null;

  // IPv6 host (URL parser wraps in brackets).
  if (h.startsWith('[')) {
    const inner = h.replace(/^\[|\]$/g, '');
    if (inner === '::' || inner === '::1') return null;
    if (inner.startsWith('fe80:') || inner.startsWith('fc') || inner.startsWith('fd')) return null;
  }

  return parsed.toString();
}
