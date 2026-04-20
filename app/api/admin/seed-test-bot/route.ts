import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { addClient, DuplicateBotError } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { syncProductsFromConfig } from '@/lib/inventory-sync';
import { setActiveBotId } from '@/lib/active-bot';
import { GymFields, RestaurantFields, SalonFields, ClientConfig, ClientRow, BusinessType } from '@/lib/types';
import { generateId, getISTTimestamp, formatPhoneNumber } from '@/lib/utils';
import { clerkClient } from '@clerk/nextjs/server';

const SUPPORTED_SEED_TYPES: BusinessType[] = ['gym', 'restaurant', 'salon'];

function buildRestaurantConfig(whatsappNumber: string): RestaurantFields {
  return {
    type: 'restaurant',
    businessName: 'ZapText Test Dhaba',
    ownerName: 'Test Owner',
    whatsappNumber,
    contactNumber: whatsappNumber,
    city: 'Delhi',
    address: 'Shop 14, Connaught Place, New Delhi 110001',
    workingHours: 'Mon-Sun: 11 AM to 11 PM',
    languages: ['English'],
    welcomeMessage: 'Welcome to ZapText Test Dhaba! How can I help you today?',
    additionalInfo: 'Demo restaurant bot for testing orders, menu lookup, and delivery flows.',
    cuisineType: 'North Indian, Chinese, Mughlai',
    menuCategories: [
      {
        category: 'Starters',
        items: [
          { name: 'Paneer Tikka', price: '₹260', description: 'Cottage cheese marinated in spices, grilled in tandoor', isVeg: true, isBestseller: true, foodType: 'veg' },
          { name: 'Chicken 65', price: '₹280', description: 'Crispy fried chicken in south-Indian spices', isVeg: false, isBestseller: true, foodType: 'non-veg' },
          { name: 'Veg Spring Roll', price: '₹180', description: 'Crispy rolls with mixed vegetable filling', isVeg: true, isBestseller: false, foodType: 'veg' },
        ],
      },
      {
        category: 'Main Course',
        items: [
          { name: 'Butter Chicken', price: '₹340', description: 'Creamy tomato gravy, tender chicken pieces', isVeg: false, isBestseller: true, foodType: 'non-veg' },
          { name: 'Paneer Butter Masala', price: '₹290', description: 'Cottage cheese in rich tomato gravy', isVeg: true, isBestseller: true, foodType: 'veg' },
          { name: 'Dal Makhani', price: '₹240', description: 'Slow-cooked black lentils with cream', isVeg: true, isBestseller: false, foodType: 'veg' },
          { name: 'Mutton Rogan Josh', price: '₹420', description: 'Kashmiri-style slow-cooked lamb curry', isVeg: false, isBestseller: false, foodType: 'non-veg' },
        ],
      },
      {
        category: 'Biryani',
        items: [
          { name: 'Chicken Biryani', price: '₹300', description: 'Hyderabadi dum biryani, serves 1', isVeg: false, isBestseller: true, foodType: 'non-veg' },
          { name: 'Veg Biryani', price: '₹240', description: 'Aromatic basmati with mixed veggies', isVeg: true, isBestseller: false, foodType: 'veg' },
        ],
      },
      {
        category: 'Breads & Rice',
        items: [
          { name: 'Butter Naan', price: '₹60', description: '', isVeg: true, isBestseller: false, foodType: 'veg' },
          { name: 'Garlic Naan', price: '₹80', description: '', isVeg: true, isBestseller: false, foodType: 'veg' },
          { name: 'Jeera Rice', price: '₹140', description: '', isVeg: true, isBestseller: false, foodType: 'veg' },
        ],
      },
    ],
    deliveryAvailable: true,
    deliveryRadius: '5 km',
    deliveryCharges: 'Free above ₹500, else ₹40',
    minimumOrder: '₹200',
    paymentMethods: ['Cash', 'UPI', 'Card'],
    specialOffers: '10% off on first order. Free dessert on orders above ₹800.',
    zomatoSwiggyLinks: '',
  };
}

