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
  // ─── New optional fields (research-derived, FSSAI 2020 menu-labelling) ───
  /** Top-8 allergens FSSAI requires for >10-outlet chains; smart for all */
  allergens?: ('milk' | 'eggs' | 'fish' | 'shellfish' | 'tree_nuts' | 'peanuts' | 'wheat_gluten' | 'soy' | 'sesame' | 'mustard')[];
  /** Calories per serving (Karnataka mandate for chains; nice-to-have elsewhere) */
  caloriesKcal?: number;
  /** Jain-compatible (no onion / garlic / root vegetables) */
  isJainCompatible?: boolean;
  /** Per-item availability days (Mon-Sat lunch combo etc.) */
  availableDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  /** Per-item availability time window (breakfast-only, late-night-only) */
  availableTimeWindow?: { start: string; end: string };
  /** GST slab — 5% restaurant default; 18% if AC + alcohol licence */
  gstSlab?: '5' | '12' | '18';
  /** Aggregator price override — Zomato/Swiggy mark-up vs direct WhatsApp price */
  aggregatorPriceOverride?: { swiggy?: string; zomato?: string };
  /** Multiple weights/portions (small/medium/large or 250g/500g/1kg for mithai) */
  weightVariants?: { label: string; price: string }[];
  /** Days the dish keeps fresh (mithai / bakery items) */
  shelfLifeDays?: number;
  /** Spice level — bot uses to warn customers */
  spiceLevel?: 'mild' | 'medium' | 'spicy' | 'extra-spicy';
}

export interface MenuCategory {
  category: string;
  items: MenuItem[];
}

// ─── Restaurant sub-types (research-derived) ───
export type RestaurantSubType =
  | 'dine-in-family'
  | 'fine-dine'
  | 'qsr'
  | 'cloud-kitchen-single'
  | 'cloud-kitchen-multi-brand'
  | 'dhaba'
  | 'food-truck'
  | 'sweet-shop'
  | 'bakery'
  | 'eggless-bakery'
  | 'custom-cake-studio'
  | 'ice-cream-parlour'
  | 'juice-bar'
  | 'chai-tapri'
  | 'cafe'
  | 'pure-veg'
  | 'jain-only'
  | 'regional-specialty'
  | 'tiffin-attached';

export interface CloudKitchenBrand {
  name: string;
  cuisineType?: string;
  /** Optional brand website. Aggregator links (Zomato/Swiggy) are NOT collected
   *  here — our scraper can't read them and the data they contain isn't
   *  needed for the bot to answer customers. */
  website?: string;
  /** Each brand has its OWN menu (categories with items). The bot serves
   *  the right brand's menu when the customer asks for that brand. */
  menuCategories?: MenuCategory[];
  /** @deprecated use menuCategories */
  zomatoUrl?: string;
  /** @deprecated use menuCategories */
  swiggyUrl?: string;
  /** @deprecated use menuCategories */
  bestsellerItems?: string;
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
  /** @deprecated removed from the onboarding UI. Kept for back-compat with
   *  bots stored before the scraper-cant-read-aggregators change. */
  zomatoSwiggyLinks?: string;

  // ─── New optional fields (research-derived, all backward-compat) ───
  /** Single sub-type (legacy — kept for back-compat with old data rows) */
  subType?: RestaurantSubType;
  /** Multi-select sub-types (preferred — many businesses overlap categories
   *  e.g. cafe + bakery, sweet-shop + tiffin-attached, pure-veg + jain-only). */
  subTypes?: RestaurantSubType[];
  /** dine_in / takeaway / delivery / cloud_kitchen_only — mode flags */
  serviceModes?: ('dine_in' | 'takeaway' | 'delivery' | 'cloud_kitchen_only')[];
  /** Pure-veg disclosure (some customers will not order from shared kitchen) */
  pureVeg?: boolean;
  sharedKitchenWithNonVeg?: boolean;

  // ─── Compliance ───
  fssaiLicenseNumber?: string;
  fssaiExpiryDate?: string;
  /** 30-Jul-2025 advisory — owner uploads QR sticker URL */
  fssaiQrCodeUrl?: string;
  gstin?: string;
  panNumber?: string;
  jainCertified?: boolean;
  servesAlcohol?: boolean;
  alcoholLicenseNumber?: string;

  // ─── Cloud-kitchen multi-brand (Rebel/Charcoal Eats pattern) ───
  brands?: CloudKitchenBrand[];

  // ─── Service windows ───
  serviceBreakfastWindow?: string; // "7-10:30 AM"
  serviceLunchWindow?: string;
  serviceSnacksWindow?: string;
  serviceDinnerWindow?: string;
  serviceLateNightWindow?: string;

  // ─── Table booking ───
  tableBookingEnabled?: boolean;
  tableMinPartySize?: number;
  tableMaxPartySize?: number;
  tableAdvanceBookingDays?: number;
  tableDepositRequired?: string;

  // ─── Dine-in QR codes (auto setup) ───
  /** How many physical tables the restaurant has. On first visit to the
   *  QR codes page, if no tables exist yet, the server auto-generates
   *  this many tables (numbered 1..N) with fresh QR tokens — owner
   *  doesn't have to click "Add tables 1-N" manually. */
  numberOfTables?: number;
  /** When true, a daily cron rotates every table's qr_token so old
   *  printed QRs / screenshots stop working after rotation. Owner gets
   *  notified to reprint. Default: false (manual rotation only). */
  qrAutoRotateEnabled?: boolean;
  /** Rotation cadence in hours when qrAutoRotateEnabled. Default 24h. */
  qrAutoRotateIntervalHours?: number;

  // ─── Delivery partners ───
  deliveryPartners?: ('own_rider' | 'zomato' | 'swiggy' | 'dunzo' | 'shadowfax' | 'borzo' | 'porter' | 'rapido' | 'wefast' | 'pidge')[];
  packagingChargesPerOrder?: string;
  packagingChargesPerItem?: string;

  // ─── Surge / peak pricing ───
  rainSurchargePercent?: number;
  peakHourSurchargePercent?: number;
  festivalSurchargePercent?: number;

  // ─── Bulk / corporate orders ───
  bulkOrdersEnabled?: boolean;
  bulkOrdersMinPax?: number;
  bulkOrdersContactNumber?: string;
  bulkOrdersInvoiceWithGst?: boolean;

  // ─── Sub-type-specific configs (only relevant when subType matches) ───
  /** Custom cake studio */
  customCakeLeadTimeHours?: number;
  customCakeEgglessAvailable?: boolean;
  customCakePhotoOnCake?: boolean;
  customCakeAdvanceDepositPercent?: number;
  /** Catering */
  cateringMinPax?: number;
  cateringLiveCounters?: boolean;
  cateringWeddingSeparateContact?: string;
  /** Ice cream */
  iceCreamSellsTubs?: boolean;
  iceCreamSellsScoops?: boolean;
  iceCreamFlavorOfTheDay?: string;
  /** Juice bar */
  juiceFruitOfTheDay?: string;
  juiceColdPressedAvailable?: boolean;
  /** Mithai */
  mithaiInterstateShipping?: boolean;
  mithaiFestivalGiftBoxes?: string;

  // ─── Claims (truthful labels — bot must NOT promise these unless flag is true) ───
  noPreservativesClaim?: boolean;
  noMsgClaim?: boolean;
}

export interface Course {
  name: string;
  targetAudience: string;
  duration: string;
  fee: string;
  schedule: string;
  mode: string;
  // ─── New optional fields (research-derived) ───
  category?: 'school_tuition' | 'board_prep' | 'entrance_prep' | 'skill' | 'language' | 'overseas_prep' | 'hobby_music' | 'hobby_dance' | 'hobby_art' | 'abacus_vedic' | 'chess' | 'robotics_stem' | 'public_speaking' | 'olympiad' | 'other';
  entranceExam?: EntranceExam[];
  ageBandMin?: number;
  ageBandMax?: number;
  targetClass?: string;
  modes?: ('offline' | 'online_live' | 'online_recorded' | 'hybrid')[];
  daysPerWeek?: number;
  hoursPerDay?: number;
  weekendBatch?: boolean;
  batchStartDate?: string;
  batchEndDate?: string;
  batchSizeMin?: number;
  batchSizeMax?: number;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'grade_1' | 'grade_2' | 'grade_3' | 'grade_4' | 'grade_5';
  prerequisites?: string;
  facultyIds?: string[];
  recordedAccessIncluded?: boolean;
  recordedAccessDurationMonths?: number;
  certificateIssued?: boolean;
  certificateAffiliatedTo?: string;
  feeBreakupAdmission?: string;
  feeBreakupTuition?: string;
  feeBreakupMaterial?: string;
  feeBreakupTech?: string;
  gstIncludedInFee?: boolean;
  fullPaymentAvailable?: boolean;
  installmentsCount?: number;       // Raj Bill: min 4
  installmentFirstDuePct?: number;
  emiPartners?: EmiPartner[];
  payAfterPlacementAvailable?: boolean;
  isaTermsUrl?: string;
  placementGuaranteeOffered?: boolean;
  placementGuaranteeConditions?: string;
}

