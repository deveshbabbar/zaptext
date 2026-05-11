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

export type SizePrice = { label: string; price: number };

export type RestaurantMenuItem = {
  name: string;
  price: number;            // for single-price items; for variant items this is the cheapest variant
  veg: boolean;
  category?: string;
  description?: string;
  sizes?: SizePrice[];      // present when the dish has multiple size variants
};

const RESTAURANT_PROMPT = `You are an extraction tool for an Indian restaurant menu.
The menu can be in Hindi, English, or Hinglish; it may include section headers
("Starters", "Main course", "Desserts"), prices in Rs./INR, and veg/non-veg
markers (V, NV, green/red dots).

Many dishes have MULTIPLE PRICES based on size or portion:
- "Half / Full" (biryani, dal, kebabs)
- "Small / Medium / Large" (pizza, beverages)
- "Regular / Family Pack" (combos)
- "6" / 8" / 10" / 12"" (pizza sizes)
- "Quarter / Half / Full" (chicken, mutton)
- "Single / Double" (sandwich, burger)
- "Glass / Jug / Pitcher" (drinks)

When a dish has multiple size variants, output them in the "sizes" array with
the cheapest price ALSO copied to the top-level "price" field.

Output exactly:
{
  "items": [
    {
      "name": "<dish name without the size word>",
      "price": <number — cheapest variant or single price>,
      "veg": <true|false>,
      "category": "<section>",
      "description": "<short, optional>",
      "sizes": [{ "label": "Half", "price": 200 }, { "label": "Full", "price": 380 }]
    }
  ]
}

For single-price items, omit "sizes" or set it to an empty array.

Rules:
- Strip currency symbols and commas from prices. "Rs. 1,200" -> 1200.
- Treat green-dot / "V" markers as veg=true; red-dot / "NV" / chicken/mutton/fish/egg names as veg=false. When unsure, infer from the dish name.
- Carry the most recent section header as "category" for the rows below it.
- Skip header rows themselves (rows with no price).
- If a dish appears with the size IN the name ("Chicken Biryani Half — 200, Chicken Biryani Full — 380"), COMBINE them into ONE item with sizes=[{Half,200},{Full,380}], not two items.
- Size labels: normalize to title-case ("Half" not "half", "Large" not "L"). Common short forms map: S->Small, M->Medium, L->Large, XL->Extra Large, Reg->Regular.
- Output JSON only. No prose.`;

const validateSizes = (raw: unknown): SizePrice[] | undefined => {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SizePrice[] = [];
  for (const s of raw) {
    if (!isRecord(s)) continue;
    const label = asString(s.label);
    const price = asNumber(s.price);
    if (!label || price <= 0) continue;
    out.push({ label, price });
  }
  return out.length > 0 ? out : undefined;
};

const validateRestaurant: Validator<RestaurantMenuItem> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  let price = asNumber(raw.price);
  const sizes = validateSizes(raw.sizes);
  // If the LLM omitted a top-level price but gave sizes, derive from cheapest.
  if (price <= 0 && sizes && sizes.length > 0) {
    price = Math.min(...sizes.map((s) => s.price));
  }
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    veg: asBool(raw.veg, true),
    category: asString(raw.category) || undefined,
    description: asString(raw.description) || undefined,
    sizes,
  };
};

// ─── Coaching courses ───────────────────────────────────────────────────

export type CoachingCourse = {
  name: string;
  duration: string;
  price: number;
  batchType?: string;
  faculty?: string;
  variants?: SizePrice[];   // Online/Offline, With-materials/Without, Standard/Premium
};

