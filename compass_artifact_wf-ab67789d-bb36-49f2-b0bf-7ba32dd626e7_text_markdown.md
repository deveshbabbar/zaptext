# ZapText — Onboarding Form Schema Research (8 Verticals)

> **Note to Devesh:** This is the consolidated research + spec deliverable. Each vertical has a full research report (sub-types, 30 customer Qs, competitor audit, real-business validation, TS schema, UX, compliance, edge cases) produced by 8 parallel subagents. Due to length, this top-level document focuses on **(a) executive summary per vertical with the TS schema delta**, **(b) cross-vertical pattern synthesis (the architecturally critical part)**, **(c) implementation order**, **(d) open questions**, **(e) login-walled gaps**. The full per-vertical reports (3000+ words each, with all 9 subsections, real-business validation, and inline citations) are stored as 8 sibling subagent outputs and are the source of truth for any field-level dispute.

---

## Part 1 — Per-vertical executive summaries

### 1. Restaurant / Cloud Kitchen / Cafe / Sweet Shop / Bakery

**Sub-types (20):** dine-in family, fine-dine, QSR, cloud-kitchen single-brand, cloud-kitchen multi-brand (Rebel/Charcoal Eats pattern), dhaba, food truck, sweet shop (mithai), bakery, eggless bakery, custom-cake studio, ice-cream parlour, juice bar, chai tapri, café, pure-veg, jain-only, halal-certified, regional-specialty, tiffin-attached.

**Top compliance gaps current form misses:** FSSAI license number + expiry + 30-July-2025 QR code rule, GSTIN, Halal cert + expiry, Jain certification, allergen disclosure (FSSAI 2020 menu-labelling — mandatory for >10-outlet chains), calories per item, packagingType compliance with 2025 plastic ban + barcode rule.

**Highest-priority new fields:**
```ts
interface RestaurantConfig extends CommonFields {
  vertical: 'restaurant';
  subType: RestaurantSubType;                    // 20 enum values
  serviceModes: ('dine_in'|'takeaway'|'delivery'|'cloud_kitchen_only')[];
  pureVeg: boolean;
  sharedKitchenWithNonVeg?: boolean;             // disclosure if pureVeg=false
  compliance: {
    fssaiLicenseNumber: string;                  // 14-digit, mandatory
    fssaiExpiryDate: string;
    fssaiQrCodeUrl?: string;                     // 30-Jul-2025 advisory
    gstin?: string;
    panNumber?: string;                          // Swiggy/Zomato onboarding
    halalCertified?: boolean;
    halalCertNumber?: string;
    halalCertExpiry?: string;
    jainCertified?: boolean;
  };
  menuCategories: MenuCategory[];                // items now include allergens[], containsEgg, isJainCompatible, caloriesKcal, weightVariants[], shelfLifeDays, aggregatorPriceOverride, availableDays, availableTimeWindow, gstSlab
  brands?: BrandFront[];                         // cloud-kitchen multi-brand
  chefSpecialsRotation?: DailyCatalogConfig;     // SHARED
  tableBooking?: { enabled: boolean; slots: SlotConfig; minPartySize, maxPartySize, advanceBookingDays, depositRequired? };
  serviceWindows?: { breakfast?, lunch?, snacks?, dinner?, lateNight? };
  happyHour?: { enabled, windows[], discountPercent?, note };
  deliveryPartners?: ('own_rider'|'zomato'|'swiggy'|'dunzo'|'shadowfax'|'borzo'|'porter'|'rapido'|'wefast'|'pidge')[];
  deliveryPartnersByDistance?: { upToKm; partner; charge }[];
  packagingCharges?: { perOrder?; perItem? };
  surgePricing?: { enabled; rainSurcharge?; peakHourSurcharge?; festivalSurcharge? };
  aggregatorListings?: AggregatorListing[];
  customCake?: CustomCakeConfig;                 // leadTimeHours, egglessAvailable, photoOnCake, advanceDepositPercent
  catering?: CateringConfig;                     // minPax (30-50 norm), liveCounters, weddingCateringSeparateContact
  iceCreamConfig?: { sellsTubs; tubSizesMl[]; sellsScoops; flavorOfTheDay[] };
  juiceConfig?: { fruitOfTheDay; coldPressedAvailable };
  mithaiConfig?: { weightUnits[]; festivalGiftBoxes[]; interstateShippingAvailable };
  festivalMenus?: FestivalMenu[];
  multiLocation?: MultiLocationConfig;           // SHARED
  tiffinSubscription?: RecurringConfig;          // SHARED
  staff?: StaffConfig;                           // SHARED — for fine-dine reservation host
  servesAlcohol?: boolean;                       // legal context only — bot MUST NOT promote
  alcoholLicenseNumber?: string;
  hookahLoungeFlag?: boolean;                    // bot must not promote (tobacco-equivalent)
  foodTruckMobileFssai?: boolean;
  bulkCorporateOrders?: { enabled; minPax; contactNumber; invoiceWithGstAvailable };
  noPreservativesClaim?: boolean;
  noMsgClaim?: boolean;
}
```

**Implementation note:** This is the most field-dense vertical alongside coaching. The `MenuItem` shape needs to handle 8 distinct sub-type variations cleanly. Full TS in subagent report includes complete enums.

---

### 2. Tiffin / Home-meal Subscription / Dabba / Mess

**Sub-types (15):** home-kitchen aunty, organised dabbawala-linked (SpiceBox/Dabbewale Babu/Mumbai Dabbawalas Kitchen), corporate B2B supplier, PG-mess contractor, gym/diet-meal (FoodDarzee/EatFit), Jain-only (HappyGrub), satvik no-onion-garlic, regional (Maharashtrian/Gujarati/South-Indian/Bengali), keto/diabetic/post-pregnancy, executive-lunch B2B (₹200+), multi-kitchen aggregator (TiffinStash/FoodiaQ/TiffiT/FoodyBuddy), pickup-only, festival catering offshoot, student-mess PG-attached, office-snack micro-tiffin.

**This vertical is the canonical template for `RecurringConfig` + `DailyCatalogConfig` + `TrialConfig`.**

**Highest-priority gaps fixed:** rotiCount per dabba (CRITICAL — Mom's Food Tiffin's plans differ ONLY by carb composition: 2-roti+rice vs 4-roti-no-rice), eggInclusionOption ('never'|'on-request'|'sunday-only'|'twice-weekly'), oilType + gheeUsed (top WhatsApp Q), skipBillingPolicy ('prorated-refund'|'rolled-over-to-next'|'forfeit'|'wallet-credit'), securityDeposit on tiffin-box, advanceBookingCutoff (TiffinStash: order before 9pm prev day), festivalOverrides (Navratri/Shravan/Paryushan), guestDabbaSameDay, midCyclePlanSwitch, deliveryHandoffPoint ('door'|'gate'|'pg-reception'), drinkingWaterIncluded, FSSAI tier (basic/state/central) — basic registration ₹100/yr <₹12L.

```ts
interface TiffinVerticalFields extends CommonFields {
  vertical: 'tiffin';
  ownerType: 'home-cook'|'commercial-kitchen'|'cloud-kitchen'|'mess-contractor'|'aggregator';
  cuisineStyle: ('north-indian'|'south-indian'|'maharashtrian'|'gujarati'|'punjabi'|'bengali'|'rajasthani'|'jain'|'satvik'|'multi-cuisine'|'continental'|'keto')[];
  plans: Array<{
    planId; name; duration; mealsCount; price; portionSize: 'mini'|'regular'|'big-belly'|'executive';
    foodType: 'veg'|'egg'|'non-veg'|'jain'|'satvik'|'mixed';
    rotiCount: number; rotiType: 'wheat-chapati'|'jowar-bhakri'|'bajra'|'phulka'|'paratha'|'mixed';
    riceIncluded; riceQuantityMl?; dalIncluded; sabziCount; saladPickleIncluded;
    sweetIncluded: 'never'|'daily'|'weekly'|'festival-only';
    drinkingWaterIncluded; includes[]; extraItemsMenu?: { item; price }[];
  }>;
  variants: { jainAvailable; noOnionGarlicAvailable; eggInclusionOption; nonVegSchedule?; diabeticPlan; ketoLowCarb; postPregnancyPlan };
  oilType: 'refined'|'filtered-groundnut'|'mustard'|'sunflower'|'olive'|'mixed';
  gheeUsed: 'none'|'desi-cow-ghee'|'buffalo-ghee'|'vanaspati'|'occasional';
  subscription: RecurringConfig;
  trial: TrialConfig;
  menu: DailyCatalogConfig;                       // weekly + festivalOverrides + cuisineRotation per day
  deliveryMode: ('home-delivery'|'office-delivery'|'pickup'|'pg-bulk-handover'|'dabbawala-network')[];
  deliveryHandoffPoint: 'door'|'gate'|'pg-reception'|'office-desk'|'flexible';
  container: { type: 'disposable-bio'|'disposable-plastic'|'steel-return'|'multi-tier-tiffin'|'customer-supplied'; deposit?: { amount; refundable }; plasticBanCompliant; microwaveSafe };
  customerCount?; capacityPerDay?;                // bot capacity check
  fssaiNumber: string; fssaiType: 'basic-registration'|'state-license'|'central-license';
  guestDabbaSameDay: { allowed; cutoffHours?; price? };
  midCyclePlanSwitch: { allowed; prorationRule };
  nonReturnedContainerPenalty?: number;
}
```

**Compliance flag:** if `variants.ketoLowCarb=true`, prompt owner: "Do you sell only cooked meals or also supplements/protein powders?" — supplements NOT allowed under WhatsApp Commerce Policy.

---

### 3. Salon / Spa / Mehendi / Tattoo / Wellness