function buildSalonConfig(whatsappNumber: string): SalonFields {
  return {
    type: 'salon',
    businessName: 'ZapText Test Salon',
    ownerName: 'Test Owner',
    whatsappNumber,
    contactNumber: whatsappNumber,
    city: 'Mumbai',
    address: 'Shop 5, Linking Road, Bandra West, Mumbai 400050',
    workingHours: 'Tue-Sun: 10 AM to 9 PM (Closed Monday)',
    languages: ['English'],
    welcomeMessage: 'Welcome to ZapText Test Salon! How can I help you today?',
    additionalInfo: 'Demo salon bot for testing bookings, price lookup, and package recommendations.',
    salonName: 'ZapText Test Salon',
    gender: 'Unisex',
    services: [
      {
        category: 'Hair',
        items: [
          { name: 'Haircut (Women)', price: '₹800', duration: '45 min' },
          { name: 'Haircut (Men)', price: '₹400', duration: '30 min' },
          { name: 'Hair Spa', price: '₹1,200', duration: '60 min' },
          { name: 'Hair Colour (Global)', price: '₹2,500', duration: '90 min' },
          { name: 'Keratin Treatment', price: '₹5,500', duration: '180 min' },
        ],
      },
      {
        category: 'Skin',
        items: [
          { name: 'Classic Facial', price: '₹1,200', duration: '60 min' },
          { name: 'Gold Facial', price: '₹2,000', duration: '75 min' },
          { name: 'Clean-up', price: '₹600', duration: '30 min' },
        ],
      },
      {
        category: 'Nails',
        items: [
          { name: 'Manicure', price: '₹500', duration: '30 min' },
          { name: 'Pedicure', price: '₹700', duration: '45 min' },
          { name: 'Gel Polish', price: '₹900', duration: '45 min' },
        ],
      },
    ],
    packages: [
      { name: 'Bridal Package', includes: 'Makeup, Hair Styling, Saree Draping, Mehendi', price: '₹12,000' },
      { name: 'Pre-Wedding Glow', includes: 'Gold Facial, Body Polish, Manicure, Pedicure', price: '₹4,500' },
      { name: 'Party-ready', includes: 'Blow-dry, Makeup, Manicure', price: '₹2,500' },
    ],
    brands: ["L'Oréal", 'Matrix', 'Schwarzkopf', 'Olaplex', 'VLCC'],
    bookingRequired: true,
    homeServiceAvailable: true,
    homeServiceCharges: 'Additional ₹300 travel fee',
  };
}

