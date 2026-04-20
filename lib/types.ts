// ─── Common Fields ───
export interface CommonFields {
  businessName: string;
  ownerName: string;
  whatsappNumber: string;
  contactNumber?: string; // personal phone for OTP/calls (separate from WhatsApp bot number)
  city: string;
  address: string;
  workingHours: string;
  languages: string[];
  welcomeMessage: string;
  additionalInfo: string;
  upiId?: string;
  upiName?: string;
  existingSystem?: string;
  exportFormat?: 'csv' | 'json';
}

// ─── Business Type Specific Fields ───

export interface ServiceItem {
  name: string;
  price: string;
  duration: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

// NOTE: 'clinic' vertical removed 2026-04 for WhatsApp Business Policy
// compliance — healthcare/telemedicine messaging is restricted in most
// jurisdictions including India. Existing clinic rows are auto-disabled
// via /api/admin/migrate-disable-clinics. Do not re-add this type.

export interface MenuItem {
  name: string;
  price: string;
  description: string;
  isVeg: boolean;
  isBestseller: boolean;
  imageUrl?: string;
  foodType?: 'veg' | 'non-veg' | 'egg';
}

export interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export interface RestaurantFields extends CommonFields {
  type: 'restaurant';
  cuisineType: string;
  menuCategories: MenuCategory[];
  deliveryAvailable: boolean;
  deliveryRadius: string;
  deliveryCharges: string;
  minimumOrder: string;
  paymentMethods: string[];
  specialOffers: string;
  zomatoSwiggyLinks: string;
}

export interface Course {
  name: string;
  targetAudience: string;
  duration: string;
  fee: string;
  schedule: string;
  mode: string;
}

export interface CoachingFields extends CommonFields {
  type: 'coaching';
  instituteName: string;
  coursesOffered: Course[];
  facultyInfo: string;
  batchSize: string;
  demoClassAvailable: boolean;
  admissionProcess: string;
  results: string;
  studyMaterial: string;
}

export interface PropertyListing {
  title: string;
  type: string;
  price: string;
  area: string;
  highlights: string;
}

export interface RealEstateFields extends CommonFields {
  type: 'realestate';
  agentName: string;
  reraNumber: string;
  operatingAreas: string[];
  propertyTypes: string[];
  services: string[];
  currentListings: PropertyListing[];
  siteVisitProcess: string;
  homeLoanAssistance: boolean;
  homeLoanBanks: string[];
}

export interface SalonServiceItem {
  name: string;
  price: string;
  duration: string;
}

export interface SalonServiceCategory {
  category: string;
  items: SalonServiceItem[];
}

export interface SalonPackage {
  name: string;
  includes: string;
  price: string;
}

export interface SalonFields extends CommonFields {
  type: 'salon';
  salonName: string;
  gender: string;
  services: SalonServiceCategory[];
  packages: SalonPackage[];
  brands: string[];
  bookingRequired: boolean;
  homeServiceAvailable: boolean;
  homeServiceCharges: string;
}

export interface Product {
  name: string;
  price: string;
  description: string;
  bestseller: boolean;
  imageUrl?: string;
}

export interface D2CFields extends CommonFields {
  type: 'd2c';
  brandName: string;
  productCategory: string;
  products: Product[];
  shippingPolicy: string;
  returnPolicy: string;
  codAvailable: boolean;
  paymentMethods: string[];
  websiteUrl: string;
  instagramHandle: string;
  currentOffers: string;
  orderTrackingProcess: string;
}

export interface MembershipPlan {
  name: string;
  duration: string;
  price: string;
  includes: string;
}

export interface GymFields extends CommonFields {
  type: 'gym';
  gymName: string;
  facilities: string[];
  membershipPlans: MembershipPlan[];
  personalTraining: {
    available: boolean;
    pricePerSession: string;
    trainerInfo: string;
  };
  groupClasses: string[];
  trialAvailable: boolean;
  trialDetails: string;
  timings: string;
}

export type BusinessType = 'restaurant' | 'coaching' | 'realestate' | 'salon' | 'd2c' | 'gym';

export type ClientConfig =
  | RestaurantFields
  | CoachingFields
  | RealEstateFields
  | SalonFields
  | D2CFields
  | GymFields;

// ─── Staff / Team Member Types (generic across all business types) ───

export interface StaffAvailabilityBlock {
  start: string; // HH:MM 24h
  end: string;
}

export interface StaffAvailability {
  monday: StaffAvailabilityBlock[];
  tuesday: StaffAvailabilityBlock[];
  wednesday: StaffAvailabilityBlock[];
  thursday: StaffAvailabilityBlock[];
  friday: StaffAvailabilityBlock[];
  saturday: StaffAvailabilityBlock[];
  sunday: StaffAvailabilityBlock[];
}

export interface StaffMember {
  staff_id: string;
  client_id: string;
  name: string;
  specialty: string;
  price: number;
  whatsapp_phone: string; // digits only e.g. "919876543210"
  bio: string;
  is_active: boolean;
  availability: StaffAvailability;
  created_at: string;
}

// Role label mapping used by UI + bot prompt
export const STAFF_ROLE_LABELS: Record<string, { singular: string; plural: string; icon: string }> = {
  gym:        { singular: 'Trainer',      plural: 'Trainers',      icon: '🏋️' },
  salon:      { singular: 'Stylist',      plural: 'Stylists',      icon: '💇' },
  coaching:   { singular: 'Tutor',        plural: 'Tutors',        icon: '📚' },
  restaurant: { singular: 'Staff member', plural: 'Staff',         icon: '👨‍🍳' },
  realestate: { singular: 'Agent',        plural: 'Agents',        icon: '🏠' },
  d2c:        { singular: 'Support rep',  plural: 'Support team',  icon: '🛒' },
};
export const DEFAULT_STAFF_LABEL = { singular: 'Staff member', plural: 'Staff', icon: '👥' };

// ─── Database Types ───

export interface ClientRow {
  client_id: string;
  business_name: string;
  type: BusinessType;
  owner_name: string;
  whatsapp_number: string;
  phone_number_id: string;
  city: string;
  system_prompt: string;
  knowledge_base_json: string;
  status: 'active' | 'pending' | 'paused' | 'rejected' | 'error';
  created_at: string;
  owner_user_id: string;
  upi_id?: string;
  upi_name?: string;
  existing_system?: string;
  export_format?: 'csv' | 'json';
  contact_number?: string; // owner personal phone for OTP/calls (distinct from whatsapp_number)
  opt_in_accepted?: boolean; // owner confirmed they have WhatsApp opt-in consent from their customers
}

export interface ConversationRow {
  timestamp: string;
  client_id: string;
  customer_phone: string;
  direction: 'incoming' | 'outgoing';
  message: string;
  message_type: string;
}

export interface AnalyticsRow {
  date: string;
  client_id: string;
  total_messages: number;
  unique_customers: number;
}

export interface InventoryItem {
  client_id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  updated_at: string;
  notes: string;
  // Time-based availability. Empty / absent = available all day, every day.
  available_from?: string; // 'HH:MM' 24h
  available_to?: string;   // 'HH:MM' 24h
  available_days?: string[]; // lowercase day names: mon, tue, wed, thu, fri, sat, sun
}

// ─── Business Type Metadata ───

export interface BusinessTypeMeta {
  type: BusinessType;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}