// ─── Coaching sub-types (research-derived, 23) ───
export type CoachingSubType =
  | 'school-tuition-primary'
  | 'school-tuition-middle'
  | 'board-prep'
  | 'jee-main'
  | 'jee-advanced'
  | 'neet-ug'
  | 'cat-mba'
  | 'upsc'
  | 'state-pcs'
  | 'ssc-banking-railway'
  | 'ca-cs-cma'
  | 'gate-psu'
  | 'clat-law'
  | 'nift-nid-ceed'
  | 'foreign-language'
  | 'overseas-test-prep'
  | 'coding-bootcamp'
  | 'coding-kids'
  | 'abacus-vedic'
  | 'chess'
  | 'music'
  | 'dance'
  | 'art-calligraphy'
  | 'robotics-stem'
  | 'public-speaking';

export type Board =
  | 'CBSE'
  | 'ICSE'
  | 'IB'
  | 'IGCSE'
  | 'NIOS'
  | 'StateBoard_Maharashtra'
  | 'StateBoard_Karnataka'
  | 'StateBoard_TamilNadu'
  | 'StateBoard_AndhraPradesh'
  | 'StateBoard_Telangana'
  | 'StateBoard_Kerala'
  | 'StateBoard_WestBengal'
  | 'StateBoard_Bihar'
  | 'StateBoard_UP'
  | 'StateBoard_Rajasthan'
  | 'StateBoard_Punjab'
  | 'StateBoard_Haryana'
  | 'StateBoard_Gujarat'
  | 'StateBoard_Delhi'
  | 'StateBoard_Other';

export type EntranceExam =
  | 'JEE_MAIN'
  | 'JEE_ADVANCED'
  | 'NEET_UG'
  | 'NEET_PG'
  | 'CAT'
  | 'XAT'
  | 'CMAT'
  | 'MAT'
  | 'UPSC_CSE'
  | 'STATE_PCS'
  | 'SSC_CGL'
  | 'SSC_CHSL'
  | 'BANKING_PO'
  | 'BANKING_CLERK'
  | 'RAILWAY_NTPC'
  | 'NDA_DEFENCE'
  | 'CDS_DEFENCE'
  | 'CA_FOUNDATION'
  | 'CA_INTER'
  | 'CA_FINAL'
  | 'CS'
  | 'CMA'
  | 'GATE'
  | 'CLAT'
  | 'AILET'
  | 'NIFT'
  | 'NID'
  | 'CEED'
  | 'IELTS'
  | 'TOEFL'
  | 'SAT'
  | 'GRE'
  | 'GMAT'
  | 'PTE'
  | 'OLYMPIAD'
  | 'OTHER';

export type EmiPartner = 'BajajFinserv' | 'EduFund' | 'GrayQuest' | 'Propelld' | 'EarlySalary' | 'Other';

export interface CoachingFaculty {
  id: string;
  name: string;
  subject?: string;
  experienceYears?: number;
  almaMater?: string;
  pastAffiliations?: string;
  /** Raj Coaching Bill mandates background verification */
  backgroundVerificationStatus?: 'verified' | 'pending' | 'na';
  backgroundVerificationDate?: string;
  photo?: string;
  isHeadOfDepartment?: boolean;
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

  // ─── New optional fields (research-derived, all backward-compat) ───
  subType?: CoachingSubType;
  /** Multi-select sub-types — many institutes cover JEE + NEET + CAT, or board-prep + entrance, etc. */
  subTypes?: CoachingSubType[];
  boardAffiliations?: Board[];
  entranceExamsCovered?: EntranceExam[];

  // ─── Regulator registration (Raj Bill + Central MOE Guidelines 2024) ───
  rajCoachingActRegistered?: boolean;
  rajCoachingActRegNo?: string;
  centralMoeGuidelineCompliant?: boolean;
  aicteId?: string;
  ngoOrSocietyRegNo?: string;

  // ─── Faculty (extends old facultyInfo string) ───
  faculty?: CoachingFaculty[];

  // ─── Demo / trial ───
  demoClassPrice?: string;
  demoRescheduleAllowed?: boolean;
  demoMaxRescheduleAttempts?: number;
  demoFacultyDifferentFromMain?: boolean;
  demoBatchHoldHours?: number;

  // ─── Doubt clearing ───
  doubtClearingAvailable?: boolean;
  doubtClearingTrainerSeparate?: boolean;
  doubtClearingOnlinePortalUrl?: string;

  // ─── Admission ───
  admissionType?: 'open' | 'screening_test' | 'interview' | 'scholarship_test' | 'merit_marks';
  scholarshipTestEnabled?: boolean;
  scholarshipTestName?: string;
  scholarshipTestSchedule?: string;
  scholarshipTestMaxWaiverPercent?: number;
  admissionDocumentsRequired?: string;

  // ─── Past results (extends old results string) ───
  pastResultsStructured?: { examName: string; year: string; totalAppeared?: string; totalCleared?: string; topRank?: string; topRankerName?: string; proofUrl?: string }[];

  // ─── Refund policy (Raj Bill: pro-rata within 10 days) ───
  proRataRefundEnabled?: boolean;
  refundWindowDays?: number;        // Raj Bill: 10
  cancellationFeePct?: number;
  failureRepeatFreeAvailable?: boolean;
  refundPolicyUrl?: string;
  lateJoinAllowed?: boolean;
  lateJoinProRataApplied?: boolean;

  // ─── EMI disclosure (mandatory if EMI link shared — RBI Digital Lending) ───
  emiDisclosureEnabled?: boolean;
  emiPartnersList?: EmiPartner[];
  emiAgreementUrl?: string;

  // ─── Hostel / PG referral commission disclosure (Kota model) ───
  hostelPGReferralOffered?: boolean;
  hostelPGPartnerNames?: string;
  hostelPGMonthlyRangeINR?: string;
  hostelPGCommissionDisclosed?: boolean;
  hostelPGReferralLink?: string;

  // ─── Study material + mock tests ───
  studyMaterialMode?: 'physical_only' | 'digital_only' | 'both' | 'none_self_arrange';
  pyqAccessIncluded?: boolean;
  mockTestFrequency?: string;
  mockTestsTotalPerCourse?: number;
  aiTSeriesIncluded?: boolean;

  // ─── Parent-teacher engagement ───
  parentTeacherMeetFrequency?: string;
  parentTeacherMeetMode?: 'offline' | 'online' | 'both';

  // ─── Discounts ───
  siblingDiscountPct?: number;
  earlyBirdDiscountPct?: number;
  earlyBirdDeadline?: string;
  scholarshipBasedDiscount?: boolean;
  referralBonus?: string;

  // ─── Multi-location ───
  multiLocationEnabled?: boolean;
  branches?: { id: string; name: string; city: string; address?: string; managerName?: string; contactNumber?: string }[];

  // ─── Extras ───
  corporateTrainingArm?: boolean;
  overseasPrepAddon?: boolean;

  // ─── Hobby / extras ───
  instrumentRentalAvailable?: boolean;
  materialKitFee?: string;
  annualFunctionFee?: string;
  arangetramOrRecitalFee?: string;
  externalExamFee?: string;

  // ─── Compliance gates (Raj Bill + DPDPA Section 9) ───
  /** DPDPA Section 9 — verifiable parental consent for under-18 */
  minorConsentCollected?: boolean;
  /** Raj Bill prohibits guaranteed-rank ads */
  noFalseRankClaim?: boolean;
  /** Raj Bill cap: 5 hrs/day */
  maxClassHoursPerDay?: number;
  /** Mental health counsellor mandatory for 100+ student centres */
  mentalHealthCounsellorAvailable?: boolean;

  gstin?: string;
}

