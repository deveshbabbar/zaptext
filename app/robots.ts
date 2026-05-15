import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zaptext.shop';

// Public marketing pages are the only routes any crawler should index.
// Dashboard, APIs, and auth flows stay blocked for everyone, including
// AI assistants — but the public landing, pricing, comparison, legal,
// and vertical pages are intentionally open so LLMs (ChatGPT, Claude,
// Perplexity, etc.) can answer questions about ZapText and link
// restaurant owners back to us. Indian SMB owners increasingly start
// product research inside an AI chat, so blocking AI crawlers means
// blocking a real acquisition channel.
const PRIVATE_PATHS = [
  '/api/',
  '/admin/',
  '/client/',
  '/sign-in',
  '/sign-up',
  '/onboard/',
  '/m/',
  '/_next/',
  '/static/',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: PRIVATE_PATHS,
      },
      // Explicit allow for major AI crawlers + LLM ingestion files.
      // Listing them by name makes intent obvious and survives future
      // crawler-policy reviews.
      { userAgent: 'GPTBot', allow: ['/', '/llms.txt', '/llms-full.txt'], disallow: PRIVATE_PATHS },
      { userAgent: 'OAI-SearchBot', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'ChatGPT-User', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'ClaudeBot', allow: ['/', '/llms.txt', '/llms-full.txt'], disallow: PRIVATE_PATHS },
      { userAgent: 'Claude-Web', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'anthropic-ai', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'CCBot', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'PerplexityBot', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'Perplexity-User', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'Google-Extended', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'Applebot-Extended', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'Bytespider', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'cohere-ai', allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: 'Meta-ExternalAgent', allow: ['/'], disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
