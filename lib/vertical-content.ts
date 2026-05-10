// ─── Vertical-specific landing page content ───
//
// Source of truth for the per-vertical landing page (rendered by
// app/[vertical]/page.tsx). Each entry has the marketing copy tuned
// to that vertical's pain points + customer voice.
//
// Why this exists: a single generic landing page is impossible to
// rank for "tiffin service WhatsApp bot" or "salon booking automation".
// Vertical-specific pages with vertical-specific keywords win long-tail
// SEO + Instagram/Facebook ads convert 3-4x better when the landing
// page matches the ad creative's vertical.

import type { BusinessType } from './types';

export interface VerticalCopy {
  pageTitle: string;
  metaDescription: string;
  hero: string;
  subHero: string;
  painPoints: string[];
  exampleConversation: Array<{ from: 'customer' | 'bot'; text: string }>;
  ctaText: string;
}

export const VERTICAL_CONTENT: Record<BusinessType, VerticalCopy> = {
  restaurant: {
    pageTitle: 'WhatsApp ordering bot for restaurants & cloud kitchens — ZapText',
    metaDescription:
      'Take orders directly on WhatsApp. AI bot handles menu queries, orders, and delivery questions in Hindi/English/Hinglish. ₹599/mo. No card required to start.',
    hero: 'Take WhatsApp orders without picking up the phone.',
    subHero:
      'Your AI bot answers menu queries, takes orders, and handles delivery questions — in Hindi, English, or Hinglish — 24/7. ZapText is a Wati alternative built for Indian restaurants and cloud kitchens.',
    painPoints: [
      '"Aaj veg biryani milegi?" — answered instantly with today\'s menu',
      'Orders auto-confirmed with delivery time, no manual reply needed',
      'Zomato/Swiggy busy? Customer can order direct on WhatsApp',
      'Specials/offers broadcast to opted-in customers, not random ads',
    ],
    exampleConversation: [
      { from: 'customer', text: 'kal raat 4 paneer butter masala chahiye, deliver hoga?' },
      {
        from: 'bot',
        text:
          'Ji haan! Paneer Butter Masala 4 plates — ₹1,200 + ₹40 delivery. Address share kar dijiye, kal raat 9 PM tak deliver kar denge.',
      },
      { from: 'customer', text: 'address: B-204 Lodhi Apts, payment online' },
      {
        from: 'bot',
        text:
          '✅ Order confirmed! Payment link: pay.zaptext.io/o-9234. Owner ko notify kar diya, ETA: 9:00 PM. Order ID: #4521.',
      },
    ],
    ctaText: 'Start your restaurant bot — free',
  },
  tiffin: {
    pageTitle: 'WhatsApp bot for tiffin services — subscription orders on autopilot — ZapText',
    metaDescription:
      'Daily/monthly tiffin subscription orders on WhatsApp. Bot handles menu rotation, delivery area, custom requests (Jain/no-onion). ₹599/mo. Made for Indian tiffin services.',
    hero: 'Tiffin subscriptions, every dabba — handled on WhatsApp.',
    subHero:
      'Your AI bot answers "aaj ka menu kya hai?", takes monthly/weekly subscriptions, and handles delivery area questions. Built for Indian tiffin auntyji and dabba services.',
    painPoints: [
      'Daily 30+ "aaj ka menu" queries — bot replies with weekly rotation',
      'Subscription signups taken on WhatsApp, no separate app needed',
      'Jain / no-onion / less-spicy custom requests handled cleanly',
      'Delivery area + timing answered before you waste time on out-of-zone leads',
    ],
    exampleConversation: [
      { from: 'customer', text: 'bhaiya monthly tiffin chahiye, Andheri E mein deliver karoge?' },
      {
        from: 'bot',
        text:
          'Andheri East mein deliver karte hain ji. Monthly Lunch (30 tiffins) — ₹2,500. Includes: 4 chapati + 1 sabzi + dal + rice + salad. Lunch delivery 12-2 PM. Trial dabba bhi free milta hai pehle din. Start karna hai?',
      },
      { from: 'customer', text: 'haan trial bhej do kal, no onion no garlic' },
      {
        from: 'bot',
        text:
          'Bilkul ji, no-onion-no-garlic note kar liya. Address + phone confirm kar dijiye. Owner ko bhej diya, kal 12:30 PM tak pahonch jayega.',
      },
    ],
    ctaText: 'Start your tiffin bot — free',
  },
  salon: {
    pageTitle: 'WhatsApp bot for salons & spas — bookings on autopilot — ZapText',
    metaDescription:
      'Take salon/spa bookings on WhatsApp. Bot handles service rates, package queries, stylist availability, bridal bookings. ₹599/mo. Wati alternative for Indian salons.',
    hero: 'Bookings booked while you cut hair.',
    subHero:
      "Your bot answers rate-list queries, books appointments with the right stylist, and handles bridal/party bookings — in your customer's language. No more juggling phone calls.",
    painPoints: [
      'Rate list questions — replied with current pricing',
      'Bookings tied to specific stylist + their availability',
      'Bridal/party packages quoted clearly with what\'s included',
      'Home-service requests routed correctly with extra charges',
    ],
    exampleConversation: [
      { from: 'customer', text: 'kal Saturday haircut karna hai shaam ko' },
      {
        from: 'bot',
        text:
          'Sure ji! Saturday available slots — 5:00 PM, 5:30 PM, 6:00 PM. Stylist preference: Priya didi or Anu didi? Haircut starting from ₹500.',
      },
      { from: 'customer', text: 'Priya didi 5:30' },
      {
        from: 'bot',
        text:
          '✅ Booked: Saturday 5:30 PM with Priya. Total: ₹500. Owner approval pending — confirm message ek minute mein milega.',
      },
    ],
    ctaText: 'Start your salon bot — free',
  },
  gym: {
    pageTitle: 'WhatsApp bot for gyms & fitness studios — trial signups on autopilot — ZapText',
    metaDescription:
      'Gym/fitness trial bookings on WhatsApp. Bot answers membership pricing, trainer availability, class schedules. ₹599/mo. Built for Indian gyms and yoga studios.',
    hero: 'Trial bookings — even when the gym is closed.',
    subHero:
      'Your bot pitches the trial offer, books membership tours, answers class schedule questions, and routes personal training enquiries to the right trainer. 24/7.',
    painPoints: [
      'Membership pricing answered with the right plan for their goal',
      'Free trial booking — main hook for new gym leads',
      'Trainer-specific PT bookings + their availability',
      'Group class schedule queries (yoga, zumba, crossfit) handled',
    ],
    exampleConversation: [
      { from: 'customer', text: 'monthly gym membership kitne ki hai?' },
      {
        from: 'bot',
        text:
          'Monthly: ₹2,000 (gym access + 1 class/day). 3-month: ₹5,500 (₹500 saving). 1 year: ₹18,000 (3 months free). Plus FREE 3-day trial. Trial book kar lein?',
      },
      { from: 'customer', text: 'haan trial kal try karna hai morning' },
      {
        from: 'bot',
        text:
          'Pakka ji! Trial booked — kal 6 AM-9 AM ka slot. Gym address pin: maps.app.goo.gl/xxxx. Owner ko notify kar diya, koi questions ho toh batao.',
      },
    ],
    ctaText: 'Start your gym bot — free',
  },
  coaching: {
    pageTitle: 'WhatsApp bot for coaching centres & tutors — demo class signups — ZapText',
    metaDescription:
      'Coaching/tuition demo class bookings on WhatsApp. Bot handles fee queries, batch timings, faculty info, results. ₹599/mo. For Indian coaching institutes.',
    hero: 'Convert "fees kitni hai?" into demo class signups.',
    subHero:
      'Your bot shares course fees, batch timings, faculty credentials, and results — and books demo classes with parents in their language. Lead nurturing on autopilot.',
    painPoints: [
      'Fee/batch queries answered without a counsellor on the phone',
      'Demo class bookings — the strongest conversion lever for coaching',
      'Faculty credentials + past results shared confidently',
      'Online vs offline mode clarified for hybrid institutes',
    ],
    exampleConversation: [
      { from: 'customer', text: 'NEET coaching ki fees kya hai aur batch timing?' },
      {
        from: 'bot',
        text:
          'NEET 11th-12th batch — ₹85,000/year (full course). Timings: Mon-Sat 6 AM-9 AM. Faculty: 2 IIT-pass-out teachers, last batch result 78% qualifiers. Aap demo class le sakte ho free, available this Saturday — book karna hai?',
      },
      { from: 'customer', text: 'haan Saturday demo book kar do, student ka naam Rohit' },
      {
        from: 'bot',
        text:
          '✅ Demo booked: Saturday 6 AM, NEET batch. Student: Rohit. Address bheji link mein. Counsellor 1 din pehle confirm call karega.',
      },
    ],
    ctaText: 'Start your coaching bot — free',
  },
  realestate: {
    pageTitle: 'WhatsApp bot for real estate agents & brokers — site visit bookings — ZapText',
    metaDescription:
      'Real estate property enquiries on WhatsApp. Bot shares listings, RERA, books site visits, handles home loan questions. ₹599/mo. For Indian property brokers.',
    hero: 'Site visits booked. Time-wasters filtered.',
    subHero:
      'Your bot answers area + budget queries, shares current listings, books site visits with the agent, and handles home loan questions — without you wasting calls on tyre-kickers.',
    painPoints: [
      'Property availability in specific areas answered instantly',
      'Site visit booking — the actual conversion goal',
      'RERA number shared on demand for serious buyers',
      'Home loan assistance routed to the right partner bank',
    ],
    exampleConversation: [
      { from: 'customer', text: '2BHK in Whitefield, budget 80L, ready possession' },
      {
        from: 'bot',
        text:
          'Whitefield mein 2 BHK ready possession options hain ji — Prestige Sunrise Park (78L, 1100 sqft) and Mantri Webcity (84L, 1180 sqft). Site visit kal book kar dein? Saturday 11 AM ka slot empty hai.',
      },
      { from: 'customer', text: 'haan Saturday 11 chalo, RERA number share karo dono ka' },
      {
        from: 'bot',
        text:
          '✅ Site visit booked Sat 11 AM. RERA — Prestige: PRM/KA/RERA/1234, Mantri: PRM/KA/RERA/5678. Owner aapko call karega 1 din pehle confirm karne ke liye.',
      },
    ],
    ctaText: 'Start your real estate bot — free',
  },
  d2c: {
    pageTitle: 'WhatsApp bot for D2C brands — order tracking & DM-to-purchase — ZapText',
    metaDescription:
      'D2C brand customer support on WhatsApp. Bot handles order tracking, returns, COD queries, abandoned cart recovery. ₹599/mo. For Indian D2C brands.',
    hero: 'DM-to-purchase. Cart-recovery. Order tracking. All on autopilot.',
    subHero:
      'Your bot handles order status, returns, COD questions, and even pushes website links for purchases — turning Instagram DMs into orders without a support team.',
    painPoints: [
      'Order tracking by ID — most common query, fully automated',
      'Returns/refunds policy shared cleanly when asked',
      'COD availability + city check answered instantly',
      'Abandoned cart recovery via WhatsApp (with opt-in)',
    ],
    exampleConversation: [
      { from: 'customer', text: 'order #4521 ka status kya hai?' },
      {
        from: 'bot',
        text:
          'Order #4521 — Vitamin C Serum + Toner. Status: Out for delivery 📦. Tracking: dl.in/track-4521. Aaj shaam tak pahonch jayega.',
      },
      { from: 'customer', text: 'COD karte ho tier 2 cities mein?' },
      {
        from: 'bot',
        text:
          'COD available 25,000+ pincodes mein — apna pincode batao, instant check kar deta hoon. Order karne ke liye website: glowup.in 🛍️',
      },
    ],
    ctaText: 'Start your D2C bot — free',
  },
  ecommerce: {
    pageTitle: 'WhatsApp bot for e-commerce & D2C brands — orders, tracking & cart recovery — ZapText',
    metaDescription:
      'WhatsApp AI bot for online shops & D2C brands — fashion, beauty, electronics, gifts, home, multi-category. Handles product queries, Instagram DM-to-purchase, order tracking, COD pincode checks, returns, abandoned cart recovery. ₹599/mo. Wati / Interakt alternative built for Indian e-commerce sellers.',
    hero: 'Your online shop, on WhatsApp — answered in seconds.',
    subHero:
      'For D2C brands and multi-category stores — your AI bot answers product queries, shares the catalog, turns Instagram DMs into orders, tracks parcels, handles COD/return questions, and recovers abandoned carts — in Hindi, English, or Hinglish — 24/7. Wati / Interakt alternative built for Indian e-commerce.',
    painPoints: [
      '"Yeh kapde S size mein hai?" — answered with catalog + price + stock',
      'Instagram/Facebook DMs converted into orders, not lost in unread inbox',
      'Order tracking by ID, no more "kaha hai mera parcel" calls',
      'COD pincode check answered instantly, no manual lookup',
      'Return / exchange policy shared cleanly when asked',
      'Abandoned cart recovery via WhatsApp (with opt-in)',
      'Festive offers + new drops broadcast to opted-in customers, not random ads',
    ],
    exampleConversation: [
      { from: 'customer', text: 'kurta set dikhao under 1500, M size mein' },
      {
        from: 'bot',
        text:
          'Ji haan! M size, ₹1,500 ke andar 4 options hain:\n• Floral Cotton Kurta Set — ₹1,199 ⭐\n• Anarkali Suit (Pink) — ₹1,449\n• Straight-Cut Kurta Set — ₹999\n• A-Line Kurta + Dupatta — ₹1,299\n\nKisi ka detail bhejun ya cart mein add karun?',
      },
      { from: 'customer', text: 'pehla wala 1199 wala. COD karte ho 110064 pincode pe?' },
      {
        from: 'bot',
        text:
          'COD available hai 110064 pe ✅. Floral Cotton Kurta Set (M, ₹1,199) cart mein add kar diya. Free shipping above ₹999, delivery in 3-5 days. Order place karne ka link: shop.example.com/checkout/9234. Order ID milte hi tracking yahin aa jayega.',
      },
    ],
    ctaText: 'Start your e-commerce bot — free',
  },
  grocery: {
    pageTitle: 'WhatsApp bot for grocery, sabziwalas & kirana — daily order on autopilot — ZapText',
    metaDescription:
      'Sabziwala, fruit-wala, kirana, dairy, bakery — daily WhatsApp catalog, customer order via tap or text, slot-based delivery, COD. ₹599/mo. Built for Indian local fresh ecom.',
    hero: 'WhatsApp pe order le, list bheje, paisa cash le.',
    subHero:
      'Sabziwala, fruit-wala, kirana — daily catalog WhatsApp pe, customer tap karke order kare, delivery slot khud chune. ₹599/mo se shuru.',
    painPoints: [
      'Roz subah customers ko phone karke order leke thak gaye',
      'WhatsApp pe order aate hain par list rakhna mushkil hai',
      'Stock out hone par customer ko alternative offer karna manual hai',
      'Recurring weekly orders bhool jaate hain',
    ],
    exampleConversation: [
      { from: 'customer', text: 'bhaiya aaj ki list dikhao, kal subah delivery chahiye' },
      {
        from: 'bot',
        text:
          'Aaj fresh: Tamatar ₹40/kg, Pyaaz ₹35/kg, Aloo ₹25/kg, Bhindi ₹60/kg, Dhaniya ₹10/bunch, Doodh (Amul) ₹66/L. Delivery slot kal subah 7-9 AM ya 9-11 AM — kaunsa chahiye? Min order ₹150, COD available.',
      },
      { from: 'customer', text: 'tamatar 1kg pyaaz 500g aloo 2kg dhaniya 1, 7-9 AM slot' },
      {
        from: 'bot',
        text:
          '✅ Order: Tamatar 1kg ₹40 + Pyaaz 500g ₹18 + Aloo 2kg ₹50 + Dhaniya ₹10 = ₹118. Min order ₹150 hai ji — ek aur item add kar dein? (Bhindi/Doodh/Atta?) Slot kal 7-9 AM hold kar liya, address confirm kar dijiye.',
      },
    ],
    ctaText: 'Start your grocery bot — free',
  },
};

export function getVerticalContent(type: BusinessType): VerticalCopy {
  return VERTICAL_CONTENT[type];
}