function buildGymConfig(whatsappNumber: string): GymFields {
  return {
    type: 'gym',
    businessName: 'ZapText Test Gym',
    ownerName: 'Test Owner',
    whatsappNumber,
    contactNumber: whatsappNumber,
    city: 'Bengaluru',
    address: '123 MG Road, Bengaluru 560001',
    workingHours: 'Mon-Sat: 5 AM to 11 PM, Sun: 6 AM to 10 AM',
    languages: ['English'],
    welcomeMessage: 'Welcome to ZapText Test Gym! How can I help you today?',
    additionalInfo: 'This is a test/demo gym bot for validating WhatsApp flows. Feel free to ask about memberships, trial classes, timings, or personal training.',
    gymName: 'ZapText Test Gym',
    facilities: [
      'Cardio zone (treadmills, ellipticals, bikes)',
      'Free weights',
      'Resistance machines',
      'Functional training area',
      'Yoga studio',
      'Steam room',
      'Locker rooms',
    ],
    membershipPlans: [
      { name: 'Monthly', duration: '1 month', price: '₹1,500', includes: 'All equipment, group classes' },
      { name: 'Quarterly', duration: '3 months', price: '₹4,000', includes: 'All equipment, group classes, 1 PT session' },
      { name: 'Half-Yearly', duration: '6 months', price: '₹7,500', includes: 'All equipment, group classes, 3 PT sessions' },
      { name: 'Annual', duration: '12 months', price: '₹13,000', includes: 'All equipment, group classes, 6 PT sessions, steam room' },
    ],
    personalTraining: {
      available: true,
      pricePerSession: '₹800/session',
      trainerInfo: 'Certified trainers with 5+ years of experience. Specializations: weight loss, muscle gain, sports performance.',
    },
    groupClasses: ['Yoga', 'Zumba', 'HIIT', 'CrossFit', 'Strength training'],
    trialAvailable: true,
    trialDetails: 'Free 1-day trial available. Just walk in with your ID between 7 AM and 10 AM.',
    timings: 'Mon-Sat: 5 AM - 11 PM, Sun: 6 AM - 10 AM',
  };
}

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawPhoneNumber = typeof body.whatsappNumber === 'string' ? body.whatsappNumber : '';
    const phoneNumberId = typeof body.phoneNumberId === 'string' ? body.phoneNumberId.trim() : '';

    if (!phoneNumberId) {
      return NextResponse.json(
        { error: 'phoneNumberId is required. Get it from Meta WhatsApp Manager → API Setup.' },
        { status: 400 }
      );
    }
    if (!rawPhoneNumber) {
      return NextResponse.json(
        { error: 'whatsappNumber is required (e.g. +15556333873).' },
        { status: 400 }
      );
    }

    const bizTypeRaw = typeof body.businessType === 'string' ? body.businessType : 'gym';
    if (!SUPPORTED_SEED_TYPES.includes(bizTypeRaw as BusinessType)) {
      return NextResponse.json(
        { error: `Unsupported businessType. Allowed: ${SUPPORTED_SEED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    const bizType = bizTypeRaw as BusinessType;

    // Optional: seed the bot onto a different user's account (by email).
    // Defaults to the admin's own userId for backwards compat.
    const targetEmailRaw = typeof body.targetEmail === 'string' ? body.targetEmail.trim() : '';
    let ownerUserId = user.userId;
    let ownerEmailForReport = user.email || '';
    if (targetEmailRaw) {
      try {
        const cc = await clerkClient();
        const found = await cc.users.getUserList({ emailAddress: [targetEmailRaw], limit: 5 });
        const target = found.data[0];
        if (!target) {
          return NextResponse.json(
            { error: `No Clerk user found with email ${targetEmailRaw}` },
            { status: 404 }
          );
        }
        ownerUserId = target.id;
        ownerEmailForReport = targetEmailRaw;
      } catch (e) {
        return NextResponse.json(
          { error: `Clerk lookup failed: ${String(e).slice(0, 200)}` },
          { status: 500 }
        );
      }
    }

    const whatsappNumber = formatPhoneNumber(rawPhoneNumber);
    const config: ClientConfig =
      bizType === 'restaurant'
        ? buildRestaurantConfig(whatsappNumber)
        : bizType === 'salon'
          ? buildSalonConfig(whatsappNumber)
          : buildGymConfig(whatsappNumber);
    const systemPrompt = generateSystemPrompt(config);
    const clientId = generateId();

    const client: ClientRow = {
      client_id: clientId,
      business_name: config.businessName,
      type: bizType,
      owner_name: config.ownerName,
      whatsapp_number: whatsappNumber,
      phone_number_id: phoneNumberId,
      city: config.city,
      system_prompt: systemPrompt,
      knowledge_base_json: JSON.stringify(config),
      status: 'active',
      created_at: getISTTimestamp(),
      owner_user_id: ownerUserId,
      upi_id: '',
      upi_name: '',
      existing_system: '',
      export_format: 'csv',
      contact_number: whatsappNumber,
      opt_in_accepted: true,
    };

    await addClient(client);
    // Only auto-switch the admin's own active-bot cookie if the bot is for them.
    // If we seeded on behalf of another user, don't clobber the admin's UI.
    if (ownerUserId === user.userId) {
      await setActiveBotId(clientId);
    }

    // Auto-sync sample products into inventory so the seeded bot is
    // immediately explorable (menu / services / plans populated).
    try {
      await syncProductsFromConfig(clientId, config);
    } catch (e) {
      console.error('[seed-test-bot] auto-sync products failed:', e);
    }

    return NextResponse.json({
      success: true,
      clientId,
      ownerEmail: ownerEmailForReport,
      message: 'Test gym bot seeded. Send a WhatsApp message to the test number to try it.',
      adminUrl: `/admin/clients/${clientId}`,
    });
  } catch (err) {
    if (err instanceof DuplicateBotError) {
      return NextResponse.json(
        { error: 'DUPLICATE_BOT', field: err.field, message: err.message },
        { status: 409 }
      );
    }
    console.error('[seed-test-bot] error:', err);
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
