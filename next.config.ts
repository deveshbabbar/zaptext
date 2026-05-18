import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // gzip/brotli the HTML, JS, CSS Next emits — biggest single perf
  // win for slow connections (most Indian restaurant owners are on 4G).
  compress: true,
  reactStrictMode: true,
  // Serve AVIF/WebP when next/image is used so phones don't pull
  // full-size PNGs over slow 4G.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  // Tree-shake heavy packages that re-export thousands of icons /
  // utilities the app only uses a handful of. Cuts bundle size on
  // first paint substantially.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@base-ui/react",
      "sonner",
    ],
  },
  // Don't ship source maps to browsers in prod — saves bandwidth.
  productionBrowserSourceMaps: false,
  // Long-cache anything served from /public (logo, og images, etc).
  // Next already does this for /_next/static — this covers the rest.
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff2|woff)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Baseline security headers applied to EVERY response. Defense-
      // in-depth — Clerk + middleware already handle auth; this layer
      // mitigates clickjacking (X-Frame-Options), MIME-sniffing
      // (X-Content-Type-Options), insecure referer leakage
      // (Referrer-Policy), aggressive prefetch (X-DNS-Prefetch-Control),
      // and forces HTTPS for return visits (HSTS).
      //
      // NOTE on Content-Security-Policy: an earlier version of this
      // file shipped a `default-src 'self'` CSP with a Clerk + Razorpay
      // host allowlist. In production the Clerk sign-in / sign-up
      // widgets disappeared because:
      //   1) Custom Clerk domains (e.g. clerk.zaptext.shop) weren't
      //      on the allowlist — only the `*.clerk.accounts.dev` dev
      //      hosts.
      //   2) Clerk uses web workers spawned from blob: URLs, which
      //      need `worker-src 'self' blob:` to load.
      //   3) Clerk's CAPTCHA challenge and a few inline-style fragments
      //      need additional `connect-src` / `frame-src` hosts.
      //
      // Until a CSP can be tested end-to-end against the real Clerk
      // production deployment + Razorpay checkout, we ship without
      // one. The other six headers below cover the OWASP defense-in-
      // depth basics; CSP is the only one that can break UI by
      // mis-allowlisting a host. Add CSP back once you can verify:
      //   - Sign-in + sign-up forms render and submit
      //   - Razorpay checkout opens and completes
      //   - Clerk session sync (long-poll over wss:) doesn't get blocked
      //   - The Clerk publishable key's actual frontend-API host is
      //     in the allowlist (it's encoded in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
