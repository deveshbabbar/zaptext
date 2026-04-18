import { getUserRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LandingPage from '@/components/landing/landing-page';
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  WebSiteJsonLd,
  FaqJsonLd,
} from '@/components/seo/structured-data';

const LANDING_FAQS = [
  {
    question: 'What is ZapText?',
    answer:
      'ZapText is an AI WhatsApp bot platform for Indian small and medium businesses. It lets clinics, restaurants, coaching institutes, salons, real estate agents, D2C brands, and gyms automate customer conversations on WhatsApp in Hindi, English, and Hinglish.',
  },
  {
    question: 'How long does it take to set up a WhatsApp bot?',
    answer:
      'Most businesses can go live in under 5 minutes. You pick your business type, fill a short form about your products or services, and the bot is trained automatically.',
  },
  {
    question: 'Does the bot understand Hindi and Hinglish?',
    answer:
      'Yes. The bot is tuned for how Indian customers actually type on WhatsApp — Hindi, English, Hinglish, emojis, voice notes, and short informal messages.',
  },
  {
    question: 'Do I need a new WhatsApp number?',
    answer:
      'Yes, you need a number that has never been used on WhatsApp before. Once we register it on the WhatsApp Business API, it cannot be used for regular WhatsApp on any phone.',
  },
  {
    question: 'How much does ZapText cost?',
    answer:
      'ZapText offers multiple plans including a starter tier. See the Subscription page after sign-up for current pricing in INR.',
  },
];

export default async function Home() {
  const user = await getUserRole();
  if (user?.role === 'admin') redirect('/admin/dashboard');
  if (user?.role === 'client') redirect('/client/dashboard');

  return (
    <>
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <WebSiteJsonLd />
      <FaqJsonLd items={LANDING_FAQS} />
      <LandingPage />
    </>
  );
}
