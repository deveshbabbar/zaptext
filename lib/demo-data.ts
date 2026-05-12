// Pre-canned demo knowledge_base data for every vertical.
//
// Purpose: a single bot phone number can be "flipped" between verticals
// at demo time. Admin picks a vertical from the dropdown, we overwrite
// the bot's business_name + type + knowledge_base_json with the matching
// preset below, regen the system prompt, and the same WhatsApp number
// now behaves like that vertical end-to-end.

import type { BusinessType } from './types';

export interface DemoBundle {
  business_name: string;
  knowledge_base: Record<string, unknown>;
}

// ─── Restaurant ──────────────────────────────────────────────────────────

const RESTAURANT: DemoBundle = {
  business_name: 'Tandoor & Tadka',
  knowledge_base: {
    type: 'restaurant',
    subTypes: ['Family restaurant', 'North Indian'],
    subType: 'Family restaurant',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Linking Road, Bandra West, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    businessHours: 'Mon-Sun 11:30 AM - 11:30 PM',
    cuisineType: 'North Indian + Chinese + Tandoor',
    paymentMethods: ['Cash on Delivery'],
    deliveryAvailable: true,
    deliveryRadius: '4 km',
    deliveryCharges: 'Rs.40 below Rs.300, free above',
    minimumOrder: 'Rs.200',
    fssaiLicense: '22420068000456',
    seatingCapacity: '60 covers',
    parkingAvailable: true,
    acAvailable: true,
    purelyVeg: false,
    halalCertified: true,
    jainOptionsAvailable: true,
    noOnionGarlicAvailable: true,
    serviceLunchWindow: '12-3 PM',
    serviceSnacksWindow: '4-6 PM',
    serviceDinnerWindow: '7-11 PM',
    serviceLateNightWindow: '11 PM-12:30 AM',
    holidaysClosed: 'Open all 7 days',
    dailySpecial: 'Tandoori Chicken — 15% off today only',
    specialOffers:
      '• Family pack: Veg Thali x4 + Gulab Jamun x4 — Rs.999\n• Weekday lunch (Mon-Thu): 10% off on biryanis\n• Birthday: free dessert on showing valid ID\n• Bulk takeaway: 20% off on orders above Rs.2500',
    currentOffers: 'Buy 2 Get 1 free on starters (4-7 PM Mon-Thu)',
    menuCategories: [
      {
        category: 'Starters',
        items: [
          { name: 'Paneer Tikka', price: 'Rs.249', description: 'Marinated cottage cheese, char-grilled in tandoor', isVeg: true, isBestseller: true },
          { name: 'Hara Bhara Kebab', price: 'Rs.199', description: 'Spinach + green pea cutlets, pan-tossed', isVeg: true, isBestseller: false },
          { name: 'Chicken 65', price: 'Half Rs.189 / Full Rs.329', description: 'South-Indian style spicy fried chicken', isVeg: false, isBestseller: true },
          { name: 'Mutton Seekh Kebab', price: 'Half Rs.229 / Full Rs.419', description: 'Lucknowi-style minced mutton skewers', isVeg: false, isBestseller: false },
          { name: 'Tandoori Chicken', price: 'Quarter Rs.199 / Half Rs.359 / Full Rs.649', description: 'Yogurt + tandoori spice marinade, fall-off-the-bone', isVeg: false, isBestseller: true },
        ],
      },
      {
        category: 'Biryani',
        items: [
          { name: 'Veg Dum Biryani', price: 'Half Rs.199 / Full Rs.349', description: 'Layered basmati rice with paneer + veggies', isVeg: true, isBestseller: false },
          { name: 'Chicken Hyderabadi Biryani', price: 'Half Rs.249 / Full Rs.449', description: 'Slow-cooked dum, served with raita + mirchi salan', isVeg: false, isBestseller: true },
          { name: 'Mutton Lucknowi Biryani', price: 'Half Rs.329 / Full Rs.589', description: 'Tender mutton + aromatic kewra + saffron rice', isVeg: false, isBestseller: false },
          { name: 'Egg Biryani', price: 'Half Rs.169 / Full Rs.299', description: 'Boiled eggs + spiced basmati', isVeg: false, isBestseller: false },
        ],
      },
      {
        category: 'Main Course',
        items: [
          { name: 'Dal Makhani', price: 'Half Rs.169 / Full Rs.269', description: 'Slow-cooked black lentils, finished with butter', isVeg: true, isBestseller: true },
          { name: 'Paneer Butter Masala', price: 'Half Rs.189 / Full Rs.319', description: 'Cottage cheese in creamy tomato gravy', isVeg: true, isBestseller: true },
          { name: 'Butter Chicken', price: 'Half Rs.249 / Full Rs.449', description: 'Boneless tandoori chicken in tomato-cashew gravy', isVeg: false, isBestseller: true },
          { name: 'Mutton Rogan Josh', price: 'Half Rs.329 / Full Rs.599', description: 'Kashmiri-style mutton in red gravy', isVeg: false, isBestseller: false },
        ],
      },
      {
        category: 'Breads',
        items: [
          { name: 'Tandoori Roti', price: 'Rs.35', description: '', isVeg: true, isBestseller: false },
          { name: 'Butter Naan', price: 'Rs.55', description: '', isVeg: true, isBestseller: false },
          { name: 'Garlic Naan', price: 'Rs.75', description: '', isVeg: true, isBestseller: false },
          { name: 'Lachha Paratha', price: 'Rs.65', description: 'Layered flaky bread', isVeg: true, isBestseller: false },
        ],
      },
      {
        category: 'Beverages & Desserts',
        items: [
          { name: 'Masala Chai', price: 'Rs.49', description: '', isVeg: true, isBestseller: false },
          { name: 'Sweet Lassi', price: 'Glass Rs.79 / Jug Rs.219', description: '', isVeg: true, isBestseller: false },
          { name: 'Mango Lassi', price: 'Glass Rs.99 / Jug Rs.269', description: 'Seasonal — Apr to Jul', isVeg: true, isBestseller: false },
          { name: 'Gulab Jamun', price: '2 pcs Rs.89 / 4 pcs Rs.169', description: '', isVeg: true, isBestseller: true },
          { name: 'Kulfi Falooda', price: 'Single Rs.99 / Double Rs.169', description: 'Saffron-pistachio kulfi with rose syrup', isVeg: true, isBestseller: false },
        ],
      },
    ],
    brandColor: '#7a1f1f',
    tagline: 'Bandra ka asli swad',
  },
};

