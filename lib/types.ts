// ─── Common Fields ───
export interface CommonFields {
  businessName: string;
  ownerName: string;
  whatsappNumber: string;
  city: string;
  address: string;
  workingHours: string;
  languages: string[];
  welcomeMessage: string;
  additionalInfo: string;
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

export interface ClinicFields extends CommonFields {
  type: 'clinic';
  doctorName: string;
  specialization: string;
  qualifications: string;
  services: ServiceItem[];
  consultationFee: string;
  appointmentProcess: string;
  emergencyNumber: string;
  insuranceAccepted: string[];
  commonFAQs: FAQ[];
}

export interface MenuItem {
  name: string;
  price: string;
  description: string;
  isVeg: boolean;
  isBestseller: boolean;
  imageUrl?: string;
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

export type BusinessType = 'clinic' | 'restaurant' | 'coaching' | 'realestate' | 'salon' | 'd2c' | 'gym';

export type ClientConfig =
  | ClinicFields
  | RestaurantFields
  | CoachingFields
  | RealEstateFields
  | SalonFields
  | D2CFields
  | GymFields;

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
  status: 'active' | 'paused' | 'error';
  created_at: string;
  owner_user_id: string;
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
