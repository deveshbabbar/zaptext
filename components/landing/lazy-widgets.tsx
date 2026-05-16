"use client";

// Tiny client wrapper that defers loading the three heavier below-the-
// fold widgets. They were previously lazy-loaded via next/dynamic from
// the (now server-rendered) landing-page.tsx — `ssr: false` is only
// valid inside client components, so the dynamic calls live here.

import dynamic from "next/dynamic";

const ROICalculator = dynamic(
  () => import("@/components/landing/roi-calculator").then((m) => m.ROICalculator),
  { ssr: false, loading: () => null },
);
const WhatsAppDemoWidget = dynamic(
  () => import("@/components/landing/whatsapp-demo-widget").then((m) => m.WhatsAppDemoWidget),
  { ssr: false, loading: () => null },
);
const ReferralCapture = dynamic(
  () => import("@/components/landing/referral-capture").then((m) => m.ReferralCapture),
  { ssr: false, loading: () => null },
);

export function ReferralCaptureLazy() {
  return <ReferralCapture />;
}

export function ROICalculatorLazy() {
  return <ROICalculator />;
}

export function WhatsAppDemoWidgetLazy() {
  return <WhatsAppDemoWidget />;
}