export interface PropertyListing {
  title: string;
  type: string;
  price: string;
  area: string;
  highlights: string;
  // ─── New optional fields (research-derived, RERA-compliant) ───
  /** Per-listing RERA number — REQUIRED on every advert per RERA Act Section 4 */
  reraNumber?: string;
  reraQrUrl?: string;
  /** Carpet area (RERA-mandated metric — bot MUST quote this not super-built-up) */
  carpetAreaSqft?: string;
  builtUpAreaSqft?: string;
  superBuiltUpAreaSqft?: string;
  /** Loading factor % (super-built-up over carpet — disclose openly) */
  loadingFactorPct?: number;
  pricePerSqft?: string;
  /** Which area metric the price is quoted on (carpet vs super-built-up) */
  priceBasis?: 'carpet' | 'rera_carpet' | 'super_built_up';
  configuration?: '1RK' | '1BHK' | '2BHK' | '2.5BHK' | '3BHK' | '3.5BHK' | '4BHK' | 'Penthouse' | 'Plot' | 'Commercial' | 'Other';
  parkingCount?: number;
  parkingType?: 'covered' | 'open' | 'mechanical' | 'none';
  facing?: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';
  vastuCompliant?: boolean;
  floorRange?: string;            // "5-10 (out of 22)"
  unitsAvailable?: number;
  furnishingStatus?: 'unfurnished' | 'semi_furnished' | 'fully_furnished';
  /** OC / CC status — material disclosure for buyers */
  ocStatus?: 'received' | 'applied' | 'pending' | 'na_under_construction';
  ccStatus?: 'received' | 'partial' | 'pending';
  possessionDate?: string;        // ISO YYYY-MM
  /** Bangalore-specific: A-Khata = bank loans OK; B-Khata = blocks loans */
  khataAOrB?: 'A' | 'B' | 'na';
  brochureUrl?: string;
  walkthroughVideoUrl?: string;
  imageUrls?: string[];
}

// ─── Real Estate sub-types (research-derived, 18) ───
export type RealEstateSubType =
  | 'solo-broker-rental'
  | 'broker-firm-5-50'
  | 'builder-developer'
  | 'channel-partner-agency'
  | 'commercial-only'
  | 'nri-focused'
  | 'pg-aggregator'
  | 'co-living-operator'
  | 'short-term-rental'
  | 'plot-and-land'
  | 'farmhouse-villa'
  | 'luxury-5cr-plus'
  | 'industrial-warehouse'
  | 'property-management'
  | 'home-loan-dsa'
  | 'redevelopment-specialist'
  | 'resale-only'
  | 'affordable-pmay-dsa';

export interface BuilderProject {
  id: string;
  name: string;
  /** PER-PROJECT RERA number — MANDATORY (RERA Act Section 4) */
  reraNumber: string;
  reraState?: string;
  reraQrUrl?: string;             // MahaRERA QR display rule 2024
  reraExpiryDate?: string;
  developerName: string;
  projectType?: 'residential' | 'commercial' | 'mixed' | 'plotted';
  possessionDate?: string;
  actualHandoverEstimate?: string;
  ocStatus?: 'received' | 'applied' | 'pending' | 'na_under_construction';
  ocDate?: string;
  ccStatus?: 'received' | 'partial' | 'pending';
  totalUnits?: number;
  totalTowers?: number;
  configurationsAvailable?: string;     // "1BHK / 2BHK / 3BHK"
  amenities?: string;                   // free-text comma list
  distanceMetro?: string;
  distanceSchool?: string;
  distanceAirport?: string;
  distanceItPark?: string;
  gatedCommunity?: boolean;
  societyMaintenancePerSqft?: string;
  approvedByBanks?: string;             // "SBI, HDFC, ICICI"
  brochureUrl?: string;
  walkthroughVideoUrl?: string;
}

export interface HomeLoanPartner {
  bankName: 'SBI' | 'HDFC' | 'ICICI' | 'Axis' | 'Kotak' | 'PNB' | 'BOB' | 'LIC_HF' | 'Bajaj_HF' | 'Tata_Cap' | 'OTHER';
  partnerType?: 'tied_up' | 'preferred' | 'dsa_attached';
  /** ROI as-of date — mandatory disclosure (interest rates change) */
  currentRoiMin?: string;
  currentRoiMax?: string;
  roiAsOfDate?: string;
  processingFeePct?: string;
  maxTenureYears?: number;
  salariedOk?: boolean;
  selfEmployedOk?: boolean;
  nriOk?: boolean;
}

export interface RealEstateStaff {
  id: string;
  name: string;
  /** Each broker needs their own RERA registration */
  agentReraNumber?: string;
  role?: 'principal_agent' | 'rm' | 'site_visit_executive' | 'channel_partner';
  experienceYears?: number;
  specialties?: string;             // "Whitefield 2BHK / NRI / commercial"
  commissionStructure?: 'salary' | 'commission_only' | 'mixed';
  whatsappNumber?: string;
  photo?: string;
}

export interface RealEstateFields extends CommonFields {
  type: 'realestate';
  agentName: string;
  /** Agent-level RERA — MANDATORY for every sub-type except builder-only */
  reraNumber: string;
  operatingAreas: string[];
  propertyTypes: string[];
  services: string[];
  currentListings: PropertyListing[];
  siteVisitProcess: string;
  homeLoanAssistance: boolean;
  homeLoanBanks: string[];

  // ─── New optional fields (research-derived, all backward-compat) ───
  subType?: RealEstateSubType;
  /** Multi-select sub-types — channel-partners often also do resale + rental */
  subTypes?: RealEstateSubType[];
  agentReraState?: string;
  agentReraExpiry?: string;
  panNumber?: string;
  gstin?: string;

  // ─── Operational scope flags ───
  exclusiveOrCoBroking?: 'exclusive' | 'co_broking' | 'both';
  vastuConsultantAvailable?: boolean;

  // ─── Legal documentation services ───
  ocSupportAvailable?: boolean;
  ccSupportAvailable?: boolean;
  encumbranceCertSupport?: boolean;
  saleDeedDraftingSupport?: boolean;

  // ─── Bangalore-specific (research-flagged: B-Khata blocks bank loans) ───
  khataExpertiseBangalore?: boolean;

  // ─── Builder projects (when subType=builder-developer or channel-partner) ───
  builderProjects?: BuilderProject[];

  // ─── Rental policy ───
  rentalDepositMonthsBLR?: number;
  rentalDepositMonthsMUM?: number;
  rentalDepositMonthsDEL?: number;
  rentalDepositMonthsPUN?: number;
  rentalDepositMonthsHYD?: number;
  rentalDepositMonthsCHE?: number;
  rentalDepositMonthsOther?: number;
  rentalLockInMonths?: number;             // 11 typical
  rentalNoticePeriodMonths?: 1 | 2;
  rentalPetsAllowed?: 'yes' | 'no' | 'case_by_case';
  rentalFurnishingDefault?: 'unfurnished' | 'semi_furnished' | 'fully_furnished';
  rentalTenantPreference?: ('bachelor' | 'family' | 'working_pro' | 'student' | 'company_lease')[];
  rentalAgreementType?: 'leave_and_licence' | 'rent_agreement' | 'company_lease';
  rentalRegistrationByOwner?: boolean;

  // ─── PG / co-living (when sub-type matches) ───
  pgSharingTypes?: ('1_share' | '2_share' | '3_share' | '4_share' | 'private')[];
  pgGenderPolicy?: 'male' | 'female' | 'unisex' | 'couples_ok';
  pgFoodIncluded?: boolean;
  pgMealsPerDay?: 0 | 1 | 2 | 3;
  pgFoodType?: 'veg' | 'non-veg' | 'jain' | 'mixed';
  pgElectricityBilling?: 'included' | 'submeter_actuals' | 'flat_addon';
  pgExitFeeInr?: string;                   // Zolo: ₹2,500 + 18% GST
  pgExitFeeWaiverMonths?: number;
  pgNoticePeriodDays?: number;
  pgInAppMaintenance?: boolean;
  pgGroAvailable?: boolean;                // Grievance Redressal Officer
  pgAmenitiesIncluded?: string;