const COACHING_PROMPT = `You are an extraction tool for an Indian coaching institute's course catalog.
Courses target exams like JEE, NEET, CAT, UPSC, SSC, Banking, GATE, Class 9-12, etc.

Many courses have MULTIPLE PRICES based on delivery format or inclusions:
- "Online / Offline / Hybrid" (live class vs in-person vs both)
- "With Materials / Without Materials"
- "Standard / Premium" (extra mock tests, 1-on-1 doubt support)
- "Crash / Regular / Foundation" (when same course offered at different intensities)

When a course has multiple variants, output them in "variants" with the
cheapest variant also copied to the top-level "price" field.

Output exactly: { "items": [{ "name": "<course>", "duration": "<e.g., 1 year / 6 months>", "price": <number — cheapest variant or single fee>, "batchType": "<crash|foundation|repeater|online|offline|hybrid>", "faculty": "<lead faculty if mentioned>", "variants": [{ "label": "Online", "price": 40000 }, { "label": "Offline", "price": 60000 }] }, ...] }

For single-fee courses, omit "variants" or set it to an empty array.

Rules:
- Price: full-program fee, not monthly EMI. Strip Rs./commas.
- Duration: keep original phrasing ("1 year", "11 months", "8 weeks").
- batchType: pick best match from the enum or leave empty.
- If a course appears with the variant IN the name ("JEE Online 40000, JEE Offline 60000"), COMBINE them into ONE item with variants=[{Online,40000},{Offline,60000}].
- Variant labels: title-case ("Online" not "online", "With Materials" not "with mats").
- Skip rows without a price OR without a course name.
- Output JSON only.`;

const validateCoaching: Validator<CoachingCourse> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  let price = asNumber(raw.price);
  const variants = validateSizes(raw.variants);
  if (price <= 0 && variants && variants.length > 0) {
    price = Math.min(...variants.map((s) => s.price));
  }
  if (!name || price <= 0) return null;
  return {
    name,
    duration: asString(raw.duration) || 'unknown',
    price,
    batchType: asString(raw.batchType) || undefined,
    faculty: asString(raw.faculty) || undefined,
    variants,
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
  variants?: SizePrice[];   // Short/Medium/Long hair, Mens/Womens, Single/Double, Half/Full
};

const SALON_PROMPT = `You are an extraction tool for an Indian salon/beauty parlour service menu.
Services include haircut, color, facial, mehendi, bridal makeup, threading, waxing, etc.

Many services have MULTIPLE PRICES based on length, gender, or extent:
- "Short Hair / Medium Hair / Long Hair" (haircut, color, smoothening, keratin)
- "Mens / Womens" (when same service different price)
- "Half / Full" (mehendi, waxing, arms/legs)
- "Single / Double" (eyebrows + upper lip combo)
- "With Wash / Without Wash"
- "Basic / Premium" (facials, manicures)

When a service has multiple variants, output them in "variants" with the
cheapest variant copied to top-level "price".

Output exactly: { "items": [{ "name": "<service>", "price": <number — cheapest or single>, "durationMin": <number minutes>, "gender": "<unisex|female|male>", "category": "<Hair|Skin|Bridal|Spa|Nails>", "variants": [{ "label": "Short", "price": 500 }, { "label": "Long", "price": 800 }] }, ...] }

For single-price services, omit "variants" or set to empty array.

Rules:
- Strip Rs./commas from price.
- durationMin: convert "1 hr" -> 60, "30 min" -> 30. Omit if not stated.
- If a service appears as "Haircut Short 500 / Haircut Long 800", COMBINE into ONE item with variants.
- Variant labels: title-case ("Short", "Long", "With Wash"). Don't expand abbreviations: M stays "Medium", L stays "Long".
- Output JSON only.`;

const validateSalon: Validator<SalonService> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  let price = asNumber(raw.price);
  const variants = validateSizes(raw.variants);
  if (price <= 0 && variants && variants.length > 0) {
    price = Math.min(...variants.map((s) => s.price));
  }
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    durationMin: asNumber(raw.durationMin) || undefined,
    gender: asString(raw.gender) || undefined,
    category: asString(raw.category) || undefined,
    variants,
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
  variants?: SizePrice[];   // clothing sizes S/M/L/XL, pack sizes 250g/500g/1kg, volume 30ml/50ml/100ml
};

