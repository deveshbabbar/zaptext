import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zaptext.shop';

// Vertical landing pages live at /[vertical] and target long-tail SEO
// (e.g. "tiffin service WhatsApp bot"). Keep this in sync with
// VERTICAL_CONTENT in lib/vertical-content.ts. `d2c` is intentionally
// excluded — that slug 301-redirects to /ecommerce after the merge.
const VERTICAL_SLUGS = [
  'restaurant',
  'tiffin',
  'salon',
  'gym',
  'coaching',
  'realestate',
  'ecommerce',
  'grocery',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/compare', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.4, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.4, changeFrequency: 'yearly' },
    { path: '/refund', priority: 0.4, changeFrequency: 'yearly' },
    { path: '/cancellation', priority: 0.4, changeFrequency: 'yearly' },
    { path: '/sign-in', priority: 0.5, changeFrequency: 'yearly' },
    { path: '/sign-up', priority: 0.5, changeFrequency: 'yearly' },
  ];

  const verticalRoutes: typeof staticRoutes = VERTICAL_SLUGS.map((slug) => ({
    path: `/${slug}`,
    priority: 0.85,                          // higher than /about — these are conversion pages
    changeFrequency: 'monthly' as const,
  }));

  return [...staticRoutes, ...verticalRoutes].map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