  // ─── NRI support (when sub-type=nri-focused) ───
  nriSupportEnabled?: boolean;
  nriCountriesServed?: string;             // "USA, UAE, UK, Singapore"
  nriCurrencyDisplay?: ('INR' | 'USD' | 'AED' | 'GBP' | 'SGD')[];
  nriPoaSupportEnabled?: boolean;
  nriVideoSiteVisit?: boolean;
  nriFcnrNreNroAdvisory?: boolean;
  nriTdsAdvisoryOnly?: boolean;            // bot must say "advisory only — verify with CA"
  nriRepatriationAdvisoryOnly?: boolean;

  // ─── Redevelopment (Mumbai-specific PAAA) ───
  redevelopmentEnabled?: boolean;
  redevelopmentCityScope?: ('MUM' | 'PUN' | 'DEL' | 'OTHER')[];
  redevelopmentPaaaSupported?: boolean;
  redevelopmentSocietyTypes?: ('cooperative' | 'mhada' | 'cessed' | 'slum_redev_sra')[];
  redevelopmentFsiTdrAdvisory?: boolean;
  redevelopmentTransitRentNegotiation?: boolean;
  redevelopmentCorpusNegotiation?: boolean;
  redevelopmentSelfRedevAdvisory?: boolean;

  // ─── Home loan partners (extends old homeLoanBanks string[]) ───
  homeLoanPartners?: HomeLoanPartner[];

  // ─── Brokerage structure ───
  rentalBrokerageMonths?: 0.5 | 1 | 2;
  rentalBrokeragePct?: string;             // alt: % of annual rent
  saleBrokeragePctMin?: string;
  saleBrokeragePctMax?: string;
  saleBrokerageGstApplicable?: boolean;
  builderBrokeragePctOfDeal?: string;      // channel-partner only
  noBrokerageSchemeAvailable?: boolean;
  brokerageNegotiable?: boolean;

  // ─── Tax & charges advisory ───
  gstApplicabilityHint?:
    | 'under_construction_affordable_1pct'
    | 'under_construction_non_affordable_5pct'
    | 'commercial_uc_12pct'
    | 'ready_to_move_nil'
    | 'rental_residential_nil'
    | 'rental_commercial_18pct'
    | 'st_rental_above_7500_12pct';
  stampDutyAdvisoryEnabled?: boolean;
  registrationChargeAdvisoryEnabled?: boolean;
  womenBuyerConcessionFlag?: boolean;       // 1-2% stamp duty waiver in many states
  pmayClssEligibility?: boolean;

  // ─── Site visit slots ───
  siteVisitPickupSupportedKm?: number;
  siteVisitVirtualTourEnabled?: boolean;
  siteVisitWeekendHours?: string;
  siteVisitOutstationCancellationFee?: string;

  // ─── Staff (extends owner attribution) ───
  staffMembers?: RealEstateStaff[];

  // ─── Source of listings (when imported from a portal) ───
  importedFromUrl?: string;
  importedFromSource?: '99acres' | 'magicbricks' | 'housing' | 'nobroker' | 'manual';

  // ─── Compliance gates (research-flagged) ───
  /** Owner-attested: bot will refuse "guaranteed return / 100% / definitely double / risk-free" */
  noGuaranteedReturnsClaim?: boolean;
  /** RERA QR auto-injection on every reply that mentions a project (recommended ON) */
  reraQrAutoInjectEnabled?: boolean;
  /** Hard-block sending replies if listing missing RERA number */
  blockSendIfReraMissing?: boolean;
}

export interface SalonServiceItem {
  name: string;
  price: string;
  duration: string;
  // ─── New optional fields (research-derived) ───
  /** Senior-stylist upcharge (additive ₹) */
  seniorStylistPrice?: string;
  /** Creative-director upcharge — top tier */
  creativeDirectorPrice?: string;
  /** Salon color — staff freed during this idle window so bot can double-book */
  processingTimeMins?: number;
  /** Optional gender restriction at item level (e.g. men's haircut only) */
  gender?: 'unisex' | 'women' | 'men';
  /** For services that vary by hair length (short/medium/long) */
  hairLength?: 'short' | 'medium' | 'long' | 'extra-long';
  /** Bestseller flag */
  isBestseller?: boolean;
  /** Brand used (Olaplex, Loreal Pro) — bot can mention */
  brand?: string;
  /** Add-ons surfaced to customer (head massage, blow-dry, scalp serum) */
  addOns?: { name: string; price: string }[];
}

export interface SalonServiceCategory {
  category: string;
  items: SalonServiceItem[];
}

export interface SalonPackage {
  name: string;
  includes: string;
  price: string;
  // ─── New optional fields (research-derived) ───
  /** Bridal / party / regular / monsoon_offer / first_time / couple / sibling_combo */
  packageType?: 'bridal' | 'party' | 'regular' | 'monsoon_offer' | 'first_time' | 'couple' | 'sibling_combo';
  durationHours?: number;
  advanceBookingDays?: number;
}

// ─── Salon sub-types (research-derived, 17) ───
export type SalonSubType =
  | 'unisex-chain'
  | 'women-only-parlour'
  | 'mens-barber'
  | 'premium-mens-grooming'
  | 'home-service-stylist'
  | 'bridal-makeup-studio'
  | 'mehendi-studio'
  | 'party-makeup'
  | 'hair-only'
  | 'nail-bar'
  | 'tattoo-piercing'
  | 'spa-general'
  | 'spa-ayurvedic'
  | 'wellness-yoga-reiki'
  | 'kids-salon'
  | 'threading-express'
  | 'mens-grooming-subscription';

export interface SalonStaffMember {
  id: string;
  name: string;
  role: 'creative_director' | 'senior_stylist' | 'junior_stylist' | 'apprentice' | 'specialist' | 'mehendi_artist' | 'makeup_artist' | 'tattoo_artist' | 'therapist';
  gender?: 'M' | 'F' | 'NB';
  /** Off by default for women-only parlours (privacy) */
  photo?: string;
  perServiceUpcharge?: number;
  specialties?: string[];     // bridal, prenatal, color-correction, henna-design
  experienceYears?: number;
  /** ISO date list — auto-reroute trigger */
  onLeaveDates?: string[];
}

export interface BridalEventPricing {
  haldi?: string;
  mehendi?: string;
  sangeet?: string;
  wedding: string;             // mandatory anchor
  reception?: string;
  cocktail?: string;
}

export interface MehendiConfig {
  bridalFlatRate?: string;        // ₹3,100 – ₹51,000
  bridalIncludes?: 'hands_only' | 'hands_feet' | 'hands_feet_arms_elbow';
  figuresExtraPerPair?: string;   // ₹2,000 typical
  groomMehendiPrice?: string;
  perHandGuestPrice?: string;     // ₹100–250 per hand for guest mehendi
  arabicSimplePerHand?: string;
  teamSizeOptions?: string;       // free-form: "1, 2, 4, 8 artists"
  handlesPerArtistPerHour?: number; // ~10
  organicHennaOnly?: boolean;
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

  // ─── New optional fields (research-derived) ───
  subType?: SalonSubType;
  /** Multi-select — bridal studios often also do mehendi + party makeup */
  subTypes?: SalonSubType[];

  // ─── Booking + slots ───
  walkInsAccepted?: boolean;
  walkInQueueDigital?: boolean;
  advanceDepositPercent?: number;   // default 25-50% for bridal
  advanceDepositMinAmount?: string;
  weekendsBookedOutDays?: number;   // typical: 5-7 days ahead
  /** Diwali-week / wedding-season uplift — bot warns customer */
  diwaliWeekSurcharge?: boolean;
  weekendUpliftPercent?: number;    // ₹/% extra on Sat-Sun
  weddingSeasonMonths?: string;     // "Oct-Feb"
  womenOnlyHours?: string;          // "10 AM - 2 PM Wed/Fri"
  kidsHaircutDays?: string;         // "Sundays only"

  // ─── Bridal package depth ───
  bridalTrialIncluded?: boolean;
  bridalTrialMinDaysBefore?: number;   // 30 days typical
  bridalTrialPrice?: string;
  bridalTrialRefundedOnBooking?: boolean;
  bridalEventPricing?: BridalEventPricing;
  bridalBundleDiscountPercent?: number;
  /** Outstation bridal — travel charges per km, stay extra */
  bridalOutstationAvailable?: boolean;
  bridalOutstationTravelChargesPerKm?: string;
  bridalOutstationStaySeparate?: boolean;
  bridalOutstationTeamSize?: string;
  bridalRefundCutoffDays?: number;     // 60 days typical

  // ─── Mehendi (sub-type-specific) ───
  mehendiConfig?: MehendiConfig;

