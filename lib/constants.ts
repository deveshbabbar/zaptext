import { BusinessTypeMeta, BusinessType, FAQ } from './types';

export const BUSINESS_TYPES: BusinessTypeMeta[] = [
  {
    type: 'restaurant',
    label: 'Restaurant / Cloud Kitchen',
    description: 'Restaurants, cafes, cloud kitchens, sweet shops, bakeries',
    icon: '🍽️',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  // TEMPORARILY HIDDEN 2026-05-14: focusing the product on the restaurant
  // vertical end-to-end before re-enabling the rest. Hiding via
  // `hidden: true` (rather than deleting) keeps existing non-restaurant
  // bots functional in dashboards — getBusinessTypeMeta() does not filter
  // on `hidden`, so labels/icons still render for legacy clients. Flip
  // these back to enable each vertical again.
  {
    type: 'coaching',
    label: 'Coaching Center / Tutor',
    description: 'Coaching institutes, private tutors, test prep centers',
    icon: '📚',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    hidden: true,
  },
  {
    type: 'realestate',
    label: 'Real Estate Agent',
    description: 'Property brokers, builders, real estate agencies',
    icon: '🏠',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    hidden: true,
  },
  {
    type: 'salon',
    label: 'Salon / Spa',
    description: 'Beauty salons, spas, barbershops, wellness centers',
    icon: '💇',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    hidden: true,
  },
  {
    // Deprecated 2026-05-10: merged into the broader `ecommerce` vertical.
    // Hidden from new-bot pickers via `hidden: true`, but kept here so
    // existing d2c bots keep their label/icon in dashboards and lookups.
    type: 'd2c',
    label: 'D2C E-commerce Brand',
    description: 'Online brands — skincare, fashion, food, accessories',
    icon: '🛍️',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
    hidden: true,
  },
  {
    type: 'ecommerce',
    label: 'E-commerce Store',
    description: 'Online shop — fashion, electronics, gifts, home, multi-category sellers',
    icon: '🛒',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    hidden: true,
  },
  {
    type: 'gym',
    label: 'Gym / Fitness Studio',
    description: 'Gyms, yoga studios, CrossFit boxes, fitness centers',
    icon: '💪',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    hidden: true,
  },
  {
    type: 'tiffin',
    label: 'Tiffin Service / Home Meals',
    description: 'Home-cooked meal subscriptions, dabba services, lunch/dinner delivery',
    icon: '🍱',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    hidden: true,
  },
  {
    type: 'grocery',
    label: 'Grocery / Vegetables / Fruits / Dairy',
    description: 'Sabziwala, fruit seller, kirana, dairy, bakery — daily fresh delivery',
    icon: '🥬',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    hidden: true,
  },
];

export function getBusinessTypeMeta(type: BusinessType): BusinessTypeMeta {
  return BUSINESS_TYPES.find((bt) => bt.type === type)!;
}

// ─── Default FAQ Templates ───

export const FAQ_TEMPLATES: Record<BusinessType, FAQ[]> = {
  restaurant: [
    { question: 'Menu dikhao', answer: '' },
    { question: 'Delivery available hai?', answer: '' },
    { question: 'Minimum order kitna hai?', answer: '' },
    { question: 'Payment kaise karein?', answer: '' },
    { question: 'Koi offer chal raha hai?', answer: '' },
  ],
  coaching: [
    { question: 'Admission kaise hota hai?', answer: '' },
    { question: 'Fees kitni hai?', answer: '' },
    { question: 'Demo class milegi?', answer: '' },
    { question: 'Results kaise hain?', answer: '' },
    { question: 'Online classes available hain?', answer: '' },
  ],
  realestate: [
    { question: 'Kya available hai is area mein?', answer: '' },
    { question: 'Site visit kaise book karein?', answer: '' },
    { question: 'Home loan help milegi?', answer: '' },
    { question: 'RERA number kya hai?', answer: '' },
    { question: 'Price negotiable hai?', answer: '' },
  ],
  salon: [
    { question: 'Rate list dikhao', answer: '' },
    { question: 'Appointment book karni hai', answer: '' },
    { question: 'Home service available hai?', answer: '' },
    { question: 'Bridal package kya hai?', answer: '' },
    { question: 'Kaunse brands use karte ho?', answer: '' },
  ],
  d2c: [
    { question: 'Order track karna hai', answer: '' },
    { question: 'Return kaise karein?', answer: '' },
    { question: 'COD available hai?', answer: '' },
    { question: 'Koi offer hai?', answer: '' },
    { question: 'Delivery kitne din mein hogi?', answer: '' },
  ],
  gym: [
    { question: 'Membership kitne ki hai?', answer: '' },
    { question: 'Trial available hai?', answer: '' },
    { question: 'Personal trainer milega?', answer: '' },
    { question: 'Timings kya hain?', answer: '' },
    { question: 'Kaunsi classes hain?', answer: '' },
  ],
  tiffin: [
    { question: 'Aaj ka menu kya hai?', answer: '' },
    { question: 'Monthly tiffin ka rate kya hai?', answer: '' },
    { question: 'Trial dabba milega?', answer: '' },
    { question: 'Delivery kis area mein karte ho?', answer: '' },
    { question: 'Jain / no-onion option hai?', answer: '' },
  ],
  grocery: [
    { question: 'Aaj ki list dikhao', answer: '' },
    { question: 'Delivery kab tak milegi?', answer: '' },
    { question: 'Min order kitna hai?', answer: '' },
    { question: 'COD available hai?', answer: '' },
    { question: 'Kal subah ka order kab tak book kar sakte hain?', answer: '' },
  ],
  ecommerce: [
    { question: 'Order track karna hai', answer: '' },
    { question: 'COD available hai?', answer: '' },
    { question: 'Return / exchange kaise karein?', answer: '' },
    { question: 'Delivery kitne din mein hogi?', answer: '' },
    { question: 'Shipping charges kya hain?', answer: '' },
    { question: 'Koi offer chal raha hai?', answer: '' },
  ],
};
