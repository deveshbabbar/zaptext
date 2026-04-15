import { BusinessTypeMeta, BusinessType, FAQ } from './types';

export const BUSINESS_TYPES: BusinessTypeMeta[] = [
  {
    type: 'clinic',
    label: 'Clinic / Doctor',
    description: 'Hospitals, clinics, individual doctors, dentists, diagnostics',
    icon: '🏥',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    type: 'restaurant',
    label: 'Restaurant / Cloud Kitchen',
    description: 'Restaurants, cafes, cloud kitchens, sweet shops, bakeries',
    icon: '🍽️',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  {
    type: 'coaching',
    label: 'Coaching Center / Tutor',
    description: 'Coaching institutes, private tutors, test prep centers',
    icon: '📚',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    type: 'realestate',
    label: 'Real Estate Agent',
    description: 'Property brokers, builders, real estate agencies',
    icon: '🏠',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  {
    type: 'salon',
    label: 'Salon / Spa',
    description: 'Beauty salons, spas, barbershops, wellness centers',
    icon: '💇',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
  },
  {
    type: 'd2c',
    label: 'D2C E-commerce Brand',
    description: 'Online brands — skincare, fashion, food, accessories',
    icon: '🛍️',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
  },
  {
    type: 'gym',
    label: 'Gym / Fitness Studio',
    description: 'Gyms, yoga studios, CrossFit boxes, fitness centers',
    icon: '💪',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
];

export function getBusinessTypeMeta(type: BusinessType): BusinessTypeMeta {
  return BUSINESS_TYPES.find((bt) => bt.type === type)!;
}

// ─── Default FAQ Templates ───

export const FAQ_TEMPLATES: Record<BusinessType, FAQ[]> = {
  clinic: [
    { question: 'Appointment kaise book karein?', answer: '' },
    { question: 'Doctor ki fees kitni hai?', answer: '' },
    { question: 'Kya insurance accept hota hai?', answer: '' },
    { question: 'Clinic ka time kya hai?', answer: '' },
    { question: 'Emergency mein kya karein?', answer: '' },
  ],
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
};