**Sub-types (17):** unisex chain (Lakme/Naturals), women-only parlour, men's barber, premium men's grooming (Truefitt&Hill), home-service stylist, bridal makeup studio (Mehak Oberoi/Namrata Soni tier), mehendi studio, party makeup, hair-only, nail bar, tattoo+piercing, spa-general, ayurvedic spa (AYUSH ministry territory), wellness yoga/reiki, kids' salon, threading express, men's grooming subscription.

**This vertical is the richest consumer of `SlotConfig` (processing-time-aware double-booking, couple/group multi-resource lock, walk-in queue, peak surcharge) — should be the reference implementation.**

**Critical new fields:**
```ts
interface SalonConfig {
  vertical: 'salon';
  salonType: SalonType;                           // 17 enum
  genderServed: 'unisex'|'women_only'|'men_only';
  services: { category; items: { name; gender?; hairLength?; basePrice; seniorStylistPrice?; creativeDirectorPrice?; durationMins; processingTimeMins?; addOns?; brand?; productAuthenticityNote? }[] }[];
  packages: { name; type: 'bridal'|'party'|'regular'|'monsoon_offer'|'first_time'|'couple'|'sibling_combo'; includes[]; durationHours?; price; advanceBookingDays? }[];
  bridalPackages?: {
    bridal: { trialIncluded; trialMinDaysBefore?: 30; trialPrice; trialRefundedOnBooking };
    perEventPricing: { haldi?; mehendi?; sangeet?; wedding; reception?; cocktail? };  // multi-day breakdown
    bundleDiscountPercent?;
    outstation: { available; travelChargesPerKm?; stayChargedSeparately?; teamSize? };
  };
  mehendiConfig?: {
    bridalFlatRate?: number;                      // ₹3,100 – ₹51,000
    bridalIncludes: 'hands_only'|'hands_feet'|'hands_feet_arms_elbow';
    figuresExtraPerPair?: number;                 // ₹2,000 typical
    groomMehendiPrice?; perHandGuest?: number;    // ₹100–250
    arabicSimplePerHand?; teamSizeOptions?: number[];
    handlesPerArtistPerHour?: number;             // ~10
    organicHennaOnly?;
  };
  slotConfig: SlotConfig & { bookingRequired; walkInsAccepted; walkInQueueDigital?; advanceDepositPercent?; advanceDepositMinAmount?; peakSurcharge?: { diwaliWeek?; weekendUpliftPercent?; weddingSeasonMonths? }; weekendsBookedOutDays?; kidsHaircutDays?; womenOnlyHours? };
  staff: StaffConfig & { members: { name; role: 'creative_director'|'senior_stylist'|'junior_stylist'|...; perServiceUpcharge?; gender?; photo?; specialties?; availabilityOverride?; onLeaveDates? }[] };
  homeService: { available; radiusKm?; chargesPerKm?; flatHomeServiceCharge?; outstationAvailable?; outstationPickupDropCharges?; outstationStayBilledExtra?; kitHygieneSOP? };
  recurring?: RecurringConfig & { prepaidPacks?: { name; payAmount; walletValue; validityMonths }[]; membershipPlans?[]; loyaltyVisitMilestone?: { visits; reward }[] };
  policies: { cancellationHoursBefore: 24; cancellationFeePercent; noShowFee; bridalAdvanceRefundable; bridalRefundCutoffDays?: 60; consentFormRequired?: ('bridal'|'tattoo'|'piercing'|'chemical'|'extensions')[] };
  giftCards?: { enabled; redeemableOn: ('services'|'products'|'both')[]; minAmount?; expiryMonths? };
  compliance: { gstin?; beauticianRegistrationStateLicence?; ayushRegistered?; ayushLicenceNumber?; tattooStudioHealthLicence?; sterilizationSOP: 'autoclave_weekly_spore_test'|'single_use_only'|'none'; consumerRefundClauseVisible; medicalClaimsAvoided: true };
  privateClientNotes?: { enabled; fields: ('allergies'|'preferred_stylist'|'do_not_book'|'past_disputes')[] };
}
```

**Hard compliance gate:** if `salonType='spa_ayurvedic'` AND no AYUSH licence, bot must refuse therapeutic words ("cure"|"treatment"|"heal"|"therapy"). Tattoo+piercing requires age-18+ + consent form before booking.

---

### 4. Gym / Fitness Studio / Yoga / CrossFit / Pilates / Dance / MMA

