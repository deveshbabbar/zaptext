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
      // The CSP is intentionally permissive on script-src because the
      // app uses Razorpay's checkout SDK and Clerk's frontend SDK,
      // both of which inject scripts at runtime — we whitelist their
      // hosts instead of blocking them outright. 'unsafe-inline' is
      // required by Next.js hydration bootstrap; 'unsafe-eval' is
      // required by Clerk's runtime. If you tighten further, test
      // sign-in, payment flow, and Razorpay's checkout iframe.
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.clerk.accounts.dev https://*.clerk.dev https://clerk.com https://challenges.cloudflare.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://*.clerk.accounts.dev https://*.clerk.dev https://clerk.com https://vitals.vercel-insights.com wss:",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