// ─── Coaching ────────────────────────────────────────────────────────────

const COACHING: DemoBundle = {
  business_name: 'Sharma Sir IIT Academy',
  knowledge_base: {
    type: 'coaching',
    subTypes: ['JEE', 'NEET', 'Foundation'],
    subType: 'JEE',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Vaishali Nagar, Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    businessHours: 'Mon-Sat 4 PM - 9 PM, Sun 9 AM - 1 PM',
    establishedYear: '2014',
    studentsPlaced: '2,300+ alumni in IITs / NITs / AIIMS',
    classroomCapacity: '40 students max per batch',
    onlineAvailable: true,
    offlineAvailable: true,
    hybridAvailable: true,
    paymentMethods: ['Cash on Delivery'],
    rajasthanCoachingActRegistered: true,
    coachingActRegistrationNumber: 'RCAR-2024-JPR-0142',
    ownerPhotoBioOnDisplay: true,
    feeReceiptMandatory: true,
    refundPolicyUrl: 'https://sharmasiriit.com/refund',
    feeReceiptFormat: 'Digital receipt within 24hr',
    studyMaterialMode: 'both',
    physicalMaterialAvailable: 'Comprehensive: NCERT + Sharma Sir notes + Previous-year papers',
    digitalMaterialAvailable: 'Mobile app + recorded lectures',
    mockTestsCount: '24 full-length + 60 sectional per year',
    doubtSolvingMode: '1-on-1 Tue/Thu 7-8 PM + WhatsApp anytime',
    coursesOffered: [
      { name: 'JEE Main + Advanced — 2 Year', targetAudience: 'Class 11-12', duration: '2 years', fee: 'Online Rs.1,40,000 / Offline Rs.1,80,000', schedule: 'Mon-Sat 4-7 PM', mode: 'hybrid' },
      { name: 'JEE 1 Year Crash', targetAudience: 'Class 12 / Droppers', duration: '11 months', fee: 'Rs.85,000', schedule: 'Mon-Sat 4-7 PM + Sun morning', mode: 'offline' },
      { name: 'NEET 2 Year Foundation', targetAudience: 'Class 11-12', duration: '2 years', fee: 'Online Rs.1,30,000 / Offline Rs.1,65,000', schedule: 'Mon-Sat 5-8 PM', mode: 'hybrid' },
      { name: 'NEET 1 Year Crash', targetAudience: 'Class 12 / Droppers', duration: '11 months', fee: 'Rs.75,000', schedule: 'Mon-Sat 5-8 PM', mode: 'offline' },
      { name: 'Foundation Class 9-10', targetAudience: 'Class 9-10', duration: '2 years', fee: 'Rs.45,000/year', schedule: 'Mon-Fri 4-6 PM', mode: 'offline' },
    ],
    emiDisclosureEnabled: false,
    hostelPGReferralOffered: true,
    hostelPGCommissionDisclosed: true,
    hostelPGPartnerNames: 'Allen Hostel, Saraswati PG, Maa Sharda Boys Hostel',
    hostelPGMonthlyRangeINR: 'Rs.8,000 - Rs.14,000/month including meals',
    facultyHighlights: '5 IITians + 3 NEET-toppers as full-time faculty',
    parentMeetFrequency: 'Monthly PTM, 1st Saturday',
    brandColor: '#1a3a8a',
    tagline: 'JEE / NEET — Sharma Sir ke saath',
  },
};

