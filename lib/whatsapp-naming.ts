// ─── WhatsApp Business display-name validator ────────────────────────────
//
// Pure (zero I/O) — encodes Meta's display-name rules as published at:
//   https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names/
//   https://www.facebook.com/business/help/757569725593362
//
// Goal: catch obvious Meta rejections BEFORE the admin submits a client to
// Meta for review. Meta rejections take days to surface; local validation is
// instant and gives concrete fixes.
//
// Three classes of finding:
//   - errors:      WILL be rejected by Meta. Hard block.
//   - warnings:    LIKELY to be rejected — fix recommended.
//   - suggestions: concrete rewrites the admin can pick.
//
// Notable ban example we hit in production: "Gym Time Fitness" was rejected
// because all three tokens are generic descriptors (gym/category, time/filler,
// fitness/category) with no distinctive brand identifier. The validator
// detects that pattern and warns BEFORE the name reaches Meta.

export interface DisplayNameValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  normalized: string;
}

// Words Meta treats as generic categories — bare name made of only these
// (and/or locations and fillers) gets rejected as "not a brand".
// Lower-cased; matched on token equality, not substring.
const GENERIC_CATEGORY_WORDS = new Set([
  // food / hospitality
  'restaurant', 'cafe', 'coffee', 'food', 'foods', 'kitchen', 'dhaba',
  'hotel', 'motel', 'lodge', 'resort',
  'pizza', 'burger', 'biryani', 'dosa', 'sandwich', 'bakery',
  'beer', 'liquor', 'wine', 'bar', 'pub',
  'juice', 'juices', 'water', 'milk', 'bread', 'eggs', 'meat', 'fish',
  'sweets', 'mithai', 'snacks', 'tiffin',
  // retail
  'shop', 'store', 'mart', 'market', 'bazaar', 'emporium',
  'showroom', 'outlet', 'boutique',
  // services
  'services', 'service', 'solutions', 'consultancy', 'consulting',
  'agency', 'business', 'enterprise', 'enterprises', 'company',
  'works', 'industries', 'industry',
  // health
  'clinic', 'hospital', 'pharmacy', 'medical', 'medicare', 'health',
  'wellness', 'care',
  // beauty
  'salon', 'spa', 'parlour', 'parlor', 'beauty',
  // fitness
  'gym', 'fitness', 'gymnasium', 'crossfit',
  // education
  'coaching', 'tuition', 'tutor', 'tutorial', 'tutorials',
  'academy', 'school', 'college', 'institute', 'university',
  // generic fillers
  'time', 'point', 'place', 'world', 'plaza', 'palace',
  'corner', 'house', 'home', 'station', 'zone', 'hub',
  'center', 'centre', 'studio',
]);

// Bare locations Meta treats as non-brand. Indian cities + states + cardinal
// directions. Non-exhaustive — catches the most common "DELHI EAST" type
// rejections we've seen.
const LOCATION_WORDS = new Set([
  'india', 'bharat',
  'delhi', 'mumbai', 'bangalore', 'bengaluru', 'chennai', 'kolkata',
  'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'surat', 'gurgaon',
  'gurugram', 'noida', 'lucknow', 'kanpur', 'nagpur', 'bhopal',
  'patna', 'indore', 'chandigarh', 'kochi', 'cochin', 'thiruvananthapuram',
  'visakhapatnam', 'vijayawada', 'coimbatore', 'mysore', 'mysuru',
  // states
  'gujarat', 'maharashtra', 'punjab', 'haryana', 'rajasthan',
  'kerala', 'karnataka', 'goa', 'odisha', 'orissa',
  'assam', 'bihar', 'jharkhand', 'chhattisgarh', 'telangana',
  // shorthand directions
  'north', 'south', 'east', 'west', 'central',
  'mp', 'up', 'ap', 'tn', 'wb', 'jk', 'hp',
]);

// 3rd-party platform / agency names — Meta wants the CLIENT's brand, not
// the BSP's. Include common aggregators in the Indian market.
const THIRD_PARTY_TOOLS = new Set([
  'zaptext', 'wati', 'aisensy', 'gallabox', 'interakt', 'doubletick',
  'messagebird', 'twilio', 'whatsapp', 'meta', 'facebook',
  'bot', 'chatbot', 'whatsappbot',
]);

