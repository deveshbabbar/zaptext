const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zaptext.shop';

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ZapText',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      'AI WhatsApp bots for Indian SMBs — clinics, restaurants, coaching, salons, real estate, D2C, and gyms.',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@zaptext.shop',
        availableLanguage: ['en', 'hi'],
        areaServed: 'IN',
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ZapText',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'AI WhatsApp bots that understand Hindi, English & Hinglish. Built for Indian SMBs. Live in 5 minutes.',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
    inLanguage: ['en', 'hi'],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ZapText',
    url: SITE_URL,
    inLanguage: 'en-IN',
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FaqJsonLd({ items }: { items: { question: string; answer: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