// ─── Real Estate ─────────────────────────────────────────────────────────

const REALESTATE: DemoBundle = {
  business_name: 'Krishna Realtors',
  knowledge_base: {
    type: 'realestate',
    subTypes: ['Residential resale', 'Residential rental', 'New project / builder'],
    subType: 'Residential resale',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Whitefield, Bangalore',
    city: 'Bangalore',
    state: 'Karnataka',
    businessHours: 'Mon-Sun 10 AM - 8 PM',
    establishedYear: '2009',
    reraAgentNumber: 'PRM/KA/AGENT/0023/2023',
    gstn: '29AABCK1234C1Z5',
    primaryAreas: 'Whitefield, Marathahalli, Brookefield, KR Puram',
    paymentMethods: ['Cash on Delivery'],
    brokerage: 'Buyer: 1% · Seller: 1% · Rental: 1 month rent',
    homeLoanAssistance: true,
    homeLoanBanks: ['SBI', 'HDFC', 'ICICI', 'Axis', 'LIC HF'],
    services: ['Buy', 'Sell', 'Rent'],
    currentListings: [
      { title: '3BHK Whitefield', type: 'sale', price: 'Rs.1.20 Cr', area: '1450 sqft built-up', highlights: 'Park-facing | 14th floor | RERA: PRM/KA/RERA/1251/308/PR/171012/000845' },
      { title: '2BHK HSR Layout', type: 'rent', price: 'Rs.35,000/month', area: '1100 sqft', highlights: 'Furnished | 2 covered parking | Family preferred' },
      { title: 'Plot Sarjapur', type: 'sale', price: 'Rs.85 Lakh', area: '1200 sqft', highlights: 'East-facing | 30-ft road | Khata + clear title | DTCP approved' },
      { title: '4BHK Villa Devanahalli', type: 'sale', price: 'Rs.2.85 Cr', area: '2800 sqft + 1200 garden', highlights: 'Gated community | Pool + clubhouse | RERA: PRM/KA/RERA/1251/308/PR/220514/004811' },
      { title: '1BHK Marathahalli', type: 'rent', price: 'Rs.18,500/month', area: '650 sqft', highlights: 'Semi-furnished | Near ITPL | Bachelor OK' },
    ],
    builderProjects: [
      { name: 'Prestige Aurora', builder: 'Prestige Group', reraId: 'PRM/KA/RERA/1251/308/PR/171012/000845', possession: 'Q4 2026', priceRange: 'Rs.95L - Rs.1.85Cr', unitMix: '2/3 BHK' },
      { name: 'Brigade Cornerstone Utopia', builder: 'Brigade Group', reraId: 'PRM/KA/RERA/1251/308/PR/220514/004811', possession: 'Ready to move', priceRange: 'Rs.1.4Cr - Rs.3.2Cr', unitMix: '3/4 BHK + Villas' },
    ],
    homeLoanPartners: [
      { bankName: 'SBI', partnerType: 'preferred', salariedOk: true, selfEmployedOk: true, interestRate: '8.50%' },
      { bankName: 'HDFC', partnerType: 'tied_up', salariedOk: true, selfEmployedOk: true, interestRate: '8.65%' },
    ],
    stateStampDutyPercent: '5% + 1% surcharge + 1% cess',
    dpdpaConsentBannerEnabled: true,
    nriServicesOffered: true,
    femaCompliantNriHandling: true,
    siteVisitWindow: 'Sat-Sun 10 AM - 5 PM, weekday by appointment',
    brandColor: '#0e4d3a',
    tagline: 'Whitefield property expert',
  },
};