// Forbidden symbol set. Apostrophe (’ '), hyphen (-), period (.), and
// ampersand (&) are FINE inside a real brand name. Everything else is risky.
const FORBIDDEN_SYMBOL_REGEX = /[™®©_=+\\\/<>{}\[\]|^`~@#$%*]/;

// URL-ish patterns Meta rejects outright.
const URL_LIKE_REGEX = /\b(www\.|https?:\/\/|\.(com|net|org|in|co|io|app|biz)\b)/i;

// Emoji range — covers most BMP + supplementary emoji blocks.
// eslint-disable-next-line no-misleading-character-class
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // strip apostrophes etc. for token analysis
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function isAllCaps(name: string): boolean {
  // True only if there are 3+ alphabetic chars AND zero lowercase letters.
  // Acronyms like "KFC India" have "India" breaking the all-caps check, so
  // this only fires for fully-shouted names.
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}

function isAllLowerCase(name: string): boolean {
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return letters === letters.toLowerCase();
}

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export function validateDisplayName(input: string): DisplayNameValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // ─── Normalize: trim, collapse internal whitespace ───
  const normalized = (input || '').trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return {
      valid: false,
      errors: ['Display name is required.'],
      warnings: [],
      suggestions: [],
      normalized: '',
    };
  }

  // ─── Hard rules (errors) ────────────────────────────────────────────────

  if (normalized.length < 3) {
    errors.push(`Too short: must be at least 3 characters. (current: ${normalized.length})`);
  }
  if (normalized.length > 70) {
    errors.push(`Too long: keep it under 70 characters. (current: ${normalized.length})`);
  }
  if (URL_LIKE_REGEX.test(normalized)) {
    errors.push('No URLs or domain extensions allowed (no "www.", ".com", ".in", etc.).');
  }
  if (EMOJI_REGEX.test(normalized)) {
    errors.push('No emojis allowed in display name.');
  }
  if (FORBIDDEN_SYMBOL_REGEX.test(normalized)) {
    errors.push('No special symbols (™, ®, ©, _, =, +, *, |, etc.) — only letters, numbers, spaces, apostrophes, hyphens, periods, and "&" are safe.');
  }
  if (input !== input.trim()) {
    warnings.push('Leading/trailing whitespace will be auto-trimmed.');
  }
  if (/\s{2,}/.test(input)) {
    warnings.push('Multiple consecutive spaces — collapsed to single space.');
  }

  // ─── Token analysis ────────────────────────────────────────────────────
  const tokens = tokenize(normalized);

  // All tokens are abbreviations (≤ 2 chars each) → reject
  if (tokens.length > 0 && tokens.every((t) => t.length <= 2)) {
    errors.push('Looks like an abbreviation. Use the full business name (e.g. "FP Juices" → "Fresh Produce Juices").');
  }

  // Distinguish tokens by category
  const generic = tokens.filter((t) => GENERIC_CATEGORY_WORDS.has(t));
  const locations = tokens.filter((t) => LOCATION_WORDS.has(t));
  const thirdParty = tokens.filter((t) => THIRD_PARTY_TOOLS.has(t));
  const distinctive = tokens.filter(
    (t) => !GENERIC_CATEGORY_WORDS.has(t) && !LOCATION_WORDS.has(t) &&
           !THIRD_PARTY_TOOLS.has(t) && t.length > 2
  );

  // 3rd-party tool names like "ZapText" or "Bot" — Meta wants the CLIENT's brand
  if (thirdParty.length > 0) {
    errors.push(`Remove platform/tool words: "${thirdParty.join(', ')}". Meta wants the client's own brand, not the BSP or "Bot".`);
  }

  // Bare location only ("DELHI EAST", "Mumbai")
  if (distinctive.length === 0 && locations.length > 0 && generic.length === 0) {
    errors.push(`Just a location ("${locations.join(' ')}") isn't a brand. Add the actual business name.`);
  }

  // Pure category descriptors only ("Beer", "Restaurant", "Gym Time Fitness")
  if (distinctive.length === 0 && generic.length > 0) {
    errors.push(
      `All tokens are generic categories ("${generic.join(', ')}"). Meta will reject — add a distinctive brand or owner identifier. ` +
      `Example: "${toTitleCase(generic.join(' '))}" → try one of the suggestions below.`
    );
    // concrete fixes
    const titled = toTitleCase(normalized);
    suggestions.push(`Babbar's ${titled}`);
    suggestions.push(`${titled} Studio`);
    if (locations.length === 0) {
      suggestions.push(`${titled} Delhi East`);
    }
  } else if (distinctive.length === 0 && generic.length === 0 && locations.length === 0 && tokens.length > 0) {
    // Single short token like "ABC" or filler-only — borderline
    warnings.push('Name has no clearly distinctive token. Meta may flag it as generic.');
  }

  // Generic+location only, no brand ("Gym Delhi") — borderline reject
  if (distinctive.length === 0 && generic.length > 0 && locations.length > 0) {
    warnings.push(
      `"${generic.join(' ')} ${locations.join(' ')}" is category + location with no brand. ` +
      `Likely rejected. Add an owner or brand prefix.`
    );
  }

  // ─── Capitalization warnings ────────────────────────────────────────────
  if (isAllCaps(normalized)) {
    warnings.push('All caps will likely be rejected (unless your registered brand IS officially all-caps). Use Title Case.');
    suggestions.push(toTitleCase(normalized));
  } else if (isAllLowerCase(normalized)) {
    warnings.push('All lowercase looks unprofessional. Use Title Case.');
    suggestions.push(toTitleCase(normalized));
  }

  // ─── Test/Demo suffix — allowed but flag as warning ────────────────────
  const lowerNorm = normalized.toLowerCase();
  if (/\b(test|demo|sample|trial)\b/.test(lowerNorm)) {
    warnings.push('Has "test/demo" — only allowed during development. Remove before going live for real customers.');
  }

  // Drop duplicate suggestions, cap to 3 most useful
  const dedupedSuggestions = Array.from(new Set(suggestions)).slice(0, 3);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions: dedupedSuggestions,
    normalized,
  };
}