  // ─── Staff with tier pricing ───
  staffMembers?: SalonStaffMember[];

  // ─── Home service expansion ───
  homeServiceRadiusKm?: number;
  homeServiceChargesPerKm?: string;
  homeServiceFlatCharge?: string;
  outstationAvailable?: boolean;
  outstationPickupDropCharges?: string;
  outstationStayBilledExtra?: boolean;
  /** Owner-attested: home-kit hygiene SOP — bot can quote */
  kitHygieneSOP?: string;

  // ─── Recurring / membership / loyalty ───
  prepaidPacks?: { name: string; payAmount: string; walletValue: string; validityMonths: number }[];
  membershipMonthlyFee?: string;
  loyaltyVisitMilestone?: string;     // "Free haircut on 10th visit"

  // ─── Policies ───
  cancellationHoursBefore?: number;   // 24 typical
  cancellationFeePercent?: number;
  noShowFee?: string;
  bridalAdvanceRefundable?: boolean;
  /** Bridal/tattoo/piercing/chemical/extensions require signed consent */
  consentFormRequiredFor?: ('bridal' | 'tattoo' | 'piercing' | 'chemical' | 'extensions')[];

  // ─── Gift cards ───
  giftCardsEnabled?: boolean;
  giftCardRedeemableOn?: ('services' | 'products' | 'both')[];
  giftCardMinAmount?: string;
  giftCardExpiryMonths?: number;

  // ─── Compliance (research-heavy for spa-ayurvedic + tattoo) ───
  beauticianRegistrationStateLicence?: string;
  ayushRegistered?: boolean;          // mandatory if subType=spa-ayurvedic
  ayushLicenceNumber?: string;
  tattooStudioHealthLicence?: string; // mandatory if subType=tattoo-piercing
  sterilizationSOP?: 'autoclave_weekly_spore_test' | 'single_use_only' | 'none';
  /** Owner attestation — bot must reject "cure"/"treatment"/"heal"/"therapy" claims */
  medicalClaimsAvoided?: boolean;
  gstin?: string;
  consumerRefundClauseVisible?: boolean;

  // ─── Private client notes (DPDPA) ───
  privateClientNotesEnabled?: boolean;
  privateClientNoteFields?: ('allergies' | 'preferred_stylist' | 'do_not_book' | 'past_disputes')[];
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
  // ─── New optional fields (research-derived) ───
  durationMonths?: number;
  isCouple?: boolean;
  isFamily?: boolean;
  familyMaxMembers?: number;
  excludes?: string;
  /** Off-peak only memberships are cheaper */
  peakAccess?: boolean;
  offPeakWindow?: string;             // "11 AM-4 PM"
  /** home_only / all_branches / city / national */
  accessibleLocations?: 'home_only' | 'all_branches' | 'city' | 'national';
  registrationFeeIncluded?: boolean;
}

// ─── Gym sub-types (research-derived, 18) ───
export type GymSubType =
  | 'full-service-chain'
  | 'neighbourhood-gym'
  | 'women-only'
  | 'crossfit-box'
  | 'yoga-hatha-ashtanga'
  | 'yoga-power-vinyasa'
  | 'iyengar-lineage'
  | 'pilates-reformer'
  | 'zumba-dance-fitness'
  | 'mma-boxing'
  | 'kickboxing'
  | 'kalaripayattu'
  | 'multi-sport-academy'
  | 'kids-academy'
  | 'senior-yoga'
  | 'prenatal-postnatal'
  | 'ems-studio'
  | 'calisthenics-park'
  | 'functional-studio'
  | 'online-coach';

export type GymCertification =
  | 'ACE'
  | 'NASM'
  | 'REPS_India'
  | 'K11'
  | 'CrossFit_L1'
  | 'CrossFit_L2'
  | 'Yoga_Alliance_RYT200'
  | 'Yoga_Alliance_RYT500'
  | 'Stott_Pilates'
  | 'Polestar_Pilates'
  | 'Zumba_ZIN'
  | 'NSDC_SFSSC'
  | 'ISSA'
  | 'AAP'
  | 'Other';

export type GymAggregator = 'FITPASS' | 'Cultpass' | 'OnePass' | 'ClassPass';

export interface GymTrainer {
  id: string;
  name: string;
  gender?: 'M' | 'F' | 'NB';
  certifications?: GymCertification[];
  specialisations?: string[];      // weight-loss, strength, prenatal, sports-specific
  experienceYears?: number;
  pricePerSessionRupees?: string;
  packageSessions?: number;        // e.g. 12-session package
  packagePriceRupees?: string;
  noShowFeeRupees?: string;
  cancelWindowHours?: number;
  /** Trainer-only female-clients flag (privacy / preference) */
  femaleOnly?: boolean;
}

export interface GymCorporatePartner {
  employer: string;                // 'TCS', 'Infosys', 'Wipro'
  discountPercent: number;
  verificationRequired: 'email_domain' | 'id_card' | 'manual';
}

export interface GymProgram {
  name: string;                    // '90-Day Transformation', 'Marathon Prep'
  durationDays: number;
  priceRupees: string;
  cohortBased?: boolean;
  nextStartDate?: string;
  medicalAssessmentIncluded?: boolean;
  /** Owner-attested: NO outcome guarantees per WhatsApp policy */
  outcomeDisclaimerShown?: boolean;
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

  // ─── New optional fields (research-derived, all backward-compat) ───
  subType?: GymSubType;
  /** Multi-select — many studios run yoga + pilates, or gym + functional */
  subTypes?: GymSubType[];

  // ─── Registration / one-time fees (separate from monthly) ───
  registrationFeeAmount?: string;
  registrationFeeRefundable?: boolean;
  registrationFeeWaivedInPromo?: boolean;
  registrationFeeNotes?: string;

  // ─── Freeze / pause policy (Cult: 60 days for annual) ───
  freezePolicyEnabled?: boolean;
  freezeMaxDaysPerCycle?: number;
  freezeMinPlanDurationMonths?: number;
  freezeAdvanceNoticeDays?: number;
  freezeFeeRupees?: string;
  freezeMedicalUnlimited?: boolean;

  // ─── Discounts ───
  couplePercent?: number;
  familyPercent?: number;
  referralRupees?: string;

  // ─── Corporate tie-ups ───
  corporatePartners?: GymCorporatePartner[];
  /** Three-tier aggregator partners (Cult Pass / FITPASS / OnePass) */
  aggregatorPartners?: GymAggregator[];

  // ─── Trainers (extends old personalTraining string) ───
  trainers?: GymTrainer[];

  // ─── Group classes — slot-aware ───
  groupClassesEnabled?: boolean;
  classWaitlistEnabled?: boolean;
  classBookingWindowHours?: number;
  classDropInPriceRupees?: string;

  // ─── Programs ───
  programs?: GymProgram[];

  // ─── Trial ───
  trialType?: 'free' | 'paid' | 'open_day';
  trialPaidPriceRupees?: string;
  trialConvertedDiscountPercent?: number;

  // ─── Equipment + facility flags ───
  equipmentList?: string;
  hasGymFloor?: boolean;
  hasCardioZone?: boolean;
  hasFreeWeights?: boolean;
  hasTurf?: boolean;
  hasPool?: boolean;
  hasSteam?: boolean;
  hasSauna?: boolean;
  hasShower?: boolean;
  hasLocker?: boolean;
  hasWifi?: boolean;
  hasCafe?: boolean;
  hasParkingFree?: boolean;
  hasParkingPaid?: boolean;
  hasKidsPlayArea?: boolean;
  hasPhysioRoom?: boolean;
  hasRecoveryZone?: boolean;

  // ─── Add-ons ───
  lockerRentalRupees?: string;
  towelService?: boolean;
  dietPlanRupees?: string;
  bodyCompositionScanRupees?: string;

  // ─── Audience flags ───
  womenOnly?: boolean;
  womenOnlyTimings?: string;
  petFriendlyHours?: string;
  prenatalAvailable?: boolean;
  seniorAvailable?: boolean;
  kidsAvailable?: boolean;
  kidsAgeGroups?: string;

  // ─── EMS-specific (sub-type only) ───
  emsSuitFeeOneTimeRupees?: string;
  emsMaxSessionsPerWeek?: number;
  emsSessionDurationMin?: number;

  // ─── Day-pass + guest policy ───
  dayPassPriceRupees?: string;
  guestPolicy?: 'allowed_paid' | 'allowed_free_once' | 'not_allowed';