// ─── Salon ───────────────────────────────────────────────────────────────

const SALON: DemoBundle = {
  business_name: 'Glow Studio',
  knowledge_base: {
    type: 'salon',
    subTypes: ['Unisex', 'Bridal makeup', 'Mehendi'],
    subType: 'Unisex',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Sector 17, Chandigarh',
    city: 'Chandigarh',
    state: 'Chandigarh',
    businessHours: 'Mon-Sun 10 AM - 9 PM (Tue closed)',
    paymentMethods: ['Cash on Delivery'],
    appointmentRequired: true,
    walkInsAccepted: true,
    homeServiceAvailable: true,
    homeServiceExtraCharge: 'Rs.300 surcharge',
    cancellationWindow: '2 hours before slot',
    productBrandsUsed: "L'Oreal Professionnel · Schwarzkopf · Lakme · O3+ · Olaplex",
    hygieneSOP: 'Sanitized tools per client · Disposable razors / mehendi cones · UV cabinets',
    services: [
      {
        category: 'Hair',
        items: [
          { name: 'Haircut', price: 'Short Rs.500 / Long Rs.800', duration: '45 min' },
          { name: 'Hair Color (full)', price: 'Short Rs.2,500 / Long Rs.4,500', duration: '90 min' },
          { name: 'Hair Smoothening', price: 'Short Rs.4,500 / Long Rs.8,500', duration: '3 hr' },
          { name: 'Blow Dry', price: 'Rs.350', duration: '30 min' },
          { name: 'Keratin Treatment', price: 'Short Rs.5,500 / Long Rs.9,500', duration: '3 hr' },
        ],
      },
      {
        category: 'Skin',
        items: [
          { name: 'Classic Facial', price: 'Rs.999', duration: '60 min' },
          { name: 'Anti-Tan Facial', price: 'Rs.1,499', duration: '75 min' },
          { name: 'O3+ Premium Facial', price: 'Rs.2,499', duration: '90 min' },
          { name: 'Clean-up', price: 'Rs.599', duration: '30 min' },
        ],
      },
      {
        category: 'Bridal',
        items: [
          { name: 'Bridal Makeup (HD)', price: 'Rs.15,000', duration: '3 hr' },
          { name: 'Bridal Makeup (Airbrush)', price: 'Rs.25,000', duration: '3.5 hr' },
          { name: 'Mehendi (full hands + feet)', price: 'Rs.5,500', duration: '4 hr' },
          { name: 'Engagement Makeup', price: 'Rs.6,500', duration: '90 min' },
        ],
      },
      {
        category: 'Threading & Waxing',
        items: [
          { name: 'Eyebrows + Upper Lip', price: 'Single Rs.150 / Combo Rs.250', duration: '20 min' },
          { name: 'Full Arms Wax', price: 'Half Rs.450 / Full Rs.650', duration: '30 min' },
          { name: 'Full Legs Wax', price: 'Half Rs.550 / Full Rs.850', duration: '40 min' },
        ],
      },
    ],
    bridalPackageAvailable: true,
    loyaltyProgramEnabled: true,
    loyaltyProgramDetails: 'Rs.10 per Rs.500 spent, redeemable on next visit',
    brandColor: '#a8447e',
    tagline: 'Chandigarh ka favourite studio',
  },
};

// ─── Gym ─────────────────────────────────────────────────────────────────

