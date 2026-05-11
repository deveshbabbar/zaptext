// Per-vertical schemas for the bulk-import pipeline.
// Each entry defines:
//   - prompt:    system prompt sent to Groq/Gemini explaining the target shape
//   - validate:  guard that coerces a raw JSON object into the typed row
//
// All extraction is best-effort. The model returns { items: [...] } and we
// drop rows that fail validation. The form gets only valid rows; the user
// reviews and confirms before they merge into form state.

export type Validator<T> = (raw: unknown) => T | null;

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return fallback;
}

function asNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (['true', 'yes', '1', 'veg'].includes(s)) return true;
    if (['false', 'no', '0', 'non-veg', 'nonveg'].includes(s)) return false;
  }
  return fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// ─── Restaurant menu items ──────────────────────────────────────────────

export type RestaurantMenuItem = {
  name: string;
  price: number;
  veg: boolean;
  category?: string;
  description?: string;
};

const RESTAURANT_PROMPT = `You are an extraction tool for an Indian restaurant menu.
The menu can be in Hindi, English, or Hinglish; it may include section headers
("Starters", "Main course", "Desserts"), prices in Rs./INR, and veg/non-veg
markers (V, NV, green/red dots).

Output exactly: { "items": [{ "name": "<dish name>", "price": <number>, "veg": <true|false>, "category": "<section>", "description": "<short, optional>" }, ...] }

Rules:
- Strip currency symbols and commas from prices. "Rs. 1,200" -> 1200.
- Treat green-dot / "V" markers as veg=true; red-dot / "NV" / chicken/mutton/fish/egg names as veg=false. When unsure, infer from the dish name.
- Carry the most recent section header as "category" for the rows below it.
- Skip header rows themselves (rows with no price).
- Output JSON only. No prose.`;

const validateRestaurant: Validator<RestaurantMenuItem> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const price = asNumber(raw.price);
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    veg: asBool(raw.veg, true),
    category: asString(raw.category) || undefined,
    description: asString(raw.description) || undefined,
  };
};

// ─── Coaching courses ───────────────────────────────────────────────────

export type CoachingCourse = {
  name: string;
  duration: string;
  price: number;
  batchType?: string;
  faculty?: string;
};

const COACHING_PROMPT = `You are an extraction tool for an Indian coaching institute's course catalog.
Courses target exams like JEE, NEET, CAT, UPSC, SSC, Banking, GATE, Class 9-12, etc.

Output exactly: { "items": [{ "name": "<course>", "duration": "<e.g., 1 year / 6 months>", "price": <number>, "batchType": "<crash|foundation|repeater|online|offline|hybrid>", "faculty": "<lead faculty if mentioned>" }, ...] }

Rules:
- Price: full-program fee, not monthly EMI. Strip Rs./commas.
- Duration: keep original phrasing ("1 year", "11 months", "8 weeks").
- batchType: pick best match from the enum or leave empty.
- Skip rows without a price OR without a course name.
- Output JSON only.`;

const validateCoaching: Validator<CoachingCourse> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const price = asNumber(raw.price);
  if (!name || price <= 0) return null;
  return {
    name,
    duration: asString(raw.duration) || 'unknown',
    price,
    batchType: asString(raw.batchType) || undefined,
    faculty: asString(raw.faculty) || undefined,
  };
};

// ─── Real estate listings ───────────────────────────────────────────────

export type RealEstateListing = {
  title: string;
  listingType: string;
  propertyType: string;
  bhk?: string;
  carpetArea?: number;
  builtUpArea?: number;
  superArea?: number;
  price: number;
  location: string;
  reraNumber?: string;
};