  // ─── Compliance gates ───
  /** URLs to liability waiver / informed consent PDFs */
  liabilityWaiverUrl?: string;
  preExistingConditionDisclaimer?: boolean;
  /** Categories that require medical clearance before joining */
  medicalClearanceRequired?: ('prenatal' | 'senior' | 'ems' | 'crossfit' | 'mma')[];
  /** When dietPlan is offered, this MUST be true (regulatory) */
  dietDisclaimerShown?: boolean;
  /** Owner-attested: bot will refuse "guaranteed transformation" / "lose X kg in Y days" */
  noOutcomeGuaranteeClaim?: boolean;

  gstin?: string;
}

// ─── Tiffin Service ───
// Subscription-style home/cloud-kitchen meal delivery (lunch/dinner dabbas).
// Distinct from `restaurant`: unit of sale is a recurring plan, not a la
// carte; menu rotates weekly/monthly rather than being a fixed catalog.
export interface TiffinPlan {
  name: string;
  duration: string;
  price: string;
  includes: string;
  mealType: string;
  foodType: string;
  // ─── New optional plan fields (research-derived) ───
  // Distinguishes plans that differ ONLY by carb composition (Mom's Food Tiffin
  // pattern: "2 roti + rice" vs "4 roti + no rice"). The bot needs this
  // explicitly to answer "kitne roti milte hain?" honestly.
  rotiCount?: number;
  rotiType?: 'wheat-chapati' | 'jowar-bhakri' | 'bajra' | 'phulka' | 'paratha' | 'mixed';
  riceIncluded?: boolean;
  dalIncluded?: boolean;
  sabziCount?: number;
  saladPickleIncluded?: boolean;
  sweetIncluded?: 'never' | 'daily' | 'weekly' | 'festival-only';
  drinkingWaterIncluded?: boolean;
  portionSize?: 'mini' | 'regular' | 'big-belly' | 'executive';
}

// ─── Tiffin sub-types (research-derived, 15) ───
export type TiffinSubType =
  | 'home-kitchen-aunty'
  | 'organised-dabbawala'
  | 'corporate-b2b'
  | 'pg-mess-contractor'
  | 'gym-diet-meal'
  | 'jain-only'
  | 'satvik-no-onion-garlic'
  | 'regional-maharashtrian'
  | 'regional-gujarati'
  | 'regional-south-indian'
  | 'regional-bengali'
  | 'keto-diabetic'
  | 'executive-lunch'
  | 'multi-kitchen-aggregator'
  | 'pickup-only';

export interface TiffinFields extends CommonFields {
  type: 'tiffin';
  serviceName: string;
  cuisineStyle: string;
  mealsServed: string[];
  plans: TiffinPlan[];
  weeklyMenu: string;
  trialAvailable: boolean;
  trialDetails: string;
  deliveryAvailable: boolean;
  deliveryAreas: string[];
  deliveryCharges: string;
  deliveryTimings: string;
  customRequestsAllowed: boolean;
  paymentCycle: string;
  paymentMethods: string[];
  holidaysClosed: string;

  // ─── New optional research-derived fields ───
  /** Single sub-type (legacy) */
  subType?: TiffinSubType;
  /** Multi-select — many tiffins are home-kitchen + Jain-only, or corporate + executive-lunch */
  subTypes?: TiffinSubType[];
  ownerType?: 'home-cook' | 'commercial-kitchen' | 'cloud-kitchen' | 'mess-contractor' | 'aggregator';
  // Top-3 WhatsApp question we currently can't answer truthfully
  oilType?: 'refined' | 'filtered-groundnut' | 'mustard' | 'sunflower' | 'olive' | 'mixed';
  gheeUsed?: 'none' | 'desi-cow-ghee' | 'buffalo-ghee' | 'vanaspati' | 'occasional';
  // Egg policy is a recurring source of customer complaint when not declared.
  eggInclusionOption?: 'never' | 'on-request' | 'sunday-only' | 'twice-weekly' | 'always';
  jainAvailable?: boolean;
  noOnionGarlicAvailable?: boolean;
  diabeticPlanAvailable?: boolean;
  postPregnancyPlanAvailable?: boolean;
  // FSSAI compliance (basic registration ₹100/yr <₹12L turnover)
  fssaiNumber?: string;
  fssaiType?: 'basic-registration' | 'state-license' | 'central-license';
  // Cutoff for tomorrow's tiffin (TiffinStash benchmark: order before 9 PM
  // previous day; Country Delight midnight model).
  advanceBookingCutoff?: string;
  // What happens when a subscriber skips a tiffin
  skipBillingPolicy?: 'prorated-refund' | 'rolled-over-to-next' | 'forfeit' | 'wallet-credit';
  maxSkipsPerCycle?: number;
  // Where the dabba is handed off — affects bot's address-collection prompt
  deliveryHandoffPoint?: 'door' | 'gate' | 'pg-reception' | 'office-desk' | 'flexible';
  // Container / tiffin-box deposit
  containerType?: 'disposable-bio' | 'disposable-plastic' | 'steel-return' | 'multi-tier-tiffin' | 'customer-supplied';
  containerDeposit?: string;
  containerDepositRefundable?: boolean;
  // Same-day guest dabba pricing
  guestDabbaSameDayAllowed?: boolean;
  guestDabbaCutoffHours?: number;
  guestDabbaPrice?: string;
  // Mid-cycle plan switch (most aggregators block this, home cooks allow)
  midCyclePlanSwitchAllowed?: boolean;
  // Capacity check — bot uses to refuse new orders past limit
  capacityPerDay?: number;
  // Festival overrides — Navratri / Shravan / Paryushan special menu
  festivalOverrides?: string;
}

// ─── Ecommerce / Online Shop ───
// Generic online retailer — fashion, electronics, books, gifts, home goods,
// toys, gadgets, kids, accessories, etc. Distinct from `d2c` (single-brand,
// Instagram-led) and `grocery` (daily-fresh neighbourhood). Usually carries
// multiple categories, many SKUs, broader pincode reach, mixed online/COD
// payment, and the bot replaces a Shopify/Meesho-style chat support + cart-
// recovery flow.
// ─── Ecommerce sub-types (research-derived, 18) ───
export type EcommerceSubType =
  | 'fashion-d2c'
  | 'saree-kurta-ethnic'
  | 'beauty-skincare-d2c'
  | 'gold-silver-jewellery'
  | 'imitation-jewellery'
  | 'home-decor'
  | 'electronics-reseller'
  | 'books-stationery'
  | 'kids-toys-clothing'
  | 'packaged-food'
  | 'gifting-hampers'
  | 'custom-print-on-demand'
  | 'handloom-handicraft-gi'
  | 'instagram-only-seller'
  | 'shopify-store'
  | 'subscription-box'
  | 'b2b-wholesale-only'
  | 'dropshipper-multi-marketplace';

export type EcommerceMarketplace = 'amazon' | 'flipkart' | 'meesho' | 'myntra' | 'ajio' | 'nykaa' | 'jiomart' | 'snapdeal' | 'firstcry' | 'tatacliq';
export type EcommerceCourierPartner = 'shiprocket' | 'delhivery' | 'bluedart' | 'ecomexpress' | 'dtdc' | 'xpressbees' | 'shadowfax' | 'indiapost' | 'own_rider';

export interface EcommerceVariant {
  variantId?: string;
  size?: string;
  color?: string;
  material?: string;
  storage?: string;
  weight?: string;
  flavor?: string;
  price?: string;
  mrp?: string;
  inventory?: number;
  barcode?: string;
  imageUrl?: string;
}