const GYM: DemoBundle = {
  business_name: 'Iron Forge Fitness',
  knowledge_base: {
    type: 'gym',
    subTypes: ['Full gym', 'CrossFit', 'Functional / HIIT'],
    subType: 'Full gym',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Lajpat Nagar, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    businessHours: 'Mon-Sat 5 AM - 10 PM, Sun 6 AM - 12 PM',
    paymentMethods: ['Cash on Delivery'],
    trialPassAvailable: true,
    trialPassDuration: '3-day free trial, no card needed',
    facilities: 'Cardio · Free weights · Smith machine · Cable crossover · Squat racks · Sauna · Steam · Lockers · Shower',
    acAvailable: true,
    parkingAvailable: true,
    insuranceWaiverRequired: true,
    insuranceWaiverFormUrl: 'https://ironforge.in/waiver',
    diplomaCertifiedTrainers: 'All 4 trainers certified — ACE / NASM / K11',
    nutritionCounselingAvailable: true,
    membershipPlans: [
      { name: 'Monthly', duration: '1 month', price: 'Rs.2,500', includes: 'Gym access + 1 PT session', peakAccess: true },
      { name: 'Quarterly', duration: '3 months', price: 'Rs.6,000', includes: 'Gym access + 3 PT sessions + diet chart', peakAccess: true },
      { name: 'Half-Yearly', duration: '6 months', price: 'Rs.10,500', includes: 'Gym access + 6 PT sessions + nutrition consult', peakAccess: true },
      { name: 'Annual Premium', duration: '12 months', price: 'Rs.15,000', includes: 'Unlimited PT + all classes + monthly nutrition consult', peakAccess: true },
      { name: 'Classes Only', duration: '1 month', price: 'Rs.1,500', includes: 'Yoga + Zumba + HIIT classes, no gym floor access', peakAccess: false },
    ],
    classSchedule:
      '• Yoga: Mon/Wed/Fri 6:30 AM + Tue/Thu 7 PM\n• Zumba: Mon/Wed 7 PM, Sat 11 AM\n• HIIT: Tue/Thu 6:30 PM\n• CrossFit: Mon-Fri 7 PM',
    corporatePartners: [
      { employer: 'TCS', discountPercent: 20, verificationRequired: 'email_domain' },
      { employer: 'Wipro', discountPercent: 15, verificationRequired: 'id_card' },
    ],
    aggregators: ['FITPASS', 'Cultpass'],
    cancellationPolicy: 'Pro-rata refund within 7 days of joining, no refund after',
    renewalReminderDays: 7,
    brandColor: '#1f1f1f',
    tagline: 'Lift heavy. Live light.',
  },
};

// ─── Tiffin ──────────────────────────────────────────────────────────────

const TIFFIN: DemoBundle = {
  business_name: 'Maa Ki Rasoi Tiffin',
  knowledge_base: {
    type: 'tiffin',
    subTypes: ['Office tiffin', 'Working professionals', 'Family weekly menu'],
    subType: 'Office tiffin',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Indiranagar, Bangalore',
    city: 'Bangalore',
    state: 'Karnataka',
    businessHours: 'Lunch 12-1 PM delivery, Dinner 7-8 PM delivery',
    fssaiLicense: '12321001000789',
    paymentMethods: ['Cash on Delivery'],
    trialDaysAvailable: true,
    trialDays: '3 days at Rs.99/meal',
    deliveryRadius: '5 km',
    deliverySlots: 'Lunch: 12:00-1:00 PM · Dinner: 7:30-8:30 PM',
    pincodesDelivered: '560038, 560008, 560071, 560076',
    containerDepositRequired: true,
    containerDepositAmount: 'Rs.300 refundable',
    plans: [
      { name: 'Monthly Lunch (Veg)', duration: '30 tiffins / 1 month', price: 'Rs.2,800', includes: '4 rotis + 1 sabzi + 1 dal + rice + salad + dessert (Sun)', mealType: 'lunch', foodType: 'veg' },
      { name: 'Monthly Lunch + Dinner (Veg)', duration: '60 tiffins / 1 month', price: 'Rs.4,800', includes: 'Lunch + dinner combo', mealType: 'both', foodType: 'veg' },
      { name: 'Monthly Dinner (Veg)', duration: '30 tiffins / 1 month', price: 'Rs.2,800', includes: '4 rotis + 1 sabzi + 1 dal + rice + salad', mealType: 'dinner', foodType: 'veg' },
      { name: 'Weekly Trial', duration: '7 tiffins', price: 'Rs.700', includes: 'Lunch only, any 7 days', mealType: 'lunch', foodType: 'veg' },
      { name: 'Jain Lunch Monthly', duration: '30 tiffins', price: 'Rs.3,200', includes: 'No onion / no garlic / no root veggies', mealType: 'lunch', foodType: 'jain' },
    ],
    weeklyMenu:
      'Mon: Rajma-Rice + Salad · Tue: Aloo Gobhi + Dal · Wed: Mix Veg + Kadhi Pakoda · Thu: Paneer Bhurji + Dal · Fri: Chana Masala + Jeera Rice · Sat: Special - Chole Bhature · Sun: Off',
    festivalOverrides: 'Navratri: only satvik menu (no onion-garlic) · Diwali: special sweets included',
    holidaysClosed: 'Sunday off · Festivals on prior intimation',
    brandColor: '#c0392b',
    tagline: 'Ghar jaisa khana, ghar par',
  },
};

