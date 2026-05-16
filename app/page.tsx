import { auth } from '@clerk/nextjs/server';
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
      'ZapText is an AI WhatsApp bot built for Indian restaurants — kitchens, cafes, cloud kitchens, sweet shops, and bakeries. It takes orders, runs dine-in QR ordering, routes multi-outlet chains, sends UPI payment links, and handles every Indian language (Hindi, English, Hinglish, Punjabi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam).',
  },
  {
    question: 'How long does it take to set up the bot for my restaurant?',
    answer:
      "Onboarding (sub-type, cuisine, menu, FSSAI, GSTIN) takes about 5 minutes. WhatsApp Business API verification of your number typically takes 24-48 hours after that — Meta's side, not ours. Once verified, your bot is live and accepting orders.",
  },
  {
    question: 'Does the bot handle dine-in QR ordering?',
    answer:
      "Yes. Print one QR per table — customer scans, WhatsApp opens, they tap Send, get a menu link, place the order. Multi-outlet chains: each table's QR encodes its outlet so a Saket scan never lands in CP's KOT.",
  },
  {
    question: 'Can the bot handle multiple outlets / branches on one WhatsApp number?',
    answer:
      "Yes. One WhatsApp number for the whole chain. The bot routes orders to the right outlet using the QR code, the customer's shared location, or a quick branch picker. Each outlet manager logs in with their own email and sees only their outlet's orders.",
  },
  {
    question: 'Does it understand Hindi voice notes?',
    answer:
      'Yes. Voice notes are transcribed via Groq Whisper. A customer saying "do paneer butter masala aur ek naan" lands on the menu page with the cart already populated. Works for Punjabi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam too.',
  },
  {
    question: 'How much does ZapText cost?',
    answer:
      'ZapText has tiered pricing starting at ₹599/month for single-outlet kitchens. Multi-outlet chains go on Growth (₹1,499) or Scale (₹3,999). See the Pricing section for full details and free-trial info.',
  },
];

export default async function Home() {
  // Skip the Clerk RPC for anonymous visitors — `auth()` reads only the
  // signed session cookie that Clerk middleware already validated, so
  // it's free. `currentUser()` (inside `getUserRole`) hits Clerk's API
  // over the network and was previously running on every landing-page
  // hit, including bots and first-time visitors with no session.
  const { userId } = await auth();
  if (userId) {
    const user = await getUserRole();
    if (user?.role === 'admin') redirect('/admin/dashboard');
    if (user?.role === 'client') redirect('/client/dashboard');
  }

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