const REALESTATE_PROMPT = `You are an extraction tool for an Indian real-estate broker's property list.
Listings can be sale, rent, or lease. Indian conventions: BHK (2BHK, 3BHK), carpet/
built-up/super area in sqft, price in lakhs/crores or Rs./month rent.

Output exactly: { "items": [{ "title": "<short>", "listingType": "<sale|rent|lease>", "propertyType": "<apartment|villa|plot|commercial|pg|office|shop>", "bhk": "<2BHK|3BHK|null>", "carpetArea": <number sqft>, "builtUpArea": <number sqft>, "superArea": <number sqft>, "price": <number INR>, "location": "<area, city>", "reraNumber": "<RERA reg if listed>" }, ...] }

Rules:
- Convert lakhs -> multiply by 100000; crores -> 10000000. "1.2 Cr" -> 12000000.
- Rent prices stay in monthly INR.
- If only one area is given, put it in builtUpArea.
- Output JSON only.`;

const validateRealEstate: Validator<RealEstateListing> = (raw) => {
  if (!isRecord(raw)) return null;
  const title = asString(raw.title);
  const price = asNumber(raw.price);
  if (!title || price <= 0) return null;
  return {
    title,
    listingType: asString(raw.listingType, 'sale'),
    propertyType: asString(raw.propertyType, 'apartment'),
    bhk: asString(raw.bhk) || undefined,
    carpetArea: asNumber(raw.carpetArea) || undefined,
    builtUpArea: asNumber(raw.builtUpArea) || undefined,
    superArea: asNumber(raw.superArea) || undefined,
    price,
    location: asString(raw.location),
    reraNumber: asString(raw.reraNumber) || undefined,
  };
};

// ─── Salon services ─────────────────────────────────────────────────────

export type SalonService = {
  name: string;
  price: number;
  durationMin?: number;
  gender?: string;
  category?: string;
};

const SALON_PROMPT = `You are an extraction tool for an Indian salon/beauty parlour service menu.
Services include haircut, color, facial, mehendi, bridal makeup, threading, waxing, etc.

Output exactly: { "items": [{ "name": "<service>", "price": <number>, "durationMin": <number minutes>, "gender": "<unisex|female|male>", "category": "<Hair|Skin|Bridal|Spa|Nails>" }, ...] }

Rules:
- Strip Rs./commas from price.
- durationMin: convert "1 hr" -> 60, "30 min" -> 30. Omit if not stated.
- Output JSON only.`;

const validateSalon: Validator<SalonService> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const price = asNumber(raw.price);
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    durationMin: asNumber(raw.durationMin) || undefined,
    gender: asString(raw.gender) || undefined,
    category: asString(raw.category) || undefined,
  };
};

// ─── Gym membership plans ───────────────────────────────────────────────

export type GymPlan = {
  name: string;
  duration: string;
  price: number;
  includesPT?: boolean;
  includesClasses?: string;
};

const GYM_PROMPT = `You are an extraction tool for an Indian gym/fitness studio's membership plans.

Output exactly: { "items": [{ "name": "<plan>", "duration": "<1 month|3 months|1 year>", "price": <number>, "includesPT": <true|false>, "includesClasses": "<yoga, zumba — comma list>" }, ...] }

Rules:
- Strip Rs./commas from price.
- includesPT=true only when explicitly listed (PT, personal trainer, training included).
- Output JSON only.`;

const validateGym: Validator<GymPlan> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const price = asNumber(raw.price);
  if (!name || price <= 0) return null;
  return {
    name,
    duration: asString(raw.duration) || 'unknown',
    price,
    includesPT: asBool(raw.includesPT, false),
    includesClasses: asString(raw.includesClasses) || undefined,
  };
};

// ─── Tiffin plans ───────────────────────────────────────────────────────

export type TiffinPlan = {
  name: string;
  duration: string;
  price: number;
  mealsPerDay?: number;
  mealType?: string;
  veg?: boolean;
};

const TIFFIN_PROMPT = `You are an extraction tool for an Indian tiffin / home-food service's plans.

Output exactly: { "items": [{ "name": "<plan name>", "duration": "<daily|weekly|monthly>", "price": <number>, "mealsPerDay": <1|2|3>, "mealType": "<lunch|dinner|both>", "veg": <true|false> }, ...] }

Rules:
- Strip Rs./commas. Monthly price is for the full duration, not per-meal.
- mealsPerDay: count from the description ("lunch + dinner" -> 2).
- Output JSON only.`;