// ─── Ecommerce ───────────────────────────────────────────────────────────

const ECOMMERCE: DemoBundle = {
  business_name: 'Studio Saanjh',
  knowledge_base: {
    type: 'ecommerce',
    subTypes: ['Fashion D2C', 'Handloom / GI products'],
    subType: 'Fashion D2C',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Online — fulfilled from Jaipur warehouse',
    city: 'Jaipur',
    state: 'Rajasthan',
    businessHours: 'Mon-Sat 10 AM - 7 PM IST (online 24/7)',
    paymentMethods: ['Cash on Delivery'],
    storefrontType: 'Own Shopify + Instagram + WhatsApp catalog',
    instagramHandle: '@studio.saanjh',
    marketplacePresence: [
      { marketplace: 'Amazon', sellerId: 'A1B2C3D4', active: true },
      { marketplace: 'Myntra', sellerId: 'MYN-9821', active: true },
    ],
    courierPartners: ['Delhivery', 'Shadowfax', 'Shiprocket'],
    deliveryTimelines: 'T1 cities: 2-3 days · T2: 4-5 days · T3: 5-7 days',
    codPolicyVerificationCall: true,
    codBlockedPincodes: '110001, 110002 (high RTO)',
    rtoBufferDays: 2,
    returnWindowDays: 7,
    returnReasons: 'Size issue · Damaged in transit · Different from photo · Quality issue · Allergy',
    refundMode: 'Refund to source within 5 working days',
    exchangePolicyDays: 7,
    nonReturnableCategories: 'Innerwear, Custom-print, Stitched sale items',
    gstn: '08AABCS1234D1Z2',
    products: [
      { name: 'Hand-block Cotton Kurta', price: 'S Rs.999 / M Rs.999 / L Rs.1099 / XL Rs.1199', mrp: 'Rs.1499', sku: 'KUR-001', category: 'Fashion · Womens', stock: 25, bestseller: true, inStock: true, description: 'Jaipur sanganeri block print, all-natural dye, 100% cotton' },
      { name: 'Silk Saree — Red', price: 'Rs.4,299', mrp: 'Rs.5999', sku: 'SAR-002', category: 'Fashion · Womens', stock: 8, bestseller: false, inStock: true, description: 'Pure Banarasi silk, gold zari border' },
      { name: "Men's Linen Kurta", price: 'M Rs.1199 / L Rs.1199 / XL Rs.1299', mrp: 'Rs.1699', sku: 'KUR-M-005', category: 'Fashion · Mens', stock: 18, bestseller: false, inStock: true, description: 'Breathable linen, mandarin collar' },
      { name: 'Cotton Dupatta — Indigo', price: 'Rs.499', mrp: 'Rs.749', sku: 'DUP-012', category: 'Fashion · Accessories', stock: 42, bestseller: true, inStock: true, description: 'Tie-dye indigo, hand-finished tassels' },
      { name: 'Block-print Wallet', price: 'Rs.349', mrp: 'Rs.499', sku: 'ACC-008', category: 'Fashion · Accessories', stock: 60, bestseller: false, inStock: true, description: 'Vegan leather + cotton patch' },
      { name: 'Handloom Stole', price: 'Rs.799', mrp: 'Rs.1199', sku: 'STL-003', category: 'Fashion · Accessories', stock: 22, bestseller: false, inStock: true, description: 'GI-tagged handloom (Chanderi)' },
    ],
    discountCodes: [
      { code: 'FIRST10', percentOff: 10, minCart: 999, expiresOn: '2026-12-31' },
      { code: 'FESTIVE20', percentOff: 20, minCart: 1999, expiresOn: '2026-11-30' },
    ],
    bulkOrderTiers: '10+ pieces: 5% off · 50+: 10% off · 100+: 15% off',
    abandonedCartReminders: '1h reminder · 24h with 10% off · 7d final',
    grievanceOfficerName: 'Priya Mehta',
    grievanceOfficerEmail: 'grievance@studiosaanjh.com',
    grievanceOfficerPhone: '+91 98765 43210',
    handloomGiCertified: true,
    brandColor: '#1a4d2e',
    tagline: 'Block-printed in Jaipur, shipped pan-India',
  },
};

