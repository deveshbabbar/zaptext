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
    ];
  },
};

export default nextConfig;