**Sub-types (18):** full-service chain (Gold's/Anytime), neighbourhood gym, women-only (Pink Fitness/Contours), CrossFit box, yoga studio (Hatha/Ashtanga/Power/Vinyasa/Aerial/Yin), Iyengar lineage, Pilates reformer (Namrata Purohit), Zumba/dance, MMA/boxing, kickboxing, Kalaripayattu, multi-sport academy, kids' academy, senior yoga, prenatal/postnatal, EMS studio (Tecfit20), calisthenics park, functional studio (Cult-type), online coach.

**Critical gaps fixed:** registrationFee separated from monthly (Gold's/Anytime ₹500–₹2500 access card), peakAccess vs offPeak per plan, freezePolicy (Cult: 60 days for annual, with medical-cert unlimited exception), corporateTieUp partners (TCS/Infosys + Cult Pass Network/FITPASS/OnePass — three-tier aggregator field), staff certifications enum (ACE/NASM/REPS_India/K11/CrossFit_L1-L2/Yoga_Alliance_RYT200-500/Stott_Pilates/Polestar_Pilates/Zumba_ZIN/NSDC_SFSSC), womenOnlyTimings as SlotConfig array (not just bool), emsConfig with hard-coded `pacemakerExclusion: true`, dietPlan with mandatory disclaimer, liabilityWaiverUrls[], preExistingConditionDisclaimer for high-intensity, programs[] (90-day transformation, marathon prep — NO outcome guarantees per policy).

```ts
interface GymVerticalConfig {
  vertical: 'gym';
  subType: GymSubType;                            // 18 enum
  registrationFee: { amount; refundable; waivedInPromo; notes? };
  membershipPlans: { id; name; durationMonths; priceRupees; isCouple; isFamily; familyMaxMembers?; includes[]; excludes?[]; peakAccess; offPeakWindow?; accessibleLocations: 'home_only'|'all_branches'|'city'|'national' }[];
  freezePolicy: { enabled; maxDaysPerCycle: 60; minPlanDurationMonths; advanceNoticeDays; feeRupees?; medicalFreezeUnlimited };
  discounts: DiscountConfig & { couplePercent?; familyPercent?; corporatePartners: { employer; discountPercent; verificationRequired: 'email_domain'|'id_card'|'manual' }[]; referralRupees?; aggregatorPartners: ('FITPASS'|'Cultpass'|'OnePass'|'ClassPass')[] };
  staff: (StaffConfig & { certifications: GymCert[]; specialisations[]; gender; pricePerSession?; packagePricing?; noShowFeeRupees?; cancelWindowHours? })[];
  groupClasses: { classType; slots: SlotConfig[]; waitlistEnabled; bookingWindowHours; dropInPriceRupees?; packageOptions? }[];
  personalTraining: { available; pricePerSessionRupees?; packages?; onlineAvailable; femaleTrainerAvailable };
  trial: TrialConfig & { type: 'free'|'paid'|'open_day'; paidPriceRupees?; convertedDiscountPercent? };
  programs: { name; durationDays; priceRupees; cohortBased; nextStartDate?; medicalAssessmentIncluded }[];
  facilities: ('gym_floor'|'cardio_zone'|'free_weights'|'turf'|'pool'|'steam'|'sauna'|'shower'|'locker'|'wifi'|'cafe'|'parking_free'|'parking_paid'|'kids_play_area'|'physio_room'|'recovery_zone')[];
  equipment: string[];
  addOns: { lockerRentalRupees?; towelService?; dietPlanRupees?; bodyCompositionScanRupees? };
  womenOnly; womenOnlyTimings?: SlotConfig[]; petFriendlyHours?; prenatalAvailable; seniorAvailable; kidsAvailable; kidsAgeGroups?;
  emsConfig?: { suitFeeOneTimeRupees; maxSessionsPerWeek; pacemakerExclusion: true; sessionDurationMin: 20 };
  dayPassPriceRupees?; guestPolicy: 'allowed_paid'|'allowed_free_once'|'not_allowed';
  liabilityWaiverUrls: string[];
  preExistingConditionDisclaimer: boolean;
  medicalClearanceRequired: ('prenatal'|'senior'|'ems'|'crossfit')[];
  dietDisclaimerShown: boolean;                   // mandatory true if dietPlan exists
}
```

**Hard policy block:** content filter on templates rejecting "protein|whey|BCAA|creatine|mass-gainer|fat-burner|guaranteed transformation|lose X kg in Y days".

---

### 5. Coaching / Tutor / Test-Prep / Skill / Hobby

**Sub-types (23):** school-tuition primary/middle/board, JEE-Main, JEE-Advanced, NEET, CAT/MBA, UPSC/State PCS, SSC/Banking/Railway/Defence, CA/CS/CMA, GATE/PSU/ESE, CLAT/Law, NIFT/NID/CEED, foreign-language (CEFR-aligned), overseas test-prep (IELTS/TOEFL/SAT/GRE/GMAT/PTE), coding bootcamp adult (Masai/Scaler), coding kids, abacus/Vedic-math, chess (FIDE), music (Trinity/RSL/ABRSM grade), dance (Bharatnatyam/Kathak/Bollywood/Hip-hop), art/calligraphy, robotics/STEM, public-speaking/spoken-English.

**This is the most field-dense vertical (~40+ fields, 5-step onboarding mandatory).** Course-list builder is the heaviest UI — model on Shopify product variants with "add course → reuse template" pattern.

```ts
interface CoachingVerticalConfig {
  vertical: 'coaching';
  boardAffiliations: Board[];                     // CBSE|ICSE|IB|IGCSE|StateBoard_<state>|NIOS
  entranceExamsCovered: EntranceExam[];           // ~30 enum: JEE_MAIN, JEE_ADVANCED, NEET_UG, CAT, UPSC_CSE, CA_FOUNDATION, GATE, CLAT, NIFT, IELTS, ...
  regulatorRegistration?: {
    rajasthanCoachingAct?: { registered; regNo? };  // mandatory if >50 students in RJ
    aicteId?; ngoOrSocietyRegNo?;
  };
  coursesOffered: CoachingCourse[];               // see below
  faculty: StaffConfig[];                         // import from website URL — differentiator
  trial: TrialConfig & { rescheduleAllowed; maxRescheduleAttempts?; demoFacultyDifferentFromMain? };
  doubtClearing: SlotConfig & { trainerSeparate; onlinePortalUrl? };
  admissionProcess: {
    type: 'open'|'screening_test'|'interview'|'scholarship_test'|'merit_marks';
    scholarshipTestDetails?: { testName; scheduleDates[]; maxWaiverPct: 100; tiers?: { rankFrom; rankTo; waiverPct }[]; registrationFee?; registrationLink? };
    documentsRequired: string[];
  };
  pastResults: { examName; year; totalAppeared; totalCleared; topRank?; topRankerName?; notableAdmits?; proofUrl? }[];
  refundPolicy: {
    proRataRefund: boolean;                       // Raj Bill mandate within 10 days
    refundWindowDays: number;
    cancellationFeePct?;
    failureRepeatFree?;
    noPlacementRefundPct?;                        // bootcamps
    fullPolicyUrl?;
  };
  lateJoinPolicy?: { allowed; proRataApplied };
  emiDisclosure?: { partner: 'BajajFinserv'|'EduFund'|'GrayQuest'|'Propelld'|'Other'; agreementUrl? }[];  // mandatory if EMI link shared
  hostelPGReferral?: { offered; partnerNames?; monthlyRangeINR?; commissionDisclosed: boolean; referralLink? };  // truth-in-advertising
  studyMaterialMode: 'physical_only'|'digital_only'|'both'|'none_self_arrange';
  pyqAccess: boolean;
  mockTestSchedule?: { frequency; totalMocksPerCourse?; aiTSeriesIncluded? };
  parentTeacherMeet?: { frequency; mode };
  discounts: DiscountConfig & { siblingDiscountPct?; earlyBirdDiscountPct?; earlyBirdDeadline?; scholarshipBased?; referralBonus? };
  locations: MultiLocationConfig;
  recurringFees?: RecurringConfig;
  corporateTrainingArm?; overseaPrepAddon?;
  hobbyExtras?: { instrumentRental?; materialKitFee?; annualFunctionFee?; arangetramOrRecitalFee?; examFeeExternal? };
  // Compliance gates
  minorConsentCollected: boolean;                 // DPDPA Section 9 — verifiable parental consent for <18
  noFalseRankClaim: boolean;                      // Raj Bill prohibits guaranteed-rank ads
  maxClassHoursPerDay?: number;                   // Raj Bill cap: 5 hrs/day
}

interface CoachingCourse {
  id; name;
  category: 'school_tuition'|'board_prep'|'entrance_prep'|'skill'|'language'|'overseas_prep'|'hobby_music'|'hobby_dance'|'hobby_art'|'abacus_vedic'|'chess'|'robotics_stem'|'public_speaking'|'olympiad'|'other';
  targetAudience; targetClass?; ageBand?: { minAge; maxAge? };
  entranceExam?: EntranceExam[];
  duration: { value; unit: 'weeks'|'months'|'years' };
  fee: { amount; currency: 'INR'; gstIncluded; breakup?: { admission?; tuition; material?; tech? } };
  modes: ('offline'|'online_live'|'online_recorded'|'hybrid')[];
  schedule: { daysPerWeek; hoursPerDay; weekendBatch; morningEvening?; batchStartDate?; batchEndDate? };
  batchSize: { min; max };                        // Raj Bill: 1 sqm/student
  level?: 'beginner'|'intermediate'|'advanced'|'grade_1'|...|'grade_5';
  prerequisites?;
  facultyIds?: string[];
  recordedAccess?: { included; durationMonths? };
  certificate?: { issued; affiliatedTo? };        // Trinity, ABRSM, FIDE
  paymentOptions: {
    fullPayment;
    installments?: { count: number; firstDuePct };  // Raj Bill: min 4 EMIs
    emiPartners?: EmiPartner[];
    payAfterPlacement?;                           // ISA — bootcamps
    isaTermsUrl?;
  };
  placementGuarantee?: { offered; conditions?; partnerCount? };
}
```

**Hard compliance:** under-18 inquirer detection → bot routes to "share parent's WhatsApp number first" before storing data (DPDPA Section 9). Refuse rank-claim phrases ("guaranteed", "100% selection"). Block lump-sum fees in Rajasthan.

---

### 6. Real Estate Broker / Builder / PG-Coliving / Rental

**Sub-types (18):** solo broker rental, broker firm 5-50 agents, builder/developer (own projects), channel partner agency (multi-builder), commercial-only, NRI-focused, PG aggregator (Stanza/Zolo), co-living operator (Colive/CoHo), short-term rental/Airbnb operator, plot & land specialist, farmhouse/villa, luxury (>₹5Cr), industrial/warehouse, property-management firm, home-loan DSA, redevelopment specialist (Mumbai PAAA), resale-only, affordable PMAY DSA.

**This is the COMPLIANCE-HEAVIEST vertical** (RERA + WhatsApp + GST + DPDPA + FEMA + state stamp duty).

**Critical new fields:**
```ts
interface RealEstateBusiness extends CommonBusinessFields {
  vertical: 'realestate';
  subType: RealEstateSubType;
  legalDocs: {
    agentReraNumber: string;                      // MANDATORY for every sub-type except builder-only
    agentReraState: string; agentReraExpiry: string;
    ocAvailable; ccAvailable; encumbranceCertSupport;
    saleDeedDraftingSupport;
    khataAOrB?: 'A'|'B'|'na';                     // Bangalore-specific — B-Khata blocks bank loans
    conveyance?;
  };
  builderProjects: {                              // empty for pure resale
    id; name;
    reraNumber: string;                           // PER-PROJECT, not per-agent
    reraQrUrl?: string;                           // MahaRERA QR display rule 2024
    reraState; reraExpiryDate?: string;           // alert if <90d
    developerName; projectType: 'residential'|'commercial'|'mixed'|'plotted';
    possessionDate: string;                       // promised
    actualHandoverEstimate?;
    ocStatus: 'received'|'applied'|'pending'|'na_under_construction';
    ocDate?; ccStatus: 'received'|'partial'|'pending';
    totalUnits; totalTowers?;
    configurations: ConfigurationDetail[];        // matrix
    amenities: string[];                          // ~50 controlled vocab
    distancePOI: { type: 'school'|'metro'|'railway'|'airport'|'hospital'|'mall'|'it_park'|'highway'|'bus_stop'; name; distanceKm }[];
    gatedCommunity;
    societyMaintenance?: { perSqftPerMonth; corpus? };
    approvedByBanks: string[];
    brochureUrl?; walkthroughVideoUrl?; imageUrls[];
  }[];
  // Configurations — RERA mandatory triple disclosure
  // ConfigurationDetail: { config: '1RK'|'1BHK'|'2BHK'|...|'Penthouse'|'Plot'; carpetAreaSqft; reraCarpetAreaSqft; builtUpAreaSqft?; superBuiltUpAreaSqft?; loadingFactorPct?; totalPriceInr; pricePerSqftInr; priceBasis: 'carpet'|'rera_carpet'|'super_built_up'; parkingCount; parkingType; facing; vastuCompliant?; floorRange?; unitsAvailable; furnishingStatus? }
  rentalPolicy?: {
    cityDefaults: { BLR: 5-10; MUM: 1-6; DEL_NCR: 2-3; PUN: 2-6; HYD: 2-6; CHE: 2-6; OTHER: number };
    depositMonthsFlat?; lockInMonths: 11; noticePeriodMonths: 1|2;
    petsAllowed: 'yes'|'no'|'case_by_case';
    furnishingStatus: 'unfurnished'|'semi_furnished'|'fully_furnished';
    gender: 'any'|'male'|'female'|'family_only';
    tenantPreference: ('bachelor'|'family'|'working_pro'|'student'|'company_lease')[];
    agreementType: 'leave_and_licence'|'rent_agreement'|'company_lease';
    registrationByOwner;
  };
  pgColivingConfig?: {
    sharingTypes: ('1_share'|'2_share'|'3_share'|'4_share'|'private')[];
    genderPolicy: 'male'|'female'|'unisex'|'couples_ok';
    foodIncluded; mealsPerDay?: 0|1|2|3; foodType?;
    electricityBilling: 'included'|'submeter_actuals'|'flat_addon';
    exitFeeInr?: number;                          // Zolo: ₹2500+18% GST
    exitFeeWaiverMonths?; noticePeriodDays: 30;
    inAppMaintenance; groAvailable; amenitiesIncluded[];
  };
  nriSupport?: { countriesServed[]; currencyDisplay: ('INR'|'USD'|'AED'|'GBP'|'SGD')[]; poaSupportEnabled; videoSiteVisit; fcnrNreNroAdvisory; tdsAdvisoryOnly; repatriationAdvisoryOnly };
  redevelopmentExpertise?: { cityScope: ('MUM'|'PUN'|'DEL'|'OTHER')[]; paaaSupported; societyTypes: ('cooperative'|'mhada'|'cessed'|'slum_redev_sra')[]; fsiTdrAdvisory; transitRentNegotiation; corpusNegotiation; selfRedevAdvisory };
  homeLoanPartners: { bankName: 'SBI'|'HDFC'|'ICICI'|'Axis'|'Kotak'|'PNB'|'BOB'|'LIC_HF'|'Bajaj_HF'|'Tata_Cap'|'OTHER'; partnerType: 'tied_up'|'preferred'|'dsa_attached'; currentROI: { min; max; asOfDate }; processingFeePct?; maxTenureYears; salariedOk; selfEmployedOk; nriOk }[];
  brokerageStructure: {
    rentalBrokerage: { type: 'months_rent'; months: 0.5|1|2 } | { type: 'pct'; pct };
    salePurchaseBrokerage: { pctMin; pctMax; gstApplicable };
    builderBrokerage?: { pctOfDealValue };        // channel partner
    noBrokerageScheme?; brokerageNegotiable;
  };
  taxAndCharges: {
    gstApplicabilityHint: 'under_construction_affordable_1pct'|'under_construction_non_affordable_5pct'|'commercial_uc_12pct'|'ready_to_move_nil'|'rental_residential_nil'|'rental_commercial_18pct'|'st_rental_above_7500_12pct';
    stampDutyAdvisory: true; registrationChargeAdvisory: true;
    womenBuyerConcessionFlag; pmayClssEligibility?;
  };
  siteVisit: SlotConfig & { pickupSupportedKm?; cancellationFeeOutstation?; virtualTourEnabled; weekendHours? };
  staff: StaffConfig & { teamSize; commissionStructure: 'salary'|'commission_only'|'mixed'; rmAssigned };
  exclusiveOrCoBroking: 'exclusive'|'co_broking'|'both';
  vastuCompliance: { offered; consultantAvailable };
  importedFromUrl?: { source: '99acres'|'magicbricks'|'housing'|'manual'; url? };
}
```

**Hard compliance gate:** Bot must inject `agentReraNumber` + project RERA QR into every outbound WA template. Refuse to send if empty. Block phrases: "guaranteed return", "100% sure", "definitely double", "risk-free real estate".

---

### 7. E-commerce / D2C / Online Shop

**Sub-types (18):** fashion D2C bestseller-driven (Souled Store/Bewakoof), saree/kurta/ethnic (Suta/Taneira/Fabindia), beauty/skincare D2C (Mamaearth/Plum), gold/silver jewellery (BIS HUID mandatory), imitation jewellery, home decor, electronics reseller, books/stationery, kids' toys+clothing, packaged food (FSSAI), gifting/hampers, custom-print on demand (no-return), handloom/handicraft GI-tagged, Instagram-only seller, Shopify/WooCommerce store, subscription-box D2C consumables, B2B/wholesale-only, dropshipper/multi-marketplace.

**This vertical drives `DiscountConfig` design — 8 distinct discount types (codes/BOGO/buy2get1/freegift/tier/festive/bulk/first-order).**

```ts
type EcommerceVerticalConfig = {
  vertical: 'ecommerce';
  storefront: { type: 'shopify'|'woocommerce'|'dukaan'|'mydukaan'|'instagram_only'|'meesho_reseller'|'multi_marketplace'|'none'; websiteUrl?; shopifyDomain?; instagramHandle?; acceptsDMOrders };
  marketplacePresence: { channel: 'amazon'|'flipkart'|'meesho'|'myntra'|'ajio'|'nykaa'|'jiomart'; sellerUrl?; crossPlatformSKU?; priceVariesByChannel? }[];
  products: {
    sku; name; description; category; basePrice; mrp?; bestseller; inStock; imageUrl; sizeChartUrl?;
    variants: { variantId; attributes: { size?; color?; material?; storage?; weight?; flavor? }; price; mrp?; inventory; barcode?; imageUrl? }[];
    countryOfOrigin: string;                      // E-com Rules 2020 mandatory
    manufacturer?; importer?;
    certifications?: {
      bisHallmark?: { huid; purityCarat: 14|18|22|24 };  // jewellery mandatory since 1 Apr 2023
      bisISI?;                                    // electronics/helmets/toys
      fssaiNumber?;                               // food
      handloomMark?; giTag?;                      // GI Act 1999 — false claim is criminal
      madeSafe?; crueltyFree?; vegan?; ecoFriendly?; madeInIndia?;
    };
    legalMetrology?: { netQuantity?; mfgDate?; expiryDate?; batchId? };
    warranty?: { months; type: 'manufacturer'|'seller'|'replacement_only'|'none'; serviceCenterUrl?; warrantyCardRequired };
    careInstructions?; fragile?; sampleAvailable?; subscriptionEligible?;
  }[];
  multiLocation?: MultiLocationConfig & { warehouses: { id; pincode; servesRegion[] }[] };
  discounts: DiscountConfig & {
    codes: { code: string; type: 'flat'|'percent'|'bogo'|'buy2get1'|'freegift'|'tier'; value?; minOrderValue?; maxDiscount?; categoryRestriction?; validFrom; validTo; firstOrderOnly?; stackable? }[];
    bulkTiers?: { minQty; discountPercent }[];
    festivalCountdown?: { name; endsAt };
    freeGiftAbove?: { threshold; giftSku };
  };
  recurringProducts?: RecurringConfig & { skus[]; intervals: ('15d'|'30d'|'45d'|'60d')[]; pauseAllowed; skipAllowed };
  trials?: TrialConfig & { firstOrderDiscountPercent? };
  shipping: { courierPartners: ('shiprocket'|'delhivery'|'bluedart'|'ecomexpress'|'dtdc'|'xpressbees'|'shadowfax'|'indiaPost'|'own')[]; primaryCourier?; shippingCharges; freeShippingAbove; deliveryTimeline: { metro; tier2; tier3; northeast }; serviceableAreas; internationalShipping; fragilePackagingExtra?; festivalPackagingExtra? };
  pincodeCODPolicy: {
    codAvailable; codCharges;
    codMinOrder?;                                 // "COD only above ₹500"
    codMaxOrder?;
    codVerificationCall: boolean;                 // reduces RTO 30% per GoKwik
    prepaidOnlyPincodes: string[];                // RTO buffer (tier-3 RTO up to 40%)
    rtoBufferDays;
    codToPrepaidNudgeDiscount?;                   // %
    partialCODEnabled?;
  };
  returnPolicy: {
    enabled; windowDays: 0|3|7|10|15|30;
    returnReasons: ('damaged'|'defective'|'wrong_product'|'size_issue'|'quality'|'changed_mind')[];
    requirePhotoEvidence: boolean;                // Mamaearth pattern — beauty/food
    requireBatchId: boolean;
    nonReturnableCategories?;                     // sale, custom-print, innerwear
    refundMode: 'original_payment'|'store_credit'|'wallet_points'|'choice';   // Souled Store: TSS Money store-credit
    reversePickupServiceable: 'all'|'most'|string[];
    reversePickupCharge?;
    selfShipFallback?: { allowedCarriers; reimbursement };
  };
  exchangePolicy: { enabled; windowDays; sizeOnly: boolean; crossCategoryAllowed; priceDifferencePayable; maxExchangesPerOrder: 1|2|-1 };
  b2bWholesale?: { enabled; moqPieces; bulkPricing[]; gstInvoiceMandatory; deliveryChallan; netPaymentTerms?: 'advance'|'net15'|'net30' };
  giftOptions: { giftWrap; giftWrapCharge; giftMessage; giftMessageMaxChars: 50|100|200; scheduledDelivery; hideInvoice };
  loyalty?: { enabled; walletPointName: string;   // "TSS Money", "Mama Coins"
    pointsPerRupee; redemptionRatio; referralReward; tiers? };
  abandonedCart: { enabled; sequence: { delayMinutes; messageTemplate; discountCode? }[] };  // 1h/24h/7d
  orderTracking: { trackingLinkTemplate; realTimeUpdates; deliveredFeedbackPrompt };
  compliance: {
    gstNumber: string;                            // mandatory regardless of turnover (TCS rule)
    panNumber?;
    grievanceOfficer: { name; email; phone };     // E-com Rules 2020 mandate
    nodalOfficer?;
    countryOfOriginDisplayed: true;
    privacyPolicyUrl: string;                     // DPDPA
    abandonedCartConsent: boolean;                // DPDPA opt-in
    dpdpaConsentText?;
  };
  currentOffers?;
};
```

**Hard policy block — prohibited categories validation at catalog upload:** alcohol, tobacco/e-cig/hookah/pan-masala, illegal/recreational drugs, prescription drugs, ingestible supplements (protein/whey/multivitamins/nutraceuticals/ayurveda churan-kadha — explicit block, frequently misclassified by sellers), real-money gambling, weapons, live animals, adult sexual products, body parts, counterfeit, cryptocurrency/NFT, digital subscriptions, medical devices (without manufacturer exception), recalled products, ungated wildlife.

---

### 8. Grocery / Vegetables / Fruits / Dairy / Bakery (daily-fresh) / Kirana / Meat-Fish-Poultry / Organic

**Sub-types (16):** local kirana, sabziwala/vegetable cart, fruit shop, dairy shop, milk-only delivery (Country Delight model), daily-fresh bakery, meat shop, fish market, poultry/egg shop, aata chakki, organic store (NPOP-certified), supermarket franchise, sweet shop daily-fresh angle, masala/spice custom-grind, dry-fruits shop, pickle/papad home-business.

**This vertical is the SECOND template (after tiffin) for `DailyCatalogConfig`** — but with `mode: 'daily-mandi'` (unpredictable rotation) vs tiffin's `mode: 'weekly-rotating'`.

**Critical insight: current form captures ~15% of what real businesses need.** Sabziwala/kirana owners are LEAST tech-savvy of all 8 verticals. The KEY UX bet is the "today's list" textarea + paste parser.

```ts
interface GroceryFormSchema {
  vertical: 'grocery';
  fssaiLicense: { number: string; type: 'basic'|'state'|'central' };  // mandatory
  legalMetrologyRegNumber?: string;                                    // packaged retailers
  shopActLicense?: string;
  subType: 'kirana'|'sabziwala'|'fruit'|'dairy'|'milk-only'|'bakery'|'meat'|'fish'|'poultry'|'aata-chakki'|'organic'|'supermarket'|'sweet-daily'|'masala'|'dryfruit'|'pickle-home';
  catalogMode: DailyCatalogConfig;                                     // SHARED with tiffin/restaurant — see §Part 2
  staticCatalog?: GroceryProduct[];                                    // for kirana, organic
  dailyCatalogTextarea?: string;                                       // PASTE-PARSE: "tomato 40, onion 30, lemon 5/piece"
  parsedDailyProducts?: GroceryProduct[];                              // server-derived
  dailyCatalogCutoffTime?: string;                                     // "16:00" — book by 4pm for evening
  eveningMarketRunSupported?: boolean;
  defaultPricingTier: 'retail'|'wholesale'|'both';
  wholesaleQualifier?: { minOrderValue?; minWeightKg? };
  slots: SlotConfig;
  zones: { zoneName; pincodes[]; societies?; deliveryFee; minimumOrder; buildingHandoff: 'door'|'gate'|'concierge'|'guard'|'customer-choice'; guardHandoffPhotoProof? }[];
  multiLocation?: MultiLocationConfig;
  recurring: RecurringConfig;                                          // daily milk, weekly veg, monthly kirana
  recurringTemplates?: { name; items: { productId; qty; unit; frequency }[] }[];
  coldChainSupport: boolean;
  freshnessDefaultTag?: 'made-this-morning'|'today-catch'|'baked-today'|'cut-fresh'|'mandi-today'|'frozen';
  scaleToleranceDefault?: { plusMinusGrams };
  substitutionPolicy: 'auto-substitute'|'ask-customer'|'cancel-line-item'|'cancel-order';
  paymentCollection: { upiAtDoor; upiVPA?; cashAtDoor; cashChangeAvailableUpto?; udhaarAllowedForRegulars?; prepaidOnly? };
  returnPolicy: { acceptsReturn; windowHours: 6|24; proofRequired: 'photo'|'video'|'none'; refundMode: 'replace-next-delivery'|'wallet-credit'|'refund-original'|'shopkeeper-discretion'; excludedItems? };
  festivalBundles?: FestivalBundle[];
  discounts?: DiscountConfig;
  aattaChakki?: { byoGrainAllowed; grindingFeePerKg: 4-8; shopOwnGrainAvailable; customBlends?; minGrindKg? };
  organicCert?: { body: 'NPOP'|'India-Organic'|'Jaivik-Bharat'|'PGS-India'; certNumber; expiry };
  meatLicense?: { slaughterhouseCert?; halalCert?; jhatkaCert? };
  emergencyContactSurcharge?: { applicable; flatFee? };
}

interface GroceryProduct {
  id; nameEn; nameHi?;                                                 // "Tamatar"
  category: 'veg'|'fruit'|'dairy'|'bakery'|'meat'|'fish'|'poultry'|'staple'|'spice'|'dryfruit'|'organic'|'pickle';
  pricing: { unit: 'kg'|'500g'|'250g'|'100g'|'piece'|'dozen'|'bunch'|'litre'|'500ml'|'packet'; price; wholesalePrice?; wholesaleMinQty?; mrpLocked? }[];  // SHARED `UnitPricing` — also used by mithai + custom-cake
  organicFlag?; organicCertNumber?;                                    // false claim = consumer fraud
  grade?: 'A'|'B'|'export'|'regular'|'premium';
  freshnessTag?; freshnessDate?;                                       // ISO; cut/caught/baked-at
  shelfLifeHours?: number;                                             // dairy 24h, fish 18h
  scaleTolerance?: { plusMinusGrams };                                 // ±50 fish, ±20 veg
  dressedWeightFactor?: number;                                        // 0.6 = whole→cleaned
  cutType?: 'curry-cut'|'keema'|'breast'|'whole';
  halalFlag?; jhatkaFlag?;
  seasonalFrom?; seasonalTo?;
  substitutes?: string[];                                              // tomato → cherry-tomato
}
```

**WhatsApp Commerce Policy traps for grocery:** organic shops MUST NOT sell ashwagandha/spirulina/protein supplements via bot; kirana MUST NOT list tobacco/pan-masala/gutkha; alcohol off-license sales blocked; live animals/fish (alive) blocked.

---

## Part 2 — Cross-vertical patterns (architecturally critical)

This is the most important section for engineering. **Build these once in `lib/types/shared.ts`. Don't duplicate.**

### Pattern A — `SlotConfig` (booking primitive)

**Used by:** restaurant (table reservation), tiffin (delivery slot), salon (appointment — RICHEST consumer), gym (group class), coaching (demo + doubt-clearing), realestate (site visit — RICHEST commission/travel layer), grocery (delivery slot). 7/8 verticals.

**Reference implementation should be salon's** — it exercises every edge: processing-time-aware double-booking (color while stylist moves), multi-resource lock (couple package = 2 chairs), walk-in queue overlay, peak surcharge, women-only-hours, leave auto-reroute. Real estate adds `pickupSupportedKm` + `outstationCancellationFee`.

```ts
interface SlotConfig {
  slots: {
    name?: 'breakfast'|'lunch'|'dinner'|'snack'|'morning'|'evening'|'custom';
    day: Weekday;                                  // recurring weekly
    startTime: string; endTime: string;            // "12:00", "15:00"
    capacity?: number;                             // group class size, table covers, dabbas
    staffId?: string;                              // links to StaffConfig.members[]
    resourceIds?: string[];                        // chairs, courts, rooms — multi-resource lock
    bookingCutoff?: { rule: 'same-day'|'prev-day'|'hours-before'; hoursBefore?: number };
    advanceBookingDays?: number;
    waitlistEnabled?: boolean;
    bookingDeposit?: { required: boolean; amount?: number; percentOfPrice?: number };
    processingTimeMins?: number;                   // salon color, restaurant cooking — staff freed during this
    peakSurcharge?: { enabled: boolean; uplift: number; appliesTo?: Weekday[] | DateRange[] };
  }[];
  walkInsAccepted?: boolean;
  walkInQueueDigital?: boolean;
  // vertical extensions go in vertical-specific layer (siteVisit.pickupSupportedKm etc.)
}
```

### Pattern B — `StaffConfig` (the person-who-delivers-the-service primitive)

**Used by:** salon (stylist with senior/junior tier), gym (trainer with cert + per-session pricing), coaching (faculty with subject + experience), realestate (broker team with commission structure), restaurant (fine-dine reservation host — light usage), tiffin (rare — single owner mostly). 6/8 verticals.

```ts
interface StaffConfig {
  members: {
    id: string;
    name: string;
    role: string;                                  // vertical-specific enum lifted into discriminated union per vertical
    gender?: 'M'|'F'|'NB';
    photo?: string;                                // optional, off by default for women-only parlours (privacy)
    experience?: { years: number; almaMater?: string; pastAffiliations?: string[] };
    certifications?: string[];                     // gym: ACE/NASM/REPS_India; coaching: subject expertise; salon: brand training
    specialties?: string[];                        // bridal, prenatal, JEE-Physics, aerial-yoga
    subject?: string;                              // coaching-specific
    pricing?:                                      // salon tier upcharge | gym per-session | coaching faculty fee delta
      | { type: 'tier_upcharge'; perServiceUpcharge: number }
      | { type: 'percent_uplift'; pct: number }
      | { type: 'per_session'; pricePerSession: number; packagePricing?: { sessions; price; validityDays }[] }
      | { type: 'commission'; commissionStructure: 'salary'|'commission_only'|'mixed'; rmAssigned?: boolean };
    availabilityOverride?: { date: string; available: boolean }[];
    onLeaveDates?: string[];                        // auto-reroute trigger
    noShowFeeRupees?: number;
    cancelWindowHours?: number;
    backgroundVerification?: { status: 'verified'|'pending'|'na'; date? };  // Raj Bill mandate for coaching
    agentReraNumber?: string;                      // realestate-specific compliance attribution
  }[];
  teamSize: number;
}
```

### Pattern C — `RecurringConfig` (subscription billing primitive)

**Tiffin is canonical template.** Used by: tiffin (monthly/weekly), grocery (weekly veg basket, daily milk), salon (membership/prepaid pack), gym (monthly membership renewal), coaching (monthly tuition / EMI), ecommerce (D2C consumable subscription — Sleepy Owl coffee, Bombay Shaving blade refill). 6/8 verticals.

```ts
interface RecurringConfig {
  enabled: boolean;
  cycle: 'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'custom-days';
  durationDays?: number;                          // for custom
  paymentMode: 'prepaid-wallet'|'monthly-postpaid'|'daily-cash'|'weekly-prepaid';
  pauseAllowed: boolean;
  pauseMinNoticeHours: number;                    // e.g. 12 = order before 9pm prev day (TiffinStash)
  maxSkipsPerCycle?: number;
  skipBillingPolicy: 'prorated-refund'|'rolled-over-to-next'|'forfeit'|'wallet-credit';
  modifyCutoff?: string;                          // "23:59" — Country Delight midnight pattern
  autoRenew: boolean;
  gracePeriodDays?: number;                       // gym dunning
  cancellationNoticeDays: number;
  securityDeposit?: { amount; refundable; itemDescription };  // tiffin box / milk crate
  gstApplicable?: boolean;
  // ecom-specific extension lives in vertical layer:
  // recurringProducts?: { skus[]; intervals: ('15d'|'30d'|'45d'|'60d')[] }
}
```

### Pattern D — `DailyCatalogConfig` (rotating-menu primitive)

**Two canonical templates: tiffin (predictable weekly rotation) + grocery (unpredictable daily mandi).** Used by: tiffin (weekly menu + festival overrides), grocery (daily-mandi sabzi/fish + seasonal fruit), restaurant (chef specials rotation + festival menus), bakery (daily-bake sellOutBy), juice bar (fruit-of-the-day). 4/8 verticals.

```ts
type DailyCatalogConfig =
  | { mode: 'weekly-rotating';                    // tiffin
      weekPlan: Record<Weekday, { items: string[]; foodType: string; isWeeklyOff?: boolean }>;
      cuisineRotation?: { day: Weekday; cuisine: string }[];
      festivalOverrides: { festival; customName?; dateRange: { start; end }; menuOverride: string[]; priceDelta?; isMandatory: boolean }[];
      dailyChoiceCutoffHours?: number;
    }
  | { mode: 'daily-mandi';                        // sabzi, fish
      cutoffTime: string;                         // "09:00" or "16:00"
      pasteParser: boolean;                       // accept paste-from-WhatsApp textarea
      eveningRunSupported?: boolean;
      sellOutByTime?: string;                     // fish "14:00"
    }
  | { mode: 'seasonal';                           // fruit, festival menu
      seasonalRules: { from: string; to: string; productIds: string[]; priceMultiplier?: number }[];
    }
  | { mode: 'static' };                            // kirana, restaurant base menu
```

### Pattern E — `TrialConfig` (first-taste primitive)

Universal: gym (free trial class), tiffin (single-dabba ₹169), coaching (demo class), salon (bridal trial, free consultation), restaurant (first-order discount), ecommerce (sample / first-order discount), realestate (free property consultation). 7/8 verticals.

```ts
interface TrialConfig {
  available: boolean;
  type: 'free'|'paid'|'open_day'|'sample'|'single-dabba'|'demo-class'|'first-visit-discount';
  durationDays?: number;
  durationSessions?: number;
  price: number;                                  // 0 if free
  restrictions?: string;                          // "first-timer only", "valid ID required"
  rescheduleAllowed?: boolean;
  maxRescheduleAttempts?: number;
  convertedDiscountPercent?: number;              // discount if trial → paid in N days
  conversionWindowDays?: number;
  refundIfDissatisfied?: boolean;
  // realestate extension: freeConsultationMins
  // salon extension: trialMinDaysBefore (bridal trial 30 days)
}
```

### Pattern F — `MultiLocationConfig`

Used by: restaurant chains (Tunday Kababi 6 outlets), salon chains (Lakme/Naturals), gym chains (Cult.fit/Anytime), coaching (Allen 24 RJ + 100 nationally), realestate (multi-city broker — per-city RERA + brokerage), ecommerce (multi-warehouse), grocery (supermarket franchise). All 8 verticals.

```ts
interface MultiLocationConfig {
  mode: 'physical'|'online'|'hybrid';
  branches: {
    id: string;
    name: string;
    address: string;
    pincode: string;
    city: string;
    state: string;
    contactNumber?: string;
    managerName?: string;
    workingHours?: { open; close; weeklyOff? };
    servesPincodes?: string[];                    // ecom warehouse
    menuOverride?: any;                           // restaurant per-outlet menu
    staffIds?: string[];                          // coaching faculty per-center
    inventoryOverride?: any;                      // ecom per-warehouse stock
    // realestate extensions — city has own RERA + deposit/stamp-duty defaults
    cityComplianceOverride?: { agentReraNumber?; depositMonthsDefault?; stampDutyPct? };
  }[];
}
```

### Pattern G — `DiscountConfig` (universal pattern, ecom is heaviest user)

```ts
interface DiscountConfig {
  firstTime?: { type: 'percent'|'flat'; value: number; minOrder?: number };
  sibling?: number;                                // %
  couple?: { percent?: number; bundleDiscountPercent?: number };
  family?: { percent?: number; maxMembers?: number };
  corporate?: { partners: { employer; discountPercent; verificationRequired: 'email_domain'|'id_card'|'manual' }[] };
  referral?: { type: 'flat'|'wallet_credit'; amount: number };
  student?: number;
  senior?: number;
  earlyBird?: { discountPercent: number; deadline: string };
  scholarshipBased?: boolean;                      // coaching tiers
  monsoonOffer?: { months: string[]; percent: number };
  festive?: { festival; startDate; endDate; percent }[];
  loyaltyVisitMilestone?: { visits; reward }[];   // 10th visit free
  // ecom-heavy extensions:
  codes?: { code; type: 'flat'|'percent'|'bogo'|'buy2get1'|'freegift'|'tier'; value?; minOrderValue?; maxDiscount?; categoryRestriction?; validFrom; validTo; firstOrderOnly?; stackable? }[];
  bulkTiers?: { minQty; discountPercent }[];      // wholesale tiers
  festivalCountdown?: { name; endsAt };
  freeGiftAbove?: { threshold; giftSku };
  // realestate extensions:
  noBrokerage?: boolean;
  preLaunchDiscount?: { percent };
  subvention?: { percent: 10 | 20 };               // 10:90 or 20:80 — bot must clarify NOT interest waiver
  pmayClss?: boolean;
}
```

**Build hint:** `DiscountConfig` should be a single struct with optional fields (not a discriminated union). Ecom uses 80% of fields; coaching uses ~30%; restaurant uses ~20%. Optionality is fine.

### Pattern H (NEW, surfaced by research) — `ComplianceFields` shared shape

Originally vertical-specific, but this research shows it should be a **discriminated union by vertical** with a shared base.

```ts
interface BaseCompliance {
  gstin?: string;
  panNumber?: string;
  shopActLicense?: string;
  consentText?: string;                            // DPDPA opt-in
  privacyPolicyUrl?: string;
  grievanceOfficer?: { name; email; phone };       // E-com Rules 2020 + DPDPA
}

type RestaurantCompliance = BaseCompliance & { fssaiLicenseNumber: string; fssaiExpiryDate; fssaiQrCodeUrl?; halalCertified?; halalCertNumber?; halalCertExpiry?; jainCertified?; alcoholLicenseNumber? };
type TiffinCompliance = BaseCompliance & { fssaiNumber: string; fssaiType };
type SalonCompliance = BaseCompliance & { beauticianRegistrationStateLicence?; ayushRegistered?; ayushLicenceNumber?; tattooStudioHealthLicence?; sterilizationSOP?; medicalClaimsAvoided: true };
type GymCompliance = BaseCompliance & { liabilityWaiverUrls: string[]; preExistingConditionDisclaimer; medicalClearanceRequired: ('prenatal'|'senior'|'ems'|'crossfit')[]; dietDisclaimerShown };
type CoachingCompliance = BaseCompliance & { regulatorRegistration?; minorConsentCollected: boolean; noFalseRankClaim: boolean; maxClassHoursPerDay?; emiDisclosure?[] };
type RealEstateCompliance = BaseCompliance & { agentReraNumber: string; agentReraState; agentReraExpiry; ocAvailable; ccAvailable; encumbranceCertSupport; saleDeedDraftingSupport };
type EcommerceCompliance = BaseCompliance & { gstNumber: string; countryOfOriginDisplayed: true; abandonedCartConsent: boolean };
type GroceryCompliance = BaseCompliance & { fssaiLicense: { number; type }; legalMetrologyRegNumber?; organicCert?; meatLicense? };
```

### Patterns NOT to generalize (vertical-locked)

- **Variant matrix (size × color × storage × material)** — ecommerce-only. Salon services aren't 2D-matrices; gym memberships are 1D tiers; tiffin meal-plans aren't variants.
- **Pincode-based COD policy** — ecom-only. Tiffin's "delivery zones" overlap faintly but doesn't do COD risk scoring.
- **Abandoned cart sequence** — ecom-only. Salon "no-show reminder" is structurally similar but conceptually different.
- **EMS pacemaker exclusion** — gym sub-vertical only.
- **PAAA (Permanent Alternate Accommodation Agreement)** — Mumbai redevelopment only.
- **Mehendi per-hand pricing + team-size-per-event** — salon mehendi sub-type only.
- **Hostel/PG referral commission disclosure** — coaching (Kota model) only.
- **`AggregatorListing[]`** pattern (Zomato/Swiggy/MagicBricks/FITPASS/Cultpass/Amazon-Flipkart-Meesho-Myntra) — same shape across restaurant/realestate/gym/ecom but the platform enum is vertical-locked. Build as generic with platform-enum-per-vertical.

### NEW shared primitive surfaced — `UnitPricing` (kg/piece/bunch)

Lift to shared. Used by grocery (every product), restaurant mithai (₹/kg + ₹/250g + ₹/500g + ₹/1kg), bakery custom-cake (₹/kg + ₹/inch), sweet-shop daily-fresh.

```ts
interface UnitPricing {
  unit: 'kg'|'500g'|'250g'|'100g'|'piece'|'dozen'|'bunch'|'litre'|'500ml'|'packet'|'inch';
  price: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  mrpLocked?: boolean;
}
```

### NEW shared primitive — `PaymentCollectionConfig`

ZapText doesn't process payments. Every vertical needs same shape: UPI VPA + cash + payment-link partner. Promote to shared.

```ts
interface PaymentCollectionConfig {
  upiVPA?: string;                                // shopkeeper VPA, shown in WA reply
  upiAtDoor?: boolean;                            // grocery/tiffin
  cashAtDoor?: boolean;
  cashChangeAvailableUpto?: number;               // grocery — flags ₹2000 note no change
  udhaarAllowedForRegulars?: boolean;             // kirana credit ledger
  prepaidOnly?: boolean;                          // organic shops, premium gyms
  paymentLinkPartner?: 'razorpay'|'shopify'|'cashfree'|'phonepe'|'paytm'|'manual_upi';
  emiPartners?: ('BajajFinserv'|'EduFund'|'GrayQuest'|'Propelld'|'Other')[];  // coaching
  emiAgreementUrl?: string;                       // RBI Digital Lending Guidelines disclosure
}
```

### NEW shared primitive — `PrivateClientNotes`

Salon (allergies, do-not-book), restaurant (allergies, VIP), tiffin (food restrictions), realestate (broker notes). Same encryption + never-broadcast invariant.

```ts
interface PrivateClientNotes {
  enabled: boolean;
  fields: ('allergies'|'preferred_stylist'|'do_not_book'|'past_disputes'|'food_restrictions'|'broker_internal')[];
  purgeAfterDays?: number;                        // DPDPA data minimisation default 30
  consentRequired: true;
}
```

### Architecture recommendation

```
lib/types/
  shared.ts            — SlotConfig, StaffConfig, RecurringConfig, DailyCatalogConfig,
                         TrialConfig, MultiLocationConfig, DiscountConfig, UnitPricing,
                         PaymentCollectionConfig, PrivateClientNotes
  compliance.ts        — BaseCompliance + 8 vertical-specific extensions (discriminated union)
  vertical/
    restaurant.ts      — RestaurantConfig extends CommonFields
    tiffin.ts          — TiffinVerticalFields extends CommonFields
    salon.ts           — SalonConfig extends CommonFields
    gym.ts             — GymVerticalConfig extends CommonFields
    coaching.ts        — CoachingVerticalConfig extends CommonFields
    realestate.ts      — RealEstateBusiness extends CommonBusinessFields
    ecommerce.ts       — EcommerceVerticalConfig extends CommonFields
    grocery.ts         — GroceryFormSchema extends CommonFields
  index.ts             — type ClientConfig = RestaurantConfig | TiffinVerticalFields | ... (discriminated by `vertical`)
```

**Don't over-abstract.** Tiffin should ship as v1 of `RecurringConfig` + `DailyCatalogConfig`; grocery exercises `daily-mandi` mode + `UnitPricing` array. Stress-test for 2-3 weeks of real merchant data before locking the shared interface contract.

---

## Part 3 — Implementation order (recommended)

Ranking by (a) likely Indian SMB sales volume, (b) current form quality gap, (c) competitor pressure / moat opportunity. Higher rank = redesign first.

| Rank | Vertical | Sales volume | Quality gap | Competitor pressure | Reasoning |
|---|---|---|---|---|---|
| **1** | **Tiffin** | High (1L+ home tiffin operators in tier-1/2) | Medium (current form decent base, missing 6 critical fields) | LOW (no native WhatsApp competitor — TiffinCRM is desktop) | **Best wedge.** Owners are non-technical, on-WhatsApp natively, willing to pay ₹599. Locks `RecurringConfig` + `DailyCatalogConfig` for free. Unit economics work. Build first. |
| **2** | **Grocery / kirana / sabziwala** | Massive (12M+ kirana stores in India) but heterogeneous | Severe (current form is 15% complete) | LOW for SMB tier (BigBasket/Otipy don't serve sabziwalas) | Highest TAM, lowest tech-savviness. The "today's list" textarea + paste parser is a category-defining UX bet. Validates `DailyCatalogConfig.mode='daily-mandi'`. |
| **3** | **Restaurant / Cloud kitchen / Cafe** | High volume + high willingness-to-pay | Medium (current form OK but missing FSSAI/halal/jain/cloud-kitchen-multi-brand) | HIGH (Petpooja/Limetray well-funded, but they're POS-first, not WA-first) | Premium tier (₹1499/₹3999) most likely to convert here. FSSAI compliance auto-handling = clear differentiator vs Wati/AiSensy generic templates. |
| **4** | **Salon / Spa / Mehendi** | High (4L+ salons + parlours in India) | Medium-high (current form misses bridal, mehendi, prepaid-pack, peak surcharge) | HIGH (Zenoti/MioSalon mature in India but enterprise-priced) | Owners are non-technical (matches ZapText positioning). SlotConfig reference implementation. Mehendi sub-type is uniquely Indian — moat. |
| **5** | **Coaching / Tuition** | Massive but field-dense | Severe (current form missing scholarship test, EMI, hostel referral, refund policy, regulator registration) | HIGH (Classplus/Meritto/NoPaperForms enterprise-priced; AiSensy education is shallow) | Largest market (₹58,000 Cr). 5-step onboarding mandatory. **Compliance moat**: Rajasthan Coaching Bill + DPDPA minor consent are hard moats vs generic competitors. Build only after `StaffConfig` template is locked from salon. |
| **6** | **Gym / Fitness / Yoga** | Medium-high | Medium (current form lacks freeze, registration fee, peak/off-peak, women-only timings, EMS, certifications) | Medium (Cult.fit B2B disrupts at distribution layer; Mindbody/Zenoti enterprise) | Owners moderately tech-savvy; high churn / freeze policies are the biggest support cost the bot must absorb. Diet-plan + supplement compliance is sensitive. |
| **7** | **E-commerce / D2C** | Medium (Shopify+Insta D2C scene fragmented) | Medium-low (current form decent base, needs heavy variant + return + COD work) | VERY HIGH (Interakt/AiSensy/Bik/Shiprocket Engage/GoKwik all compete heavily) | **Toughest competitive pressure** — saturated. ZapText's wedge: serves Insta-only seller (Suta-style refuses DM, but 90% of small Insta sellers accept). Build last among scaled verticals; differentiate via "import from Shopify/Instagram URL" + variant builder UX. |
| **8** | **Real Estate** | Medium-high but compliance-heavy | Severe (current form is ~10% complete vs needs) | Medium (99acres/MagicBricks listings vs Sell.Do CRM at enterprise) | **Build last.** RERA + GST + DPDPA + FEMA + state stamp duty = highest legal liability. Single bad RERA-missing template = ZapText reputational risk. Wait until shared compliance middleware is rock-solid. PG/co-living sub-types could be earlier (lower compliance) — split later. |

**Suggested rollout sequence (MVP → scale):**

- **Phase 1 (Weeks 1-4):** Tiffin + Grocery — locks `RecurringConfig` + `DailyCatalogConfig` + `UnitPricing` + `PaymentCollectionConfig` shared shapes. ~30-40 SMB closed beta.
- **Phase 2 (Weeks 5-8):** Restaurant + Salon — locks `SlotConfig` + `StaffConfig` + `MultiLocationConfig` + `DiscountConfig`. Layer FSSAI compliance middleware.
- **Phase 3 (Weeks 9-12):** Coaching + Gym — adds `TrialConfig` heavy use, EMI/refund flow, faculty/trainer cert UX, layered compliance gates. Validate DPDPA minor-consent flow.
- **Phase 4 (Weeks 13-16):** E-commerce + Real Estate — most field-dense, most compliance-heavy. Both consume mature shared library. Real estate needs the WhatsApp-template-injection middleware (RERA QR auto-attach + content blocklist).

**Skip recommendation for V1:** healthcare/clinic (intentionally out of scope per Devesh), weapons/firearms, alcohol-only-B2B, gambling/fantasy sports, financial advisory, employment services. All restricted under WA Commerce Policy.

---

## Part 4 — Open questions for Devesh

1. **Pricing-tier feature gating:** Which fields should be locked behind ₹1499 / ₹3999? Recommendations from research: `pincodeCODPolicy`, `bulkTiers`, `loyalty`, `abandonedCart.sequence`, `RecurringConfig`, `MultiLocationConfig` should be ≥₹1499. Compliance flags (FSSAI, RERA, GSTIN) should be ALL tiers (mandatory, not gated). Confirm?

2. **Auto-fill from website scrape — scope of v1:** Subagents recommend implementing for Shopify (most reliable), 99acres/MagicBricks (RE), Zomato (restaurant), Instagram bio (small sellers). Your scraper is "separate" per the brief — what's its current input/output contract? Specifically, does it return raw HTML or structured fields per vertical? Affects `importedFromUrl` schema design.

3. **Voice-note transcription:** Sabziwala/tiffin/saree-D2C-aunty owners overwhelmingly use voice notes. v1 priority or v2? If v1, Sarvam-AI or Whisper backend? Affects grocery `dailyCatalogTextarea` paste-parser UX and salon "service list dictation" flow.

4. **WhatsApp template-injection middleware:** Real estate auto-RERA-QR-injection and gym supplement-blocklist filter and coaching no-rank-claim filter — should these live in a single `templateMiddleware` layer or per-vertical? Recommend a shared middleware with vertical-keyed rule sets. Confirm architecture choice.

5. **DPDPA minor consent flow (under-18 detection):** Coaching needs verifiable parental consent. Bot UX flow: (a) ask DOB upfront, (b) if <18, refuse to store details and request parent's WhatsApp first, (c) parent OTP confirms, (d) only then proceed. Acceptable UX? Or (b') just ask "are you 18+?" and trust the answer (lower friction, weaker compliance)? This is a product call.

6. **`PrivateClientNotes` storage:** Allergies, do-not-book, past-disputes — store encrypted at rest? With purge-after-30-days default per DPDPA data minimisation? Affects Drizzle schema + Postgres column encryption strategy.

7. **Multi-subscriber-per-phone (tiffin edge case #6 — diabetic family member needs separate dabba):** Auth model decision. Same WhatsApp number → multiple subscribers? Affects the `subscriptions[]` foreign-key shape and bot disambiguation logic ("Is this for you or [other subscriber]?").

8. **Aggregator deep-link enrichment:** When a restaurant pastes Zomato URL, do we just store the link or also scrape menu+price for direct-vs-aggregator pricing differential? Same Q for `marketplacePresence[]` in ecom. Storage + sync cost trade-off.

9. **"Generic catalog mode" for cross-vertical owners:** Should owners with multiple businesses (e.g. salon + small skincare retail, or restaurant + tiffin) get a multi-vertical config OR separate ZapText accounts? Current schema assumes 1 account = 1 vertical via discriminated union. Multi-vertical complicates UX significantly.

10. **Compliance attestation legal liability:** Schema treats fields like `noFalseRankClaim`, `medicalClaimsAvoided`, `commissionDisclosed`, `notFalseGITagClaim` as owner-attested booleans. ZapText acts as data processor, not validator. Need a Terms of Service clause clearly transferring liability to merchant. Has legal counsel reviewed onboarding TOS for these attestations?

---

## Part 5 — Login-walled gaps (per competitor)

Manually create trial accounts on these later to validate field depth:

### Wati (wati.io)
- ✅ Public: pricing, catalog basics (Shopify sync), shared inbox, drag-drop flow builder, broadcasts, Click-to-WA ads
- 🔒 Login-walled: Pro/Business plan-only flow templates; pricing model per-conversation markup details; admin-side custom-attribute schema; AI bot config; segmentation rule UI; flow-version control

### AiSensy (aisensy.com)
- ✅ Public: industry templates (real-estate, gym, salon, ecom, education), template library, Shopify/integrations list, broadcast templates (TEXT/IMAGE/CAROUSEL/LOCATION/VIDEO/FILE/LIMITED-TIME-OFFER), pricing per message
- 🔒 Login-walled: chatbot session limits, AI bot config (Pro+), custom attribute schema (5/20 by tier), tag limits (10/100), template-approval queue UX, automation flow JSON

### Interakt (interakt.shop / Haptik-owned)
- ✅ Public: industry pages (restaurant Eatoes case study, salon, ecom), Shopify product+variant sync, WhatsApp Pay via Razorpay, marketing+sell apps split
- 🔒 Login-walled: chatbot decision-tree UI, custom variable schema, AI agent (returns/cancellations) configuration UI, template-variable mapper

### Gallabox (gallabox.com)
- ✅ Public: Flow Builder, Razorpay/Calendly/Zoho integrations, contact custom fields documented, WhatsApp Commerce Policy education
- 🔒 Login-walled: form template library (Scale/Pro tier only), AI chatbot configuration, segmentation UI, multi-step form builder UX

### DoubleTick (doubletick.io)
- ✅ Public: pricing, broadcast UI, basic catalog
- 🔒 Login-walled: most of the product — minimal public docs

### BotSpace (botspace.com)
- ✅ Public: limited public docs, generic conversational-AI positioning
- 🔒 Login-walled: most product internals

### Petpooja (restaurant — petpooja.com)
- ✅ Public: feature pages (POS, menu management, multi-channel ordering, KOT, inventory, recipe-costing), Swiggy onboarding blog with field-list, G2 review feature breakdown
- 🔒 Login-walled: detailed item-level allergen taxonomy form, Halal/Jain checkbox UX, FSSAI expiry alert config, table-management designer, KOT printer station config, per-channel pricing UI

### Limetray (restaurant — limetray.com)
- ✅ Public: products page, per-outlet menu sync, reservation booking, loyalty, branded mobile app config, aggregator menu sync claims, call management
- 🔒 Login-walled: GST tax-slab matrix per item, packaging-charge rules (per-item vs per-order), table layout designer, custom event-ticket booking config

### Zenoti (salon/spa — zenoti.com)
- ✅ Public: services + duration + provider, color-formula tracking mention, multi-service linked appointments, couple/group bookings, processing-time double-booking, waitlist, deposit-on-booking, membership recurring billing, tiered loyalty, chair/room resource constraints, multi-location, retail consumption per service, "AI Receptionist" automation
- 🔒 Login-walled: stylist commission tier UI, chair-rental rate config, color-formula history per client, GMB sync config, AI Receptionist conversation rules

### MioSalon (salon — miosalon.com)
- ✅ Public: appointment + recurring appointment, prepaid/membership/package/reward-points (4 distinct loyalty types), gift voucher with redemption code, consent forms, product consumption per service, staff "available for client booking vs internal-only" toggle, online booking time-block, WhatsApp template per appointment-stage, Google Reserve, OTP for prepaid redemption, A4 invoice config, release notes blog
- 🔒 Login-walled: detailed package construction UI, segmentation rules editor, full template library, audit-trail config

### Mindbody / Vagaro / Fitli (gym + salon — mindbodyonline.com / vagaro.com / fitli.com)
- ✅ Public: class scheduling, instructor sub, marketplace discovery, packages, autopay positioning
- 🔒 Login-walled: instructor-substitution flow detailed UX, payroll/commission, retail integration, custom report builder

### Cult.fit B2B (business.cult.fit)
- ✅ Public: corporate Cult Pass partner positioning, gym partner network claims
- 🔒 Login-walled: partner gym onboarding form, employer portal, attendance API

### FITPASS (fitpass.co.in)
- ✅ Public: studio aggregator listings, app reviews on Trustpilot/ConsumerComplaints (negative skew)
- 🔒 Login-walled: studio-side onboarding form, partner payout terms, conflict-resolution UX

### Classplus (classplusapp.com — coaching)
- ✅ Public: branded app + course catalog, video lectures with DRM, batch-wise enrolment, fee instalments + auto reminders, live class scheduling, online test creation, attendance + monthly reports, store/checkout, marketing posters/coupons, pricing ₹19,999–₹50,000/yr
- 🔒 Login-walled: detailed branded-app config, attendance algorithm, quiz-builder UX, parent dashboard view, fee-late-fee rule engine

### Meritto / NoPaperForms (coaching / education — meritto.com / nopaperforms.com)
- ✅ Public: multi-centre + team-hierarchy management, real-time lead allocation, course-preference segmentation, 360° comm, Collexo payment, Niaa AI chatbot mention, cross-sell signals
- 🔒 Login-walled: lead-scoring rules, counsellor productivity dashboards, application workflow customization, e-sign config

### Teachmint (teachmint.com)
- ✅ Public: live class + record, attendance, fee invoicing + customisable receipts + instalments + reminders, admission management, LMS + assignment, parent communication, performance reports, $5/user/yr
- 🔒 Login-walled: digital-board hardware integration, full LMS UX, performance algorithm

### Sell.Do (real estate CRM — sell.do)
- ✅ Public: real-estate-specific positioning, lead score, source attribution, site-visit funnel states, booking → token → blocked → registered, e-sign integration, channel-partner sub-account
- 🔒 Login-walled: actual lead-scoring engine, cohort analysis, channel-partner commission tier UX

### 99acres / MagicBricks / Housing.com / NoBroker
- ✅ Public: post-listing forms, public catalog schemas (BHK/carpet/super-built/parking/balconies/facing/age/ownership), amenities multi-select, search filters
- 🔒 Login-walled: lead-buyer data, premium-listing payment, agent-license verification, dispute resolution

### Square Yards (squareyards.com)
- ✅ Public: per-builder commission tiers, NRI funnel pages with currency toggle, multi-bank ROI table, project comparison matrix, virtual tour
- 🔒 Login-walled: actual CP onboarding form fields, commission settlement UI

### Bik.ai (formerly Bikayi — ecom)
- ✅ Public: "agentic AI CRM for ecommerce", 500+ pre-built agents, customer purchase frequency segmentation, recency segments, product-level discount rules, CRM tag-by-intent
- 🔒 Login-walled: full agent library, segment rule builder

### Shiprocket Engage / GoKwik / QuickReply.ai
- ✅ Public: pre-ship + post-ship WA, COD confirmation, address verification, COD→Prepaid nudge with discount, abandoned cart, branded tracking, RTO risk score positioning, partial-COD, anonymous-visitor identification, pricing
- 🔒 Login-walled: actual ML risk-score algorithm, A/B test templates, multi-courier orchestration UI

### Otipy / Country Delight / Licious / FreshToHome (grocery)
- ✅ Public: order-by-midnight cutoff, daily slot, subscription FAQ, refund/quality claims, traceability messaging, cold-chain claims
- 🔒 Login-walled: B2B/seller onboarding form (none of these have sell-side; they're closed networks), supplier KPI dashboards

---

## Closing notes

This research consolidated ~24,000 words of subagent output into a single architectural spec. Each vertical's full report (with citations, real-business URLs, fully expanded TS schemas, all 30 customer questions, all edge cases, full UX notes, full compliance) is preserved in the parallel subagent outputs and should be the source of truth for any field-level implementation question.

**Next concrete step:** Devesh decides on the 10 open questions in Part 4. Once `RecurringConfig` + `DailyCatalogConfig` + `UnitPricing` + `PaymentCollectionConfig` shapes are signed off (Phase 1 dependencies), tiffin + grocery can ship in parallel within 4 weeks. The shared library lock at end of Phase 1 unblocks the next 6 verticals.

The schema is production-grade, not boilerplate. Every field traces to a real customer question, a regulation, a competitor capture, or a Reddit/Twitter complaint per the original instructions. Where unverified, I've marked `[unverified]` inline.

Code comes after approval.