// ─── Grocery ─────────────────────────────────────────────────────────────

const GROCERY: DemoBundle = {
  business_name: 'Sharma Provision Store',
  knowledge_base: {
    type: 'grocery',
    subTypes: ['Kirana / general store', 'Daily essentials'],
    subType: 'Kirana / general store',
    languages: ['English', 'Hinglish', 'Hindi'],
    location: 'Karol Bagh, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    businessHours: 'Mon-Sun 7 AM - 10 PM',
    paymentMethods: ['Cash on Delivery'],
    deliveryAvailable: true,
    deliveryRadius: '3 km',
    minimumOrder: 'Rs.200',
    deliveryFee: 'Rs.20 below Rs.300, free above',
    catalogMode: 'static',
    cashChangeAvailableUpto: 'Rs.500',
    cashAtDoor: true,
    udhaarAllowedForRegulars: true,
    defaultProducts: ['Aashirvaad Atta 5kg', 'Tata Salt 1kg', 'Amul Milk 1L', 'Maggi 70g', 'Toor Dal 1kg', 'Basmati Rice 1kg', 'Sugar 1kg', 'Tea Powder 250g', 'Fortune Sunflower Oil 1L', 'Surf Excel 1kg', 'Lifebuoy Soap 100g', 'Colgate 100g', 'Eggs (12)', 'Bread 400g', 'Curd 400g'],
    groceryProductsToSeed: [
      { id: 'p1', name: 'Aashirvaad Atta', price: 290, unit: '5kg', category: 'Atta', inStock: true },
      { id: 'p2', name: 'Tata Salt', price: 28, unit: '1kg', category: 'Spices', inStock: true },
      { id: 'p3', name: 'Amul Milk', price: 66, unit: '1L', category: 'Dairy', inStock: true },
      { id: 'p4', name: 'Toor Dal', price: 175, unit: '1kg', category: 'Dal', inStock: true },
      { id: 'p5', name: 'Basmati Rice', price: 180, unit: '1kg', category: 'Rice & Grains', inStock: true },
      { id: 'p6', name: 'Fortune Sunflower Oil', price: 145, unit: '1L', category: 'Oil', inStock: true },
      { id: 'p7', name: 'Maggi Noodles', price: 14, unit: '70g pack', category: 'Snacks', inStock: true },
    ],
    deliverySlotsAvailable: 'Morning 8-10 AM · Evening 5-7 PM',
    cutoffTimes: 'Order by 10 PM for next-morning delivery',
    recurringOrdersSupported: true,
    commonOrderPattern: 'Weekly: Atta + Dal + Milk · Monthly: Bulk staples',
    festivalSpecialOrders: 'Diwali / Holi: pre-order assortment 7 days ahead',
    brandColor: '#e89a1c',
    tagline: 'Karol Bagh ka favourite kirana',
  },
};

// ─── Registry ────────────────────────────────────────────────────────────

export const DEMO_BUNDLES: Record<BusinessType, DemoBundle> = {
  restaurant: RESTAURANT,
  coaching: COACHING,
  realestate: REALESTATE,
  salon: SALON,
  gym: GYM,
  tiffin: TIFFIN,
  ecommerce: ECOMMERCE,
  grocery: GROCERY,
  // d2c is hidden/deprecated but the discriminated union still requires it.
  d2c: ECOMMERCE,
};