const validateTiffin: Validator<TiffinPlan> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const price = asNumber(raw.price);
  if (!name || price <= 0) return null;
  return {
    name,
    duration: asString(raw.duration) || 'monthly',
    price,
    mealsPerDay: asNumber(raw.mealsPerDay) || undefined,
    mealType: asString(raw.mealType) || undefined,
    veg: asBool(raw.veg, true),
  };
};

// ─── Ecommerce products ─────────────────────────────────────────────────

export type EcommerceProduct = {
  name: string;
  price: number;
  mrp?: number;
  sku?: string;
  category?: string;
  stock?: number;
  description?: string;
};

const ECOMMERCE_PROMPT = `You are an extraction tool for an Indian D2C / online seller's product catalog.

Output exactly: { "items": [{ "name": "<product>", "price": <selling price number>, "mrp": <MRP number>, "sku": "<SKU/code>", "category": "<category>", "stock": <quantity>, "description": "<short>" }, ...] }

Rules:
- Strip Rs./commas.
- If MRP and selling price both present, use both. If only one, put it in price.
- Output JSON only.`;

const validateEcommerce: Validator<EcommerceProduct> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const price = asNumber(raw.price);
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    mrp: asNumber(raw.mrp) || undefined,
    sku: asString(raw.sku) || undefined,
    category: asString(raw.category) || undefined,
    stock: asNumber(raw.stock) || undefined,
    description: asString(raw.description) || undefined,
  };
};

// ─── Grocery store inventory ────────────────────────────────────────────

export type GroceryProduct = {
  name: string;
  price: number;
  unit: string;
  category?: string;
};

const GROCERY_PROMPT = `You are an extraction tool for an Indian kirana/grocery store's product list.
Products include rice, atta, dal, oil, biscuits, milk, soap, etc.

Output exactly: { "items": [{ "name": "<product>", "price": <number>, "unit": "<1 kg|500 g|1 L|pack|piece>", "category": "<Rice & Grains|Atta|Dal|Oil|Snacks|Dairy|Personal Care|Household>" }, ...] }

Rules:
- Strip Rs./commas.
- Unit: keep the exact pack size as written ("1 kg", "500 g", "1 L", "200 ml").
- Output JSON only.`;

const validateGrocery: Validator<GroceryProduct> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const price = asNumber(raw.price);
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    unit: asString(raw.unit) || 'piece',
    category: asString(raw.category) || undefined,
  };
};

// ─── Registry ───────────────────────────────────────────────────────────

export type SchemaEntry = {
  prompt: string;
  validate: Validator<unknown>;
};

export const SCHEMAS: Record<string, SchemaEntry> = {
  restaurant: { prompt: RESTAURANT_PROMPT, validate: validateRestaurant as Validator<unknown> },
  coaching: { prompt: COACHING_PROMPT, validate: validateCoaching as Validator<unknown> },
  realestate: { prompt: REALESTATE_PROMPT, validate: validateRealEstate as Validator<unknown> },
  salon: { prompt: SALON_PROMPT, validate: validateSalon as Validator<unknown> },
  gym: { prompt: GYM_PROMPT, validate: validateGym as Validator<unknown> },
  tiffin: { prompt: TIFFIN_PROMPT, validate: validateTiffin as Validator<unknown> },
  ecommerce: { prompt: ECOMMERCE_PROMPT, validate: validateEcommerce as Validator<unknown> },
  grocery: { prompt: GROCERY_PROMPT, validate: validateGrocery as Validator<unknown> },
};

export type SupportedVertical = keyof typeof SCHEMAS;

export function isSupportedVertical(v: string): v is SupportedVertical {
  return v in SCHEMAS;
}