export interface EcommerceProduct {
  name: string;
  price: string;
  description: string;
  category?: string;
  bestseller: boolean;
  inStock?: boolean;
  imageUrl?: string;
  // ─── New optional research-derived fields (E-com Rules 2020 + BIS) ───
  sku?: string;
  mrp?: string;
  /** Variants — size × colour × storage × material (most fashion / electronics) */
  variants?: EcommerceVariant[];
  sizeChartUrl?: string;
  /** Country of origin — E-com Rules 2020 §4(1)(b) MANDATORY */
  countryOfOrigin?: string;
  manufacturer?: string;
  importer?: string;
  /** BIS Hallmark UID — MANDATORY for jewellery since 1 Apr 2023 */
  bisHallmarkHuid?: string;
  bisPurityCarat?: 14 | 18 | 22 | 24;
  /** BIS ISI — electronics, helmets, toys */
  bisIsiNumber?: string;
  /** FSSAI — packaged food */
  fssaiNumber?: string;
  /** Handloom Mark / GI Tag — false claim is criminal under GI Act 1999 */
  handloomMark?: string;
  giTagNumber?: string;
  /** Truthful claims (only enable if verified) */
  madeInIndiaClaim?: boolean;
  crueltyFreeClaim?: boolean;
  veganClaim?: boolean;
  ecoFriendlyClaim?: boolean;
  /** Legal Metrology — pre-packaged retailers MUST disclose */
  netQuantity?: string;
  mfgDate?: string;
  expiryDate?: string;
  batchId?: string;
  /** Warranty */
  warrantyMonths?: number;
  warrantyType?: 'manufacturer' | 'seller' | 'replacement_only' | 'none';
  serviceCenterUrl?: string;
  warrantyCardRequired?: boolean;
  /** Ops */
  careInstructions?: string;
  fragile?: boolean;
  sampleAvailable?: boolean;
  subscriptionEligible?: boolean;
}

export interface EcommerceDiscountCode {
  code: string;
  type: 'flat' | 'percent' | 'bogo' | 'buy2get1' | 'freegift' | 'tier';
  value?: string;
  minOrderValue?: string;
  maxDiscount?: string;
  categoryRestriction?: string;
  validFrom?: string;
  validTo?: string;
  firstOrderOnly?: boolean;
  stackable?: boolean;
}

export interface EcommerceWarehouse {
  id: string;
  name: string;
  pincode: string;
  city?: string;
  servesPincodes?: string;        // comma-separated for UX
}

export interface EcommerceMarketplacePresence {
  channel: EcommerceMarketplace;
  sellerUrl?: string;
  crossPlatformSku?: string;
  priceVariesByChannel?: boolean;
}

export interface EcommerceFields extends CommonFields {
  type: 'ecommerce';
  shopName: string;
  productCategories: string[];
  products: EcommerceProduct[];
  websiteUrl: string;
  instagramHandle: string;
  shippingPolicy: string;
  shippingCharges: string;
  freeShippingAbove: string;
  returnPolicy: string;
  exchangePolicy: string;
  codAvailable: boolean;
  codCharges: string;
  paymentMethods: string[];
  serviceableAreas: string;
  deliveryTimeline: string;
  currentOffers: string;
  gstNumber?: string;
  orderTrackingProcess: string;
  supportHours: string;

  // ─── New optional fields (research-derived, all backward-compat) ───
  subType?: EcommerceSubType;
  /** Multi-select — most stores cover fashion + accessories, or beauty + gifting */
  subTypes?: EcommerceSubType[];

  // ─── Storefront ───
  storefrontType?: 'shopify' | 'woocommerce' | 'dukaan' | 'mydukaan' | 'instagram_only' | 'meesho_reseller' | 'multi_marketplace' | 'none';
  shopifyDomain?: string;
  acceptsDmOrders?: boolean;

  // ─── Marketplace presence (Amazon / Flipkart / Meesho / Myntra) ───
  marketplacePresence?: EcommerceMarketplacePresence[];

  // ─── Multi-warehouse ───
  warehouses?: EcommerceWarehouse[];

  // ─── Discount codes + bulk tiers ───
  discountCodes?: EcommerceDiscountCode[];
  bulkTier1MinQty?: number;
  bulkTier1DiscountPct?: number;
  bulkTier2MinQty?: number;
  bulkTier2DiscountPct?: number;
  bulkTier3MinQty?: number;
  bulkTier3DiscountPct?: number;
  festivalCountdownName?: string;
  festivalCountdownEndsAt?: string;
  freeGiftAboveThreshold?: string;
  freeGiftSku?: string;

  // ─── Recurring (subscription products) ───
  subscriptionEnabled?: boolean;
  subscriptionIntervals?: ('15d' | '30d' | '45d' | '60d')[];
  subscriptionPauseAllowed?: boolean;
  subscriptionSkipAllowed?: boolean;

  // ─── Trial / first order ───
  firstOrderDiscountPercent?: number;
  freeSampleAvailable?: boolean;

  // ─── Shipping (extended) ───
  primaryCourier?: EcommerceCourierPartner;
  courierPartners?: EcommerceCourierPartner[];
  deliveryMetroDays?: string;       // "2-3"
  deliveryTier2Days?: string;       // "3-5"
  deliveryTier3Days?: string;       // "5-7"
  deliveryNortheastDays?: string;   // "7-10"
  internationalShippingAvailable?: boolean;
  fragilePackagingExtraCharge?: string;
  festivalPackagingExtraCharge?: string;

  // ─── Pincode COD policy (research insight: tier-3 RTO up to 40%) ───
  codMinOrder?: string;             // "COD only above ₹500"
  codMaxOrder?: string;
  codVerificationCallEnabled?: boolean;   // GoKwik study: reduces RTO 30%
  prepaidOnlyPincodes?: string;          // comma-separated for UX
  rtoBufferDays?: number;
  codToPrepaidNudgeDiscount?: string;
  partialCodEnabled?: boolean;

  // ─── Return policy (extended) ───
  returnEnabled?: boolean;
  returnWindowDays?: 0 | 3 | 7 | 10 | 15 | 30;
  returnReasonsAccepted?: ('damaged' | 'defective' | 'wrong_product' | 'size_issue' | 'quality' | 'changed_mind')[];
  returnRequirePhotoEvidence?: boolean;
  returnRequireBatchId?: boolean;
  nonReturnableCategories?: string;
  returnRefundMode?: 'original_payment' | 'store_credit' | 'wallet_points' | 'choice';
  reversePickupServiceable?: 'all' | 'most' | 'limited';
  reversePickupCharge?: string;
  selfShipFallbackAllowed?: boolean;

  // ─── Exchange (extended) ───
  exchangeEnabled?: boolean;
  exchangeWindowDays?: number;
  exchangeSizeOnly?: boolean;
  exchangeCrossCategoryAllowed?: boolean;
  exchangeMaxPerOrder?: 1 | 2 | -1;       // -1 = unlimited

  // ─── B2B / wholesale ───
  b2bWholesaleEnabled?: boolean;
  b2bMoqPieces?: number;
  b2bGstInvoiceMandatory?: boolean;
  b2bDeliveryChallan?: boolean;
  b2bNetPaymentTerms?: 'advance' | 'net15' | 'net30';

  // ─── Gift options ───
  giftWrapAvailable?: boolean;
  giftWrapCharge?: string;
  giftMessageEnabled?: boolean;
  giftMessageMaxChars?: 50 | 100 | 200;
  scheduledDeliveryEnabled?: boolean;
  hideInvoiceOnGift?: boolean;

  // ─── Loyalty ───
  loyaltyEnabled?: boolean;
  loyaltyWalletPointName?: string;       // "TSS Money", "Mama Coins"
  loyaltyPointsPerRupee?: string;
  loyaltyRedemptionRatio?: string;
  loyaltyReferralReward?: string;

  // ─── Abandoned cart sequence ───
  abandonedCartEnabled?: boolean;
  abandonedCart1hMessage?: string;
  abandonedCart24hMessage?: string;
  abandonedCart24hDiscountCode?: string;
  abandonedCart7dMessage?: string;
  abandonedCart7dDiscountCode?: string;

  // ─── Compliance (E-com Rules 2020 + DPDPA 2023) ───
  panNumber?: string;
  /** E-com Rules 2020 §5(1) MANDATORY grievance officer */
  grievanceOfficerName?: string;
  grievanceOfficerEmail?: string;
  grievanceOfficerPhone?: string;
  nodalOfficerName?: string;
  nodalOfficerEmail?: string;
  abandonedCartConsentEnabled?: boolean;
  privacyPolicyUrl?: string;
}

// ─── Grocery / Daily Fresh Ecom ───
// Local fresh-grocery seller — sabziwala, fruit-wala, kirana, dairy, bakery.
// Distinct from `d2c`: catalog rotates daily based on what's fresh today,
// orders are recurring/list-style, delivery is same-day or next-morning slots,
// and COD is the dominant payment method. Buyer behaviour (price-sensitive,
// neighbourhood trust, pin-code-bound) is materially different from a branded
// D2C buyer.
// Sub-types within grocery (research-derived — kirana through pickle-home)
export type GrocerySubType =
  | 'kirana'
  | 'sabziwala'
  | 'fruit'
  | 'dairy'
  | 'milk-only'
  | 'bakery'
  | 'meat'
  | 'fish'
  | 'poultry'
  | 'aata-chakki'
  | 'organic'
  | 'supermarket'
  | 'sweet-daily'
  | 'masala'
  | 'dryfruit'
  | 'pickle-home';