const ECOMMERCE_PROMPT = `You are an extraction tool for an Indian D2C / online seller's product catalog.

Many products have MULTIPLE PRICES based on size, pack, or quantity:
- Clothing sizes: "S / M / L / XL / XXL" (price often same for S/M/L, jumps at XL/XXL)
- Pack sizes: "250g / 500g / 1kg / 5kg"
- Volume: "30ml / 50ml / 100ml / 200ml"
- Quantity: "Pack of 1 / Pack of 3 / Pack of 6"
- Pieces: "1pc / 2pc / 4pc"

When a product has multiple variants, output them in "variants" with the
cheapest variant also copied to top-level "price".

Output exactly: { "items": [{ "name": "<product>", "price": <selling price — cheapest or single>, "mrp": <MRP number>, "sku": "<SKU/code>", "category": "<category>", "stock": <quantity>, "description": "<short>", "variants": [{ "label": "S", "price": 999 }, { "label": "M", "price": 999 }, { "label": "L", "price": 1099 }] }, ...] }

For single-price products, omit "variants" or set to empty array.

Rules:
- Strip Rs./commas.
- If MRP and selling price both present, use both. If only one, put it in price.
- If a product appears as "Cotton Kurta S 999, Cotton Kurta M 999, Cotton Kurta L 1099", COMBINE into ONE item with variants array.
- Variant labels: keep them concise as written. "S", "M", "L", "XL", "250g", "500ml", "Pack of 3".
- Output JSON only.`;

const validateEcommerce: Validator<EcommerceProduct> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  let price = asNumber(raw.price);
  const variants = validateSizes(raw.variants);
  if (price <= 0 && variants && variants.length > 0) {
    price = Math.min(...variants.map((s) => s.price));
  }
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    mrp: asNumber(raw.mrp) || undefined,
    sku: asString(raw.sku) || undefined,
    category: asString(raw.category) || undefined,
    stock: asNumber(raw.stock) || undefined,
    description: asString(raw.description) || undefined,
    variants,
  };
};

// ─── Grocery store inventory ────────────────────────────────────────────

export type GroceryProduct = {
  name: string;
  price: number;
  unit: string;
  category?: string;
  variants?: SizePrice[];   // pack sizes 250g/500g/1kg/5kg, 200ml/500ml/1L
};

const GROCERY_PROMPT = `You are an extraction tool for an Indian kirana/grocery store's product list.
Products include rice, atta, dal, oil, biscuits, milk, soap, etc.

Many products come in MULTIPLE PACK SIZES at the same brand:
- "Aashirvaad Atta 1kg / 5kg / 10kg"
- "Amul Milk 200ml / 500ml / 1L"
- "Tata Salt 1kg / 200g"
- "Surf Excel 500g pouch / 1kg pouch / 2kg bucket"
- "Lays 30g / 80g / Party Pack"

When a product has multiple pack sizes, combine into ONE item with
variants[] where the LABEL is the pack size. Top-level "price" is the
smallest pack's price; "unit" is the smallest pack as well.

Output exactly: { "items": [{ "name": "<product brand+name, no size>", "price": <number — smallest pack>, "unit": "<smallest pack>", "category": "<Rice & Grains|Atta|Dal|Oil|Snacks|Dairy|Personal Care|Household>", "variants": [{ "label": "1kg", "price": 290 }, { "label": "5kg", "price": 1290 }] }, ...] }

For single-pack products, omit "variants" or set to empty array.

Rules:
- Strip Rs./commas.
- "name" should NOT include the size. "Aashirvaad Atta 1kg" -> name="Aashirvaad Atta", unit="1 kg".
- If a product appears as separate lines for each pack size, COMBINE into one item with variants.
- Variant labels: as written — "1kg" / "1 kg" / "500g" / "1 L" / "Pack of 6" — keep concise.
- Output JSON only.`;

const validateGrocery: Validator<GroceryProduct> = (raw) => {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  let price = asNumber(raw.price);
  const variants = validateSizes(raw.variants);
  if (price <= 0 && variants && variants.length > 0) {
    price = Math.min(...variants.map((s) => s.price));
  }
  if (!name || price <= 0) return null;
  return {
    name,
    price,
    unit: asString(raw.unit) || 'piece',
    category: asString(raw.category) || undefined,
    variants,
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
