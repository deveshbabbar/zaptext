import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://zaptext.shop";
const SITE_NAME = "ZapText";
const DESCRIPTION =
  "AI WhatsApp bots that understand Hindi, English & Hinglish. Built for Indian SMBs — clinics, restaurants, coaching, salons, real estate, D2C & gyms. Live in 5 minutes.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI WhatsApp Bots for Indian Businesses`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "WhatsApp bot",
    "WhatsApp AI bot",
    "WhatsApp chatbot India",
    "Hindi WhatsApp bot",
    "Hinglish chatbot",
    "WhatsApp Business API",
    "SMB automation India",
    "restaurant WhatsApp bot",
    "clinic appointment bot",
    "coaching institute chatbot",
    "salon booking bot",
    "real estate WhatsApp bot",
    "D2C customer support bot",
    "gym membership bot",
    "ZapText",
  ],
  authors: [{ name: "ZapText" }],
  creator: "ZapText",
  publisher: "ZapText",
  category: "Business",
  referrer: "origin-when-cross-origin",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI WhatsApp Bots for Indian Businesses`,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ZapText — AI WhatsApp Bots for Indian Businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI WhatsApp Bots for Indian SMBs`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/logo.png", sizes: "any" }],
    apple: [{ url: "/logo.png" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <main className="flex-1">
              {children}
            </main>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