export interface GroceryFields extends CommonFields {
  type: 'grocery';
  // ─── Pre-existing fields (kept for backward compat with seed/handler logic) ───
  defaultProducts: string[];
  deliverySlots: string;
  serviceableAreas: string;
  paymentMethods: string[];
  minimumOrder: string;

  // ─── New optional fields (research-derived; safe to omit) ───
  subType?: GrocerySubType;
  /** Multi-select — kirana often also runs dairy + bakery; supermarkets cover everything */
  subTypes?: GrocerySubType[];
  fssaiNumber?: string;
  fssaiType?: 'basic-registration' | 'state-license' | 'central-license';
  legalMetrologyRegNumber?: string;
  shopActLicense?: string;
  catalogMode?: 'static' | 'daily-mandi' | 'weekly-rotating' | 'seasonal';
  dailyCatalogTextarea?: string;
  dailyCatalogCutoffTime?: string;
  eveningMarketRunSupported?: boolean;
  defaultPricingTier?: 'retail' | 'wholesale' | 'both';
  wholesaleMinOrderValue?: string;
  zones?: Array<{
    zoneName: string;
    pincodes: string;
    deliveryFee: string;
    minimumOrder: string;
    buildingHandoff?: 'door' | 'gate' | 'concierge' | 'guard' | 'customer-choice';
  }>;
  recurringOrdersEnabled?: boolean;
  recurringCycle?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  coldChainSupport?: boolean;
  freshnessDefaultTag?: 'made-this-morning' | 'today-catch' | 'baked-today' | 'cut-fresh' | 'mandi-today' | 'frozen';
  substitutionPolicy?: 'auto-substitute' | 'ask-customer' | 'cancel-line-item' | 'cancel-order';
  upiVPA?: string;
  cashAtDoor?: boolean;
  cashChangeAvailableUpto?: string;
  udhaarAllowedForRegulars?: boolean;
  acceptsReturn?: boolean;
  returnWindowHours?: '6' | '24';
  returnRefundMode?: 'replace-next-delivery' | 'wallet-credit' | 'refund-original' | 'shopkeeper-discretion';
  organicCertBody?: 'NPOP' | 'India-Organic' | 'Jaivik-Bharat' | 'PGS-India' | 'none';
  organicCertNumber?: string;
  jhatkaCertified?: boolean;
  byoGrainAllowed?: boolean;
  grindingFeePerKg?: string;
}

export type BusinessType = 'restaurant' | 'coaching' | 'realestate' | 'salon' | 'd2c' | 'gym' | 'tiffin' | 'grocery' | 'ecommerce';

export type ClientConfig =
  | RestaurantFields
  | CoachingFields
  | RealEstateFields
  | SalonFields
  | D2CFields
  | GymFields
  | TiffinFields
  | GroceryFields
  | EcommerceFields;

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

// Vertical-specific staff fields stored as a JSON blob in staff.extra_json.
// Each vertical only writes/reads the keys relevant to it; other keys are
// ignored. Adding a new key here doesn't require a DB migration.
export interface StaffExtra {
  // Common
  gender?: 'M' | 'F' | 'NB';
  experienceYears?: number;
  // Salon
  role?: string;                       // e.g. 'senior_stylist', 'mehendi_artist'
  photo?: string;                      // URL — off by default for women-only parlours
  perServiceUpcharge?: number;
  specialties?: string[];              // bridal, color, mehendi-design
  // Gym
  certifications?: string[];           // ACE, NASM, K11, RYT200
  specialisations?: string[];          // weight-loss, prenatal, sports-specific
  packageSessions?: number;            // 12-session package
  packagePriceRupees?: string;
  femaleOnly?: boolean;                // trainer accepts only female clients
  noShowFeeRupees?: string;
  cancelWindowHours?: number;
  // Real Estate
  agentReraNumber?: string;
  agentReraState?: string;
  agentReraExpiry?: string;
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
  /** Vertical-specific fields (StaffExtra). Always defined; empty object
   *  for legacy rows pre-0002 migration. */
  extra: StaffExtra;
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
  tiffin:     { singular: 'Cook',         plural: 'Cooks',         icon: '🍱' },
  ecommerce:  { singular: 'Support rep',  plural: 'Support team',  icon: '🛒' },
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
  // Per-bot override for the stale-pending-booking auto-cancel timeout
  // (minutes). Null/undefined means use the platform default (60).
  // Clamped to [30, 240] at the API boundary.
  stale_booking_minutes?: number | null;
  // Storefront subdomain — DNS-safe slug used at <slug>.zaptext.shop.
  // Empty/undefined = storefront not configured yet.
  slug?: string;
  // JSON array of serviceable pincodes (parsed from text). Empty array
  // string '[]' means the storefront accepts orders from any pincode.
  service_pincodes?: string;
  // Owner-controlled storefront enable toggle. False/undefined = the
  // subdomain returns 404 even if a slug is set, so accidental DNS
  // hits never expose a half-configured menu.
  storefront_enabled?: boolean;
  // FSSAI allergen-safety guardrail (Work Item 4). When TRUE (default
  // for every new bot), the webhook injects an instruction telling the
  // bot to REFUSE allergen-safety confirmations for menu items whose
  // allergens[] is empty — and route the customer to call the kitchen.
  // Owners with fully-populated allergen data can toggle OFF from
  // /client/settings -> Allergen safety.
  allergen_strict_mode?: boolean;
  // Kitchen capacity gate (Work Item 5). Maximum concurrent in-flight
  // orders the kitchen can absorb. NULL/undefined → platform default
  // (8). When the live count reaches this number the webhook tells the
  // bot to quote a wait-time instead of accepting a new [ORDER:] tag.
  // Clamped to [1, 200] at the API boundary.
  concurrent_order_cap?: number | null;
  // Per-channel owner notification toggles (Default-Prompt Rewrite).
  // Default TRUE for every bot — owner can mute individual channels
  // in Bot Settings. The webhook checks the corresponding flag before
  // firing the outbound for each event type (order / booking / payment).
  notify_whatsapp?: boolean;
  notify_email?: boolean;
  notify_dashboard?: boolean;
  // Order approval mode (Order Gate). 'auto' = bot checks stock and
  // emits [ORDER:] directly (current behaviour). 'manual' = bot emits
  // [ORDER_PENDING:], booking goes pending_approval, owner gets
  // Approve/Decline buttons on WhatsApp + email + dashboard alert.
  order_approval_mode?: 'auto' | 'manual';
  // First-touch / welcome message language preference. Per-message
  // detection (Devanagari + Hinglish keyword count) overrides this
  // once the customer speaks — this is the cold-start default only.
  default_language?: 'english' | 'hindi' | 'hinglish';
}

// Conversation priority (Work Item 7). Per-message classification produced
// by lib/conversation-priority.ts. The conversations dashboard surfaces
// threads whose last inbound row is non-normal at the top, with a colored
// dot. Owner reply (next outbound) implicitly clears the alert.
export type PriorityLevel = 'normal' | 'attention' | 'urgent';

export interface ConversationRow {
  timestamp: string;
  client_id: string;
  customer_phone: string;
  direction: 'incoming' | 'outgoing';
  message: string;
  message_type: string;
  priority_level?: PriorityLevel;
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
  // Multi-category inventory (Phase 3). Empty string = use the vertical's
  // default category at render time. tracks_stock=false hides stock fields
  // for service/plan-style items (memberships, services, courses, listings).
  category?: string;
  tracks_stock?: boolean;
}

// ─── Inventory category metadata ───
// Used by /client/settings to manage the per-vertical category list and
// custom owner-added categories. Mirrors the inventoryCategories table.
export interface InventoryCategory {
  id: string;
  client_id: string;
  name: string;
  tracks_stock: boolean;
  display_order: number;
  created_at: string;
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
  // When true, hidden from the public/admin onboarding picker but still
  // resolvable for legacy rows (label/icon lookups still work). Used after
  // a vertical is merged into a broader one — existing bots keep working,
  // new bots can't pick the deprecated type.
  hidden?: boolean;
}
