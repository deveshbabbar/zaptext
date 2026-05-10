import { ClientConfig } from './types';

// ─── Sub-type accessor helper ───
//
// Forms now store sub-types as an ARRAY (`subTypes[]`) since most Indian
// businesses overlap categories (e.g. cafe + bakery, JEE + NEET, channel-
// partner + resale). The legacy single `subType` field is kept for back-
// compat with old data rows. Always read sub-types via this helper:
//
//   const subs = getSubTypes(config);
//   if (subs.includes('bridal-makeup-studio')) { ... }
//
function getSubTypes<T extends string>(config: { subTypes?: T[]; subType?: T }): T[] {
  if (config.subTypes && config.subTypes.length > 0) return config.subTypes;
  if (config.subType) return [config.subType];
  return [];
}

export function generateSystemPrompt(config: ClientConfig): string {
  const base = buildBasePrompt(config);
  const specific = buildTypeSpecificPrompt(config);
  const rules = buildResponseRules(config);
  const extraInventory = buildInventorySection(config);
  return `${base}\n\n${specific}${extraInventory ? '\n\n' + extraInventory : ''}\n\n${rules}`;
}

// Optional generic inventory block populated by mirrorInventoryToKb(). Lets
// the bot see items the owner added via /client/inventory regardless of
// vertical (gym supplements, salon products, coaching kits, etc.). Live stock
// numbers are injected at runtime by the webhook — this static block is the
// catalog the owner controls from the dashboard.
function buildInventorySection(config: ClientConfig): string {
  const extra = (config as unknown as { inventoryItems?: Array<{ name: string; price: number; notes?: string; available?: string }> }).inventoryItems;
  if (!Array.isArray(extra) || extra.length === 0) return '';
  const lines = extra
    .filter((it) => it && typeof it.name === 'string' && it.name.trim())
    .map((it) => {
      const priceBit = it.price > 0 ? ` — ₹${it.price}` : '';
      const noteBit = it.notes ? ` (${it.notes})` : '';
      const availBit = it.available ? ` · available ${it.available}` : '';
      return `  • ${it.name}${priceBit}${noteBit}${availBit}`;
    });
  if (lines.length === 0) return '';
  return `ADDITIONAL ITEMS (from inventory dashboard):\n${lines.join('\n')}\n\nThese are live items you can offer customers. Live stock is appended to your prompt at message time — when you see "OUT OF STOCK" or "NOT AVAILABLE RIGHT NOW", refuse the order politely.`;
}

function buildBasePrompt(config: ClientConfig): string {
  // Owner's call number vs the WhatsApp bot number are two DIFFERENT things.
  // `whatsappNumber` is what customers MESSAGE (the bot itself); the bot
  // should never tell a customer to call its own line. `contactNumber` is
  // the owner's personal phone captured during onboarding. Fall back to
  // whatsappNumber only when contactNumber wasn't captured (legacy bots).
  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;
  return `You are the AI WhatsApp assistant for ${config.businessName}.
Owner: ${config.ownerName}
Location: ${config.address}, ${config.city}
Working Hours: ${config.workingHours}
Contact: ${ownerCallNumber}

LANGUAGE RULES (CRITICAL — follow strictly, do not improvise):
- DEFAULT REPLY LANGUAGE: English. Use English whenever the customer's
  language is ambiguous, unclear, or matches English. The customer's
  very first message determines the language for the rest of the chat
  — once you've matched it, stay in it unless they switch.
- AUTO-DETECT the customer's language and match their style EXACTLY:
  • Pure English (only English words, no transliterated Hindi like
    "kya", "hai", "namaste", "bhai", "kaise", "haan", "nahi", "aap",
    "ji") → reply in pure English. Do NOT switch to Hinglish to "sound
    friendly".
  • Hinglish (transliterated Hindi mixed with English) → reply in
    Hinglish, matching their casual register.
  • Pure Hindi (Devanagari script) → reply in pure Hindi.
  • Any other Indian language you can confidently identify (Tamil,
    Telugu, Bengali, Marathi, Gujarati, Punjabi, Kannada, Malayalam,
    etc.) → reply in that language. If you're not sure, fall back to
    English.
- Do NOT mix two languages in one reply unless the customer is mixing
  them. Match their register exactly.
- This rule OVERRIDES every example template later in this prompt — if
  a template is written in Hindi or Hinglish but the customer is
  writing in pure English, TRANSLATE the template's MEANING into pure
  English before sending. Templates carry intent, not exact wording.

PERSONALITY:
- Be friendly, helpful, and professional but NOT robotic.
- Sound like a helpful human assistant, not a corporate chatbot.
- Use emojis naturally but not excessively (1-2 per message max).
- Address customers respectfully (aap, ji, sir/ma'am as appropriate).

${config.welcomeMessage ? `WELCOME MESSAGE TEMPLATE: "${config.welcomeMessage}"
- When a customer messages for the first time (no prior conversation history), open with this welcome.
- TRANSLATE the welcome into the PRIMARY language above before sending. The template captures the *meaning* — match the tone/wording of the customer's language, not the literal English (or whichever language the template happens to be in).
- Keep the brand name and any phone numbers/UPI IDs unchanged. Translate only the natural-language parts.` : `WELCOME MESSAGE: When a customer messages for the first time, greet them warmly in the PRIMARY language above. Mention "${config.businessName}" by name, and ask how you can help. Keep it under 2 short lines.`}

${config.additionalInfo ? `ADDITIONAL CONTEXT: ${config.additionalInfo}` : ''}`;
}

function buildTypeSpecificPrompt(config: ClientConfig): string {
  switch (config.type) {
    case 'restaurant':
      return buildRestaurantPrompt(config);
    case 'coaching':
      return buildCoachingPrompt(config);
    case 'realestate':
      return buildRealEstatePrompt(config);
    case 'salon':
      return buildSalonPrompt(config);
    case 'd2c':
      return buildD2CPrompt(config);
    case 'gym':
      return buildGymPrompt(config);
    case 'tiffin':
      return buildTiffinPrompt(config);
    case 'ecommerce':
      return buildEcommercePrompt(config);
    case 'grocery':
      return buildGroceryPrompt(config);
    default: {
      // Defensive: prevents the switch from silently returning `undefined`
      // when a legacy/unsupported type (e.g., "clinic") leaks past upstream
      // validation. Surfaces the bug loudly in logs instead of producing a
      // silent wrong-vertical bot. Creation paths (onboard, create-client,
      // PATCH /api/clients/[id]) already reject these values, so this only
      // fires for legacy rows that pre-date the validation.
      const stray = (config as { type?: string }).type;
      console.error(
        `[prompt-generator] unsupported business type "${stray}" — admin must update this client's type via /admin/clients/[id] (Business Type card).`
      );
      return `(This bot's business type ("${stray}") is not supported. The owner must update the bot configuration before this bot can answer correctly.)`;
    }
  }
}

function buildRestaurantPrompt(config: Extract<ClientConfig, { type: 'restaurant' }>): string {
  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;

  // Sub-type tone — bot speaks differently to a fine-dine vs dhaba customer.
  const subTypeLabel: Record<string, string> = {
    'dine-in-family': 'Family restaurant',
    'fine-dine': 'Fine-dine restaurant',
    qsr: 'Quick-service restaurant (QSR)',
    'cloud-kitchen-single': 'Cloud kitchen (single brand)',
    'cloud-kitchen-multi-brand': 'Cloud kitchen (multi-brand)',
    dhaba: 'Dhaba',
    'food-truck': 'Food truck',
    'sweet-shop': 'Mithai / sweet shop',
    bakery: 'Bakery',
    'eggless-bakery': 'Eggless bakery',
    'custom-cake-studio': 'Custom cake studio',
    'ice-cream-parlour': 'Ice-cream parlour',
    'juice-bar': 'Juice bar',
    'chai-tapri': 'Chai tapri',
    cafe: 'Cafe',
    'pure-veg': 'Pure-veg restaurant',
    'jain-only': 'Jain-only restaurant',
    'halal-certified': 'Halal-certified restaurant',
    'regional-specialty': 'Regional-specialty restaurant',
    'tiffin-attached': 'Restaurant + tiffin service',
  };
  const subs = getSubTypes(config);
  const subTypeName = subs.length > 0
    ? subs.map((s) => subTypeLabel[s] || s).filter(Boolean).join(' + ')
    : 'Restaurant / Food Business';

  // Render menu with the new structured per-item fields.
  const totalItems = (config.menuCategories || []).reduce((n, c) => n + (c.items?.length || 0), 0);
  const menuText = totalItems > 0
    ? (config.menuCategories || [])
        .map((cat) => {
          const items = (cat.items || [])
            .map((item) => {
              const foodTypeLabel = item.foodType === 'egg' ? '🟡 Egg' : item.foodType === 'non-veg' || !item.isVeg ? '🔴 Non-Veg' : '🟢 Veg';
              const tags: string[] = [foodTypeLabel];
              if (item.isBestseller) tags.push('⭐ Bestseller');
              if (item.isJainCompatible) tags.push('🟡 Jain');
              if (item.spiceLevel === 'spicy' || item.spiceLevel === 'extra-spicy') tags.push('🌶️ ' + item.spiceLevel);

              // Variants — small/medium/large or 250g/500g/1kg
              const variantLine = item.weightVariants && item.weightVariants.length > 0
                ? `\n    Variants: ${item.weightVariants.map((v) => `${v.label} ${v.price}`).join(' · ')}`
                : '';
              // Allergens — FSSAI-style disclosure
              const allergenLine = item.allergens && item.allergens.length > 0
                ? `\n    ⚠️ Contains: ${item.allergens.join(', ')}`
                : '';
              // Calories
              const calLine = typeof item.caloriesKcal === 'number'
                ? ` (${item.caloriesKcal} kcal)`
                : '';
              // Time-window restriction
              const timeLine = item.availableTimeWindow
                ? `\n    Available: ${item.availableTimeWindow.start}–${item.availableTimeWindow.end}`
                : '';
              const dayLine = item.availableDays && item.availableDays.length > 0 && item.availableDays.length < 7
                ? `\n    Days: ${item.availableDays.join(', ')}`
                : '';
              // Aggregator price differential — owner pays Zomato/Swiggy a cut
              const aggLine = item.aggregatorPriceOverride
                ? `\n    On Swiggy/Zomato: ${[
                    item.aggregatorPriceOverride.swiggy ? `Swiggy ${item.aggregatorPriceOverride.swiggy}` : '',
                    item.aggregatorPriceOverride.zomato ? `Zomato ${item.aggregatorPriceOverride.zomato}` : '',
                  ].filter(Boolean).join(' · ')}`
                : '';

              return `  • ${item.name} - ${item.price}${calLine} ${tags.join(' ')}\n    ${item.description}${variantLine}${allergenLine}${timeLine}${dayLine}${aggLine}`;
            })
            .join('\n');
          return `*${cat.category}*\n${items}`;
        })
        .join('\n\n')
    : `(none — there are currently NO menu items configured for this restaurant)

CRITICAL: If earlier messages in this conversation mentioned specific dishes by name, prices, or descriptions, those items have been removed and are NO LONGER on the menu. Do NOT repeat them, do NOT confirm orders for them, and do NOT quote their prices. If the customer asks for the menu, tell them politely the menu is being updated and to contact the owner directly.`;

  // Cloud-kitchen multi-brand — list each brand
  const brandsBlock = (config.brands || []).filter((b) => b.name?.trim()).length > 0
    ? `\n\nBRAND-FRONTS UNDER THIS KITCHEN:\n${(config.brands || [])
        .map((b) => {
          const links = [
            b.zomatoUrl ? `Zomato: ${b.zomatoUrl}` : '',
            b.swiggyUrl ? `Swiggy: ${b.swiggyUrl}` : '',
          ].filter(Boolean).join(' · ');
          return `- *${b.name}* (${b.cuisineType || 'cuisine not specified'})${b.bestsellerItems ? ` · bestsellers: ${b.bestsellerItems}` : ''}${links ? `\n  ${links}` : ''}`;
        })
        .join('\n')}`
    : '';

  // Service modes
  const modes = config.serviceModes || ['dine_in', 'delivery'];
  const modeLine = modes.length > 0
    ? `SERVICE MODES: ${modes.join(', ').replace(/_/g, ' ')}`
    : '';

  // Service windows — bot uses to refuse out-of-hour orders
  const windows: string[] = [];
  if (config.serviceBreakfastWindow) windows.push(`Breakfast: ${config.serviceBreakfastWindow}`);
  if (config.serviceLunchWindow) windows.push(`Lunch: ${config.serviceLunchWindow}`);
  if (config.serviceSnacksWindow) windows.push(`Snacks: ${config.serviceSnacksWindow}`);
  if (config.serviceDinnerWindow) windows.push(`Dinner: ${config.serviceDinnerWindow}`);
  if (config.serviceLateNightWindow) windows.push(`Late-night: ${config.serviceLateNightWindow}`);
  const windowsLine = windows.length > 0 ? `SERVICE WINDOWS:\n  ${windows.join('\n  ')}` : '';

  // Delivery
  const deliveryBlock = config.deliveryAvailable
    ? [
        `DELIVERY: Available within ${config.deliveryRadius || '(radius not specified)'}`,
        config.deliveryCharges ? `Delivery Charges: ${config.deliveryCharges}` : '',
        config.minimumOrder ? `Minimum Order: ${config.minimumOrder}` : '',
        (config.deliveryPartners || []).length > 0
          ? `Delivery partners: ${(config.deliveryPartners || []).join(', ')}`
          : '',
        config.packagingChargesPerOrder ? `Packaging (per order): ${config.packagingChargesPerOrder}` : '',
        config.packagingChargesPerItem ? `Packaging (per item): ${config.packagingChargesPerItem}` : '',
      ].filter(Boolean).join('\n')
    : 'DELIVERY: Not available — dine-in / takeaway only';

  // Surge — only print if any non-zero
  const surgeLines: string[] = [];
  if (config.rainSurchargePercent) surgeLines.push(`Rain: +${config.rainSurchargePercent}%`);
  if (config.peakHourSurchargePercent) surgeLines.push(`Peak hour: +${config.peakHourSurchargePercent}%`);
  if (config.festivalSurchargePercent) surgeLines.push(`Festival: +${config.festivalSurchargePercent}%`);
  const surgeLine = surgeLines.length > 0 ? `SURGE PRICING: ${surgeLines.join(' · ')}` : '';

  // Table booking
  const tableBlock = config.tableBookingEnabled
    ? `TABLE BOOKING: Enabled${
        config.tableMinPartySize || config.tableMaxPartySize
          ? ` · party size ${config.tableMinPartySize || '?'}-${config.tableMaxPartySize || '?'}`
          : ''
      }${
        config.tableAdvanceBookingDays
          ? ` · book up to ${config.tableAdvanceBookingDays} days ahead`
          : ''
      }${
        config.tableDepositRequired ? ` · deposit ${config.tableDepositRequired}` : ''
      }`
    : '';

  // Bulk / corporate
  const bulkBlock = config.bulkOrdersEnabled
    ? `BULK / CORPORATE ORDERS: Yes${
        config.bulkOrdersMinPax ? ` (min ${config.bulkOrdersMinPax} pax)` : ''
      }${
        config.bulkOrdersContactNumber ? ` · contact ${config.bulkOrdersContactNumber}` : ''
      }${
        config.bulkOrdersInvoiceWithGst ? ' · GST invoice on request' : ''
      }`
    : '';

  // Sub-type extras
  const subExtras: string[] = [];
  if ((subs.includes('custom-cake-studio') || subs.includes('bakery') || subs.includes('eggless-bakery')) && (config.customCakeLeadTimeHours || config.customCakeAdvanceDepositPercent || config.customCakeEgglessAvailable !== undefined || config.customCakePhotoOnCake)) {
    const parts: string[] = [];
    if (config.customCakeLeadTimeHours) parts.push(`lead time ${config.customCakeLeadTimeHours} hrs`);
    if (config.customCakeAdvanceDepositPercent) parts.push(`${config.customCakeAdvanceDepositPercent}% advance`);
    if (config.customCakeEgglessAvailable) parts.push('eggless option');
    if (config.customCakePhotoOnCake) parts.push('photo-on-cake supported');
    subExtras.push(`CUSTOM CAKE: ${parts.join(' · ')}`);
  }
  if (subs.includes('ice-cream-parlour')) {
    const parts: string[] = [];
    if (config.iceCreamSellsTubs) parts.push('tubs (take-home)');
    if (config.iceCreamSellsScoops) parts.push('scoops (in-store)');
    if (config.iceCreamFlavorOfTheDay) parts.push(`flavour of the day: ${config.iceCreamFlavorOfTheDay}`);
    if (parts.length) subExtras.push(`ICE CREAM: ${parts.join(' · ')}`);
  }
  if (subs.includes('juice-bar')) {
    const parts: string[] = [];
    if (config.juiceFruitOfTheDay) parts.push(`fruit of the day: ${config.juiceFruitOfTheDay}`);
    if (config.juiceColdPressedAvailable) parts.push('cold-pressed available');
    if (parts.length) subExtras.push(`JUICE BAR: ${parts.join(' · ')}`);
  }
  if (subs.includes('sweet-shop')) {
    const parts: string[] = [];
    if (config.mithaiFestivalGiftBoxes) parts.push(`festival gift boxes: ${config.mithaiFestivalGiftBoxes}`);
    if (config.mithaiInterstateShipping) parts.push('interstate cold-chain shipping');
    if (parts.length) subExtras.push(`MITHAI: ${parts.join(' · ')}`);
  }

  // Compliance line
  const complianceLines: string[] = [];
  if (config.fssaiLicenseNumber) {
    complianceLines.push(`FSSAI: ${config.fssaiLicenseNumber}${config.fssaiExpiryDate ? ` (expires ${config.fssaiExpiryDate})` : ''}`);
  } else {
    complianceLines.push(`FSSAI: not yet provided`);
  }
  if (config.gstin) complianceLines.push(`GSTIN: ${config.gstin}`);
  if (config.halalCertified) complianceLines.push(`Halal-certified${config.halalCertNumber ? ` (${config.halalCertNumber})` : ''}`);
  if (config.jainCertified) complianceLines.push('Jain-certified menu');
  if (config.servesAlcohol) complianceLines.push(`Alcohol licence on file: ${config.alcoholLicenseNumber || '(number on file)'} — bot must NOT promote or take alcohol orders`);

  // Quality claims — bot can quote ONLY if owner explicitly enabled
  const claims: string[] = [];
  if (config.noPreservativesClaim) claims.push('no preservatives');
  if (config.noMsgClaim) claims.push('no MSG / Ajinomoto');

  // Pure-veg disclosure
  const pureVegLine = config.pureVeg !== undefined
    ? config.pureVeg
      ? 'PURE-VEG kitchen — no non-veg cooked here.'
      : config.sharedKitchenWithNonVeg === false
        ? 'Mixed kitchen — veg cooked in a SEPARATE pan from non-veg.'
        : 'Mixed kitchen — veg may be cooked in a SHARED pan with non-veg. Disclose this when asked.'
    : '';

  return `BUSINESS TYPE: ${subTypeName}
CUISINE: ${config.cuisineType}
${modeLine}
${pureVegLine}
${brandsBlock}

FULL MENU (AUTHORITATIVE — overrides any earlier message in this chat):
${menuText}

${windowsLine}

${deliveryBlock}

PAYMENT METHODS: ${(config.paymentMethods || []).join(', ')}
${config.specialOffers ? `CURRENT OFFERS: ${config.specialOffers}` : ''}
${config.zomatoSwiggyLinks ? `ORDER ONLINE: ${config.zomatoSwiggyLinks}` : ''}

${tableBlock}
${surgeLine}
${bulkBlock}
${subExtras.join('\n')}

COMPLIANCE:
${complianceLines.map((l) => `- ${l}`).join('\n')}

${claims.length > 0 ? `TRUTHFUL CLAIMS the bot may make: ${claims.join(', ')}.` : 'NO special quality claims set — do NOT promise "no preservatives" / "no MSG" / "fresh" unless the menu item description says so.'}

STRICT RULES FOR RESTAURANT BOT:
- When sharing the menu, format it nicely using WhatsApp formatting (*bold* for category names).
- Always confirm order details (items, quantity, address, time) before saying "order placed".
- Never guarantee exact delivery times — say "approximately ${config.deliveryRadius ? '30-45 min' : 'check with kitchen'}".
- For allergen questions: if the item has an allergen tag in the menu above, share it. Otherwise communicate (in customer's language) "Please confirm with the kitchen directly — I want to be safe with allergens."
- For Jain queries: ${config.jainCertified ? 'we have a Jain-certified menu.' : 'we are NOT Jain-certified; the kitchen handles onion/garlic.'}
- For halal queries: ${config.halalCertified ? 'we are halal-certified.' : 'we are NOT halal-certified — be honest if asked.'}
- For pure-veg queries: ${config.pureVeg ? 'this is a pure-veg kitchen.' : 'this kitchen ALSO cooks non-veg. Disclose this honestly when asked.'}
- For peak/rain/festival: if surge pricing is enabled and conditions match, mention "delivery charge may be higher than the standard amount during peak hours / rain / festivals".
- For table booking: ${config.tableBookingEnabled ? `take reservation requests; party size ${config.tableMinPartySize || '?'}-${config.tableMaxPartySize || '?'}.` : 'table reservations not handled via WhatsApp — ask customer to call.'}
- For bulk / corporate orders: ${config.bulkOrdersEnabled ? `route to ${config.bulkOrdersContactNumber || 'owner'}; min ${config.bulkOrdersMinPax || 30} pax.` : 'we do not currently take bulk corporate orders.'}
- ALCOHOL: ${config.servesAlcohol ? 'NEVER promote, suggest, or take orders for alcohol via WhatsApp (Meta Commerce Policy). If asked, decline politely and direct customer to dine-in only.' : 'we do not serve alcohol.'}
- Aggregator price differential: when an item has a different Swiggy/Zomato price, prefer the direct-WhatsApp price for orders placed here.
- For complaints (cold food, missing items, late delivery), ESCALATE: "I'll connect you with ${config.ownerName}. Please call ${ownerCallNumber}."
- Indian customers often message in Hindi/Hinglish. Match their language EXACTLY per the LANGUAGE RULES at the top.`;
}

function buildCoachingPrompt(config: Extract<ClientConfig, { type: 'coaching' }>): string {
  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;

  const subTypeLabel: Record<string, string> = {
    'school-tuition-primary': 'School tuition (primary classes)',
    'school-tuition-middle': 'School tuition (middle classes)',
    'board-prep': 'Board exam prep (10/12)',
    'jee-main': 'JEE Main coaching',
    'jee-advanced': 'JEE Advanced coaching',
    'neet-ug': 'NEET UG coaching',
    'cat-mba': 'CAT / MBA coaching',
    'upsc': 'UPSC coaching',
    'state-pcs': 'State PCS coaching',
    'ssc-banking-railway': 'SSC / Banking / Railway coaching',
    'ca-cs-cma': 'CA / CS / CMA coaching',
    'gate-psu': 'GATE / PSU coaching',
    'clat-law': 'CLAT / Law coaching',
    'nift-nid-ceed': 'NIFT / NID / CEED coaching',
    'foreign-language': 'Foreign language institute',
    'overseas-test-prep': 'Overseas test-prep (IELTS/SAT/GRE/GMAT)',
    'coding-bootcamp': 'Coding bootcamp',
    'coding-kids': 'Coding for kids',
    'abacus-vedic': 'Abacus / Vedic math academy',
    'chess': 'Chess academy',
    'music': 'Music school',
    'dance': 'Dance academy',
    'art-calligraphy': 'Art / calligraphy studio',
    'robotics-stem': 'Robotics / STEM lab',
    'public-speaking': 'Public-speaking academy',
  };
  const subs = getSubTypes(config);
  const subTypeName = subs.length > 0
    ? subs.map((s) => subTypeLabel[s] || s).filter(Boolean).join(' + ')
    : 'Coaching Center / Educational Institute';

  const isUnder18Audience = subs.some((s) => ['school-tuition-primary', 'school-tuition-middle', 'board-prep', 'coding-kids', 'jee-main', 'jee-advanced', 'neet-ug', 'cat-mba', 'clat-law', 'nift-nid-ceed', 'gate-psu', 'music', 'dance', 'art-calligraphy', 'chess', 'robotics-stem', 'abacus-vedic', 'public-speaking'].includes(s));

  const courses = config.coursesOffered || [];
  const coursesText = courses.length > 0
    ? courses
        .map((c) => {
          const lines: string[] = [`- *${c.name}*`];
          if (c.category) lines.push(`  Category: ${c.category.replace(/_/g, ' ')}`);
          if (c.targetAudience) lines.push(`  Target: ${c.targetAudience}`);
          if (c.targetClass) lines.push(`  Class: ${c.targetClass}`);
          if (c.entranceExam && c.entranceExam.length > 0) lines.push(`  Exams: ${c.entranceExam.join(', ').replace(/_/g, ' ')}`);
          if (c.ageBandMin || c.ageBandMax) lines.push(`  Age: ${c.ageBandMin || '?'}-${c.ageBandMax || '?'}`);
          if (c.duration) lines.push(`  Duration: ${c.duration}`);
          if (c.fee) {
            const breakup: string[] = [];
            if (c.feeBreakupAdmission) breakup.push(`admission ${c.feeBreakupAdmission}`);
            if (c.feeBreakupTuition) breakup.push(`tuition ${c.feeBreakupTuition}`);
            if (c.feeBreakupMaterial) breakup.push(`material ${c.feeBreakupMaterial}`);
            if (c.feeBreakupTech) breakup.push(`tech ${c.feeBreakupTech}`);
            const breakupLine = breakup.length > 0 ? ` (breakup: ${breakup.join(' · ')})` : '';
            const gstLine = c.gstIncludedInFee !== undefined ? `${c.gstIncludedInFee ? ' GST inclusive' : ' GST extra'}` : '';
            lines.push(`  Fee: ${c.fee}${breakupLine}${gstLine}`);
          }
          if (c.schedule) lines.push(`  Schedule: ${c.schedule}`);
          if (typeof c.daysPerWeek === 'number' && typeof c.hoursPerDay === 'number') {
            lines.push(`  Class load: ${c.daysPerWeek} days/week × ${c.hoursPerDay} hours/day${c.weekendBatch ? ' · weekend batch' : ''}`);
          }
          if (c.modes && c.modes.length > 0) lines.push(`  Mode: ${c.modes.join(', ').replace(/_/g, ' ')}`);
          if (typeof c.batchSizeMin === 'number' || typeof c.batchSizeMax === 'number') {
            lines.push(`  Batch size: ${c.batchSizeMin || '?'}-${c.batchSizeMax || '?'} students`);
          }
          if (c.batchStartDate) lines.push(`  Starts: ${c.batchStartDate}`);
          if (c.recordedAccessIncluded) lines.push(`  Recorded access: ${c.recordedAccessDurationMonths || '?'} months included`);
          if (c.certificateIssued) lines.push(`  Certification: ${c.certificateAffiliatedTo || 'institute-issued'}`);
          if (c.fullPaymentAvailable || c.installmentsCount) {
            const pays: string[] = [];
            if (c.fullPaymentAvailable) pays.push('full payment');
            if (c.installmentsCount) pays.push(`${c.installmentsCount} EMI installments`);
            if (c.payAfterPlacementAvailable) pays.push('pay after placement (ISA)');
            lines.push(`  Payment options: ${pays.join(' · ')}`);
          }
          if (!c.category && !c.targetClass && !c.duration) {
            // Legacy course with only mode/schedule — render flat.
            lines.push(`  Mode: ${c.mode}`);
          }
          return lines.join('\n');
        })
        .join('\n\n')
    : `(none — there are currently NO courses configured for this institute)

CRITICAL: If earlier messages mentioned specific course names, fees, batches, or schedules, those courses have been discontinued or removed and are NO LONGER offered. Do NOT repeat them, do NOT quote old fees, and do NOT promise enrolment.`;

  const structuredFaculty = (config.faculty || []).filter((f) => f.name?.trim());
  const facultyBlock = structuredFaculty.length > 0
    ? `FACULTY (use these names, NOT generic "expert teachers", when customer asks):\n${structuredFaculty.map((f) => {
        const parts: string[] = [];
        if (f.subject) parts.push(f.subject);
        if (typeof f.experienceYears === 'number') parts.push(`${f.experienceYears}y exp`);
        if (f.almaMater) parts.push(f.almaMater);
        if (f.pastAffiliations) parts.push(f.pastAffiliations);
        const headTag = f.isHeadOfDepartment ? ' (HoD)' : '';
        const verifiedTag = f.backgroundVerificationStatus === 'verified' ? ' · ✓ background verified' : '';
        return `- *${f.name}*${headTag} — ${parts.join(' · ')}${verifiedTag}`;
      }).join('\n')}`
    : `FACULTY: ${config.facultyInfo || '(not specified — do NOT invent names or credentials)'}`;

  const structuredResults = (config.pastResultsStructured || []).filter((r) => r.examName?.trim());
  const resultsBlock = structuredResults.length > 0
    ? `PAST RESULTS (use ONLY these — do NOT invent ranks):\n${structuredResults.map((r) => {
        const bits: string[] = [`${r.examName} ${r.year || ''}`];
        if (r.totalCleared) bits.push(`${r.totalCleared} qualified`);
        if (r.topRank) bits.push(`Top rank: ${r.topRank}${r.topRankerName ? ` (${r.topRankerName})` : ''}`);
        return `- ${bits.join(' · ')}${r.proofUrl ? ` · proof: ${r.proofUrl}` : ''}`;
      }).join('\n')}`
    : config.results
      ? `RESULTS (free-text, use cautiously): ${config.results}`
      : 'RESULTS: not configured. Do NOT promise specific rank counts or selection numbers.';

  const refundLines: string[] = [];
  if (config.proRataRefundEnabled) {
    refundLines.push(`Pro-rata refund within ${config.refundWindowDays || 10} days of joining (Raj Bill compliant).`);
  }
  if (typeof config.cancellationFeePct === 'number' && config.cancellationFeePct > 0) {
    refundLines.push(`Cancellation fee: ${config.cancellationFeePct}% of paid amount.`);
  }
  if (config.failureRepeatFreeAvailable) refundLines.push('Repeat-year free if student fails after diligent attendance.');
  if (config.lateJoinAllowed) refundLines.push(`Late-join allowed${config.lateJoinProRataApplied ? ' with pro-rated fee' : ''}.`);
  if (config.refundPolicyUrl) refundLines.push(`Full policy: ${config.refundPolicyUrl}`);

  const emiLines: string[] = [];
  if (config.emiDisclosureEnabled) {
    emiLines.push(`EMI / instalments available${(config.emiPartnersList || []).length > 0 ? ` via ${(config.emiPartnersList || []).join(', ')}` : ''}.`);
    if (config.emiAgreementUrl) emiLines.push(`EMI agreement: ${config.emiAgreementUrl}`);
  } else {
    emiLines.push('EMI / instalments: not yet configured.');
  }

  const hostelBlock = config.hostelPGReferralOffered
    ? `\n\nHOSTEL / PG REFERRALS:
- Partners: ${config.hostelPGPartnerNames || '(names on request)'}
- Monthly rate: ${config.hostelPGMonthlyRangeINR || '(varies)'}
${config.hostelPGCommissionDisclosed ? '- IMPORTANT: When sharing the referral link, ALWAYS disclose: "We get a small referral commission from this partner — your decision is yours."' : ''}
${config.hostelPGReferralLink ? `- Link: ${config.hostelPGReferralLink}` : ''}`
    : '';

  const demoLines: string[] = [];
  if (config.demoClassAvailable) {
    demoLines.push(`Demo class: ${config.demoClassPrice && config.demoClassPrice !== '0' ? config.demoClassPrice : 'free'}${config.demoBatchHoldHours ? ` · seat held for ${config.demoBatchHoldHours} hours after demo` : ''}`);
  } else {
    demoLines.push('Demo class: not offered');
  }
  if (config.scholarshipTestEnabled) {
    demoLines.push(`Scholarship test: ${config.scholarshipTestName || 'available'}${config.scholarshipTestSchedule ? ` (${config.scholarshipTestSchedule})` : ''}${typeof config.scholarshipTestMaxWaiverPercent === 'number' ? ` · up to ${config.scholarshipTestMaxWaiverPercent}% fee waiver` : ''}.`);
  }

  const materialLines: string[] = [];
  if (config.studyMaterialMode) {
    const m: Record<string, string> = {
      physical_only: 'Physical books only',
      digital_only: 'Digital portal only',
      both: 'Both physical books + digital portal',
      none_self_arrange: 'Student arranges own books',
    };
    materialLines.push(`Study material: ${m[config.studyMaterialMode]}`);
  }
  if (config.pyqAccessIncluded) materialLines.push('Previous-year-question (PYQ) access included.');
  if (config.mockTestFrequency || config.mockTestsTotalPerCourse) {
    materialLines.push(`Mock tests: ${config.mockTestFrequency || 'periodic'}${config.mockTestsTotalPerCourse ? ` · ${config.mockTestsTotalPerCourse} per course` : ''}${config.aiTSeriesIncluded ? ' · AI-graded series included' : ''}.`);
  }

  const discountLines: string[] = [];
  if (typeof config.siblingDiscountPct === 'number' && config.siblingDiscountPct > 0) discountLines.push(`Sibling discount: ${config.siblingDiscountPct}%`);
  if (typeof config.earlyBirdDiscountPct === 'number' && config.earlyBirdDiscountPct > 0) {
    discountLines.push(`Early bird: ${config.earlyBirdDiscountPct}%${config.earlyBirdDeadline ? ` (deadline ${config.earlyBirdDeadline})` : ''}`);
  }
  if (config.referralBonus?.trim()) discountLines.push(`Referral bonus: ${config.referralBonus}`);
  if (config.scholarshipBasedDiscount) discountLines.push('Scholarship-based discount available.');

  const hobbyLines: string[] = [];
  if (config.instrumentRentalAvailable) hobbyLines.push('Instrument rental available.');
  if (config.materialKitFee) hobbyLines.push(`Material kit fee: ${config.materialKitFee}`);
  if (config.annualFunctionFee) hobbyLines.push(`Annual function fee: ${config.annualFunctionFee}`);
  if (config.arangetramOrRecitalFee) hobbyLines.push(`Recital/Arangetram fee: ${config.arangetramOrRecitalFee}`);
  if (config.externalExamFee) hobbyLines.push(`External exam fee (Trinity / ABRSM / FIDE): ${config.externalExamFee}`);

  const multiLoc = config.multiLocationEnabled && (config.branches || []).filter((b) => b.name?.trim()).length > 0
    ? `\n\nMULTI-CENTRE BRANCHES:\n${(config.branches || [])
        .filter((b) => b.name?.trim())
        .map((b) => `- ${b.name} (${b.city})${b.contactNumber ? ` · ${b.contactNumber}` : ''}${b.address ? `\n  ${b.address}` : ''}`)
        .join('\n')}`
    : '';

  const complianceLines: string[] = [];
  if (config.rajCoachingActRegistered) complianceLines.push(`Rajasthan Coaching Act: registered (${config.rajCoachingActRegNo || 'reg # on file'})`);
  if (config.centralMoeGuidelineCompliant) complianceLines.push('Central MOE Guidelines (Jan 2024) compliant');
  if (config.aicteId) complianceLines.push(`AICTE: ${config.aicteId}`);
  if (typeof config.maxClassHoursPerDay === 'number') complianceLines.push(`Max class hours per day: ${config.maxClassHoursPerDay} (Raj Bill cap is 5)`);
  if (config.mentalHealthCounsellorAvailable) complianceLines.push('Mental-health counsellor available on staff.');
  if (config.gstin) complianceLines.push(`GSTIN: ${config.gstin}`);

  const noRankClaim = config.noFalseRankClaim !== false;
  const minorConsentMissing = isUnder18Audience && !config.minorConsentCollected;

  return `BUSINESS TYPE: ${subTypeName}
INSTITUTE: ${config.instituteName}${config.boardAffiliations && config.boardAffiliations.length > 0 ? `\nBOARDS: ${config.boardAffiliations.join(', ').replace(/StateBoard_/g, '')}` : ''}${config.entranceExamsCovered && config.entranceExamsCovered.length > 0 ? `\nEXAMS COVERED: ${config.entranceExamsCovered.join(', ').replace(/_/g, ' ')}` : ''}

COURSES OFFERED (AUTHORITATIVE — overrides any earlier message in this chat):
${coursesText}

${facultyBlock}

${resultsBlock}

DEMO & ADMISSION:
${demoLines.map((l) => `- ${l}`).join('\n')}
- Admission type: ${config.admissionType || 'open'}
- Process: ${config.admissionProcess || '(not specified)'}
${config.admissionDocumentsRequired ? `- Documents required: ${config.admissionDocumentsRequired}` : ''}

${refundLines.length > 0 ? `REFUND POLICY:\n${refundLines.map((l) => `- ${l}`).join('\n')}` : ''}

PAYMENT:
${emiLines.map((l) => `- ${l}`).join('\n')}${hostelBlock}

${materialLines.length > 0 ? `STUDY MATERIAL:\n${materialLines.map((l) => `- ${l}`).join('\n')}` : ''}

${discountLines.length > 0 ? `DISCOUNTS:\n${discountLines.map((l) => `- ${l}`).join('\n')}` : ''}

${hobbyLines.length > 0 ? `EXTRAS:\n${hobbyLines.map((l) => `- ${l}`).join('\n')}` : ''}${multiLoc}

${complianceLines.length > 0 ? `COMPLIANCE:\n${complianceLines.map((l) => `- ${l}`).join('\n')}` : ''}

STRICT RULES FOR COACHING BOT:
${noRankClaim ? `- HARD BLOCK: NEVER use phrases like "guaranteed selection", "100% selection", "top rank pakka", "AIR 1 hamare paas", "definitely will crack [exam]". Rajasthan Coaching Centres Act prohibits guaranteed-rank advertising — using these will get the WABA flagged.
- When asked "kitna selection rate hai?", quote ONLY from the PAST RESULTS section above (with year + proof URL). Do NOT extrapolate or promise.` : ''}
${minorConsentMissing ? `- DPDPA SECTION 9 BLOCK: This institute targets students likely under 18 but the verifiable parental-consent flow is NOT set up. When a student under 18 asks to enrol, FIRST ask: "Aap 18 saal se kam ho? Toh apne parents ka WhatsApp number share karo, hum unko approve karne ke liye message karenge." Do NOT capture address / personal details from a minor without parent confirmation.` : ''}
- Always encourage parents/students to attend a demo class first — that's the conversion lever.
- Share course details and fees openly. Use the structured FEE BREAKUP if asked "kya fees mein kya included hai?".
- Highlight specific past results (with year) and named faculty when asked — never invent.
${config.hostelPGCommissionDisclosed ? '- When sharing hostel/PG referral link, ALWAYS disclose the commission ("hum partner se ek small commission lete hain").' : ''}
- For EMI questions, if EMI is enabled share the partner names + agreement URL. NEVER promise approval — that is the lender\'s decision.
- For specific academic doubts (e.g. "is question ka answer kya hai?"), redirect to demo class or doubt-clearing portal — bot is NOT a tutor.
- For complaints (faculty changed, batch shifted, refund disputed), ESCALATE: "I'll connect you with ${config.ownerName}. Please call ${ownerCallNumber}."
- Indian customers (often parents) message in Hindi/Hinglish. Match their language EXACTLY per the LANGUAGE RULES at the top.`;
}

function buildRealEstatePrompt(config: Extract<ClientConfig, { type: 'realestate' }>): string {
  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;

  const subTypeLabel: Record<string, string> = {
    'solo-broker-rental': 'Solo broker (rental focus)',
    'broker-firm-5-50': 'Broker firm',
    'builder-developer': 'Builder / developer',
    'channel-partner-agency': 'Channel-partner agency',
    'commercial-only': 'Commercial real estate broker',
    'nri-focused': 'NRI-focused broker',
    'pg-aggregator': 'PG aggregator',
    'co-living-operator': 'Co-living operator',
    'short-term-rental': 'Short-term / Airbnb operator',
    'plot-and-land': 'Plot &amp; land specialist',
    'farmhouse-villa': 'Farmhouse / villa broker',
    'luxury-5cr-plus': 'Luxury (>₹5 Cr) broker',
    'industrial-warehouse': 'Industrial / warehouse broker',
    'property-management': 'Property-management firm',
    'home-loan-dsa': 'Home loan DSA',
    'redevelopment-specialist': 'Redevelopment specialist',
    'resale-only': 'Resale-only broker',
    'affordable-pmay-dsa': 'Affordable / PMAY DSA',
  };
  const subs = getSubTypes(config);
  const subTypeName = subs.length > 0
    ? subs.map((s) => subTypeLabel[s] || s).filter(Boolean).join(' + ')
    : 'Real Estate';

  const isBuilder = subs.includes('builder-developer') || subs.includes('channel-partner-agency');
  const isPG = subs.includes('pg-aggregator') || subs.includes('co-living-operator');
  const isNRI = subs.includes('nri-focused');
  const isRedev = subs.includes('redevelopment-specialist');

  // Listings rendering with the new RERA + carpet/built-up structured fields
  const listings = config.currentListings || [];
  const listingsText = listings.length > 0
    ? listings
        .map((l) => {
          const lines: string[] = [`- *${l.title}*`];
          if (l.configuration) lines.push(`  Configuration: ${l.configuration}`);
          if (l.type) lines.push(`  Type: ${l.type}`);
          if (l.price) {
            const psqft = l.pricePerSqft ? ` · ${l.pricePerSqft}/sqft` : '';
            const basis = l.priceBasis ? ` (priced on ${l.priceBasis.replace(/_/g, ' ')})` : '';
            lines.push(`  Price: ${l.price}${psqft}${basis}`);
          }
          // RERA-mandated triple disclosure
          const areaParts: string[] = [];
          if (l.carpetAreaSqft) areaParts.push(`carpet ${l.carpetAreaSqft} sqft`);
          if (l.builtUpAreaSqft) areaParts.push(`built-up ${l.builtUpAreaSqft} sqft`);
          if (l.superBuiltUpAreaSqft) areaParts.push(`super built-up ${l.superBuiltUpAreaSqft} sqft`);
          if (typeof l.loadingFactorPct === 'number') areaParts.push(`loading ${l.loadingFactorPct}%`);
          if (areaParts.length > 0) lines.push(`  Area: ${areaParts.join(' · ')}`);
          else if (l.area) lines.push(`  Area: ${l.area}`);
          if (l.reraNumber) lines.push(`  RERA: ${l.reraNumber}${l.reraQrUrl ? ` · QR ${l.reraQrUrl}` : ''}`);
          else lines.push(`  RERA: ⚠️ NOT YET PROVIDED — bot will refuse to share this listing without RERA`);
          if (l.possessionDate) lines.push(`  Possession: ${l.possessionDate}`);
          if (l.ocStatus) lines.push(`  OC: ${l.ocStatus.replace(/_/g, ' ')}`);
          if (l.ccStatus) lines.push(`  CC: ${l.ccStatus}`);
          if (l.khataAOrB && l.khataAOrB !== 'na') lines.push(`  Khata: ${l.khataAOrB}-Khata ${l.khataAOrB === 'B' ? '(blocks bank loans — disclose)' : '(loan-eligible)'}`);
          if (typeof l.parkingCount === 'number') lines.push(`  Parking: ${l.parkingCount} ${l.parkingType || ''}`);
          if (l.facing) lines.push(`  Facing: ${l.facing}`);
          if (l.vastuCompliant) lines.push(`  Vastu: compliant`);
          if (l.floorRange) lines.push(`  Floor: ${l.floorRange}`);
          if (typeof l.unitsAvailable === 'number') lines.push(`  Units available: ${l.unitsAvailable}`);
          if (l.furnishingStatus) lines.push(`  Furnishing: ${l.furnishingStatus.replace(/_/g, ' ')}`);
          if (l.brochureUrl) lines.push(`  Brochure: ${l.brochureUrl}`);
          if (l.walkthroughVideoUrl) lines.push(`  Walkthrough: ${l.walkthroughVideoUrl}`);
          if (l.highlights) lines.push(`  Highlights: ${l.highlights}`);
          return lines.join('\n');
        })
        .join('\n\n')
    : `(none — there are currently NO active property listings)

CRITICAL: If earlier messages named specific properties, prices, areas, or highlights, those listings are SOLD or REMOVED and are NO LONGER available. Do NOT repeat them, do NOT quote old prices, and do NOT schedule site visits for them.`;

  // Builder projects block
  const projects = (config.builderProjects || []).filter((p) => p.name?.trim());
  const projectsBlock = projects.length > 0
    ? `\n\nBUILDER PROJECTS (each carries its own RERA — share that PER project):
${projects.map((p) => {
  const lines: string[] = [`- *${p.name}* by ${p.developerName}`];
  lines.push(`  RERA: ${p.reraNumber}${p.reraQrUrl ? ` · QR ${p.reraQrUrl}` : ''}${p.reraExpiryDate ? ` · expires ${p.reraExpiryDate}` : ''}`);
  if (p.projectType) lines.push(`  Type: ${p.projectType}`);
  if (p.possessionDate) lines.push(`  Possession: ${p.possessionDate}${p.actualHandoverEstimate ? ` (current estimate ${p.actualHandoverEstimate})` : ''}`);
  if (p.ocStatus) lines.push(`  OC: ${p.ocStatus.replace(/_/g, ' ')}${p.ocDate ? ` (${p.ocDate})` : ''}`);
  if (p.totalUnits || p.totalTowers) lines.push(`  Scale: ${p.totalUnits || '?'} units · ${p.totalTowers || '?'} towers`);
  if (p.configurationsAvailable) lines.push(`  Configurations: ${p.configurationsAvailable}`);
  if (p.amenities) lines.push(`  Amenities: ${p.amenities}`);
  const distances: string[] = [];
  if (p.distanceMetro) distances.push(`metro ${p.distanceMetro}`);
  if (p.distanceSchool) distances.push(`school ${p.distanceSchool}`);
  if (p.distanceAirport) distances.push(`airport ${p.distanceAirport}`);
  if (p.distanceItPark) distances.push(`IT park ${p.distanceItPark}`);
  if (distances.length > 0) lines.push(`  Distance: ${distances.join(' · ')}`);
  if (p.gatedCommunity) lines.push(`  Gated community`);
  if (p.societyMaintenancePerSqft) lines.push(`  Maintenance: ${p.societyMaintenancePerSqft}/sqft/month`);
  if (p.approvedByBanks) lines.push(`  Bank-approved: ${p.approvedByBanks}`);
  if (p.brochureUrl) lines.push(`  Brochure: ${p.brochureUrl}`);
  if (p.walkthroughVideoUrl) lines.push(`  Walkthrough: ${p.walkthroughVideoUrl}`);
  return lines.join('\n');
}).join('\n\n')}`
    : '';

  // Legal documentation services
  const docServices: string[] = [];
  if (config.ocSupportAvailable) docServices.push('OC support');
  if (config.ccSupportAvailable) docServices.push('CC support');
  if (config.encumbranceCertSupport) docServices.push('Encumbrance Certificate');
  if (config.saleDeedDraftingSupport) docServices.push('Sale-deed drafting');
  if (config.khataExpertiseBangalore) docServices.push('Bangalore A/B Khata expertise');
  if (config.vastuConsultantAvailable) docServices.push('Vastu consultant');

  // Rental policy
  const rentalLines: string[] = [];
  const cityDeposits: string[] = [];
  if (typeof config.rentalDepositMonthsBLR === 'number') cityDeposits.push(`Bangalore ${config.rentalDepositMonthsBLR} months`);
  if (typeof config.rentalDepositMonthsMUM === 'number') cityDeposits.push(`Mumbai ${config.rentalDepositMonthsMUM}`);
  if (typeof config.rentalDepositMonthsDEL === 'number') cityDeposits.push(`Delhi ${config.rentalDepositMonthsDEL}`);
  if (typeof config.rentalDepositMonthsPUN === 'number') cityDeposits.push(`Pune ${config.rentalDepositMonthsPUN}`);
  if (typeof config.rentalDepositMonthsHYD === 'number') cityDeposits.push(`Hyderabad ${config.rentalDepositMonthsHYD}`);
  if (typeof config.rentalDepositMonthsCHE === 'number') cityDeposits.push(`Chennai ${config.rentalDepositMonthsCHE}`);
  if (cityDeposits.length > 0) rentalLines.push(`Deposit norms: ${cityDeposits.join(' · ')}`);
  if (typeof config.rentalLockInMonths === 'number') rentalLines.push(`Lock-in: ${config.rentalLockInMonths} months`);
  if (config.rentalNoticePeriodMonths) rentalLines.push(`Notice: ${config.rentalNoticePeriodMonths} month(s)`);
  if (config.rentalPetsAllowed) rentalLines.push(`Pets: ${config.rentalPetsAllowed.replace(/_/g, ' ')}`);
  if (config.rentalFurnishingDefault) rentalLines.push(`Furnishing default: ${config.rentalFurnishingDefault.replace(/_/g, ' ')}`);
  if ((config.rentalTenantPreference || []).length > 0) rentalLines.push(`Tenant preference: ${(config.rentalTenantPreference || []).join(', ').replace(/_/g, ' ')}`);
  if (config.rentalAgreementType) rentalLines.push(`Agreement: ${config.rentalAgreementType.replace(/_/g, ' ')}`);

  // PG / co-living
  const pgLines: string[] = [];
  if (isPG && (config.pgSharingTypes || []).length > 0) pgLines.push(`Sharing types: ${(config.pgSharingTypes || []).join(', ').replace(/_/g, ' ')}`);
  if (isPG && config.pgGenderPolicy) pgLines.push(`Gender: ${config.pgGenderPolicy.replace(/_/g, ' ')}`);
  if (isPG && config.pgFoodIncluded) pgLines.push(`Food: ${config.pgMealsPerDay || '?'} meals/day · ${config.pgFoodType || 'mixed'}`);
  if (isPG && config.pgElectricityBilling) pgLines.push(`Electricity: ${config.pgElectricityBilling.replace(/_/g, ' ')}`);
  if (isPG && config.pgExitFeeInr) pgLines.push(`Exit fee: ${config.pgExitFeeInr}${config.pgExitFeeWaiverMonths ? ` (waived after ${config.pgExitFeeWaiverMonths} months)` : ''}`);
  if (isPG && config.pgNoticePeriodDays) pgLines.push(`Notice: ${config.pgNoticePeriodDays} days`);
  if (isPG && config.pgInAppMaintenance) pgLines.push('In-app maintenance');
  if (isPG && config.pgGroAvailable) pgLines.push('Grievance Redressal Officer on staff');
  if (isPG && config.pgAmenitiesIncluded) pgLines.push(`Amenities: ${config.pgAmenitiesIncluded}`);

  // NRI support
  const nriLines: string[] = [];
  if (isNRI && config.nriSupportEnabled) {
    if (config.nriCountriesServed) nriLines.push(`Countries: ${config.nriCountriesServed}`);
    if ((config.nriCurrencyDisplay || []).length > 0) nriLines.push(`Currency display: ${(config.nriCurrencyDisplay || []).join(', ')}`);
    if (config.nriPoaSupportEnabled) nriLines.push('Power of Attorney support');
    if (config.nriVideoSiteVisit) nriLines.push('Video site visits');
    if (config.nriFcnrNreNroAdvisory) nriLines.push('FCNR / NRE / NRO advisory (advisory only)');
    if (config.nriTdsAdvisoryOnly) nriLines.push('TDS advisory only — bot must direct customer to verify with their CA');
    if (config.nriRepatriationAdvisoryOnly) nriLines.push('Repatriation advisory only — verify with banker');
  }

  // Redevelopment
  const redevLines: string[] = [];
  if (isRedev) {
    if ((config.redevelopmentCityScope || []).length > 0) redevLines.push(`City scope: ${(config.redevelopmentCityScope || []).join(', ')}`);
    if ((config.redevelopmentSocietyTypes || []).length > 0) redevLines.push(`Society types: ${(config.redevelopmentSocietyTypes || []).join(', ').replace(/_/g, ' ')}`);
    if (config.redevelopmentPaaaSupported) redevLines.push('PAAA (Permanent Alternate Accommodation Agreement) negotiation');
    if (config.redevelopmentFsiTdrAdvisory) redevLines.push('FSI / TDR advisory');
    if (config.redevelopmentTransitRentNegotiation) redevLines.push('Transit-rent negotiation with builder');
    if (config.redevelopmentCorpusNegotiation) redevLines.push('Corpus / hardship-allowance negotiation');
    if (config.redevelopmentSelfRedevAdvisory) redevLines.push('Self-redevelopment advisory');
  }

  // Home loan
  const homeLoanPartners = (config.homeLoanPartners || []).filter((h) => h.bankName);
  const homeLoanBlock = config.homeLoanAssistance
    ? homeLoanPartners.length > 0
      ? `HOME LOAN PARTNERS (use these as-of dates — ROIs change monthly):
${homeLoanPartners.map((h) => {
  const roi = h.currentRoiMin || h.currentRoiMax ? ` · ROI ${h.currentRoiMin || '?'}-${h.currentRoiMax || '?'}%` : '';
  const asOf = h.roiAsOfDate ? ` (as of ${h.roiAsOfDate})` : '';
  const proc = h.processingFeePct ? ` · processing ${h.processingFeePct}%` : '';
  const tenure = h.maxTenureYears ? ` · max tenure ${h.maxTenureYears}y` : '';
  const eligible = [h.salariedOk ? 'salaried' : '', h.selfEmployedOk ? 'self-employed' : '', h.nriOk ? 'NRI' : ''].filter(Boolean).join('/');
  return `- ${h.bankName.replace(/_/g, ' ')} (${h.partnerType || 'preferred'})${roi}${asOf}${proc}${tenure}${eligible ? ` · eligible: ${eligible}` : ''}`;
}).join('\n')}`
      : `HOME LOAN: assistance offered through ${(config.homeLoanBanks || []).join(', ') || 'partner banks (specifics on request)'}`
    : 'HOME LOAN: not offered — customer should contact a bank directly.';

  // Brokerage
  const brokerageLines: string[] = [];
  if (config.rentalBrokerageMonths) brokerageLines.push(`Rental brokerage: ${config.rentalBrokerageMonths} month rent`);
  else if (config.rentalBrokeragePct) brokerageLines.push(`Rental brokerage: ${config.rentalBrokeragePct}`);
  if (config.saleBrokeragePctMin && config.saleBrokeragePctMax) {
    brokerageLines.push(`Sale brokerage: ${config.saleBrokeragePctMin}-${config.saleBrokeragePctMax}%${config.saleBrokerageGstApplicable ? ' + 18% GST' : ''}`);
  }
  if (config.builderBrokeragePctOfDeal) brokerageLines.push(`Builder brokerage (channel-partner): ${config.builderBrokeragePctOfDeal}`);
  if (config.noBrokerageSchemeAvailable) brokerageLines.push('No-brokerage scheme available for select listings');
  if (config.brokerageNegotiable) brokerageLines.push('Brokerage negotiable on serious leads');

  // Tax
  const taxLines: string[] = [];
  if (config.gstApplicabilityHint) {
    const gstMap: Record<string, string> = {
      under_construction_affordable_1pct: '1% GST on under-construction affordable housing',
      under_construction_non_affordable_5pct: '5% GST on under-construction non-affordable',
      commercial_uc_12pct: '12% GST on under-construction commercial',
      ready_to_move_nil: 'NIL GST on ready-to-move',
      rental_residential_nil: 'NIL GST on residential rent',
      rental_commercial_18pct: '18% GST on commercial rent',
      st_rental_above_7500_12pct: '12% GST on short-term rental above ₹7,500/day',
    };
    taxLines.push(gstMap[config.gstApplicabilityHint]);
  }
  if (config.stampDutyAdvisoryEnabled) taxLines.push('Stamp-duty advisory (state-wise rates — quote latest)');
  if (config.registrationChargeAdvisoryEnabled) taxLines.push('Registration-charge advisory');
  if (config.womenBuyerConcessionFlag) taxLines.push('Women-buyer stamp-duty concession (1-2% in many states — verify with sub-registrar)');
  if (config.pmayClssEligibility) taxLines.push('PMAY CLSS eligibility check available');

  // Site visit
  const siteVisitLines: string[] = [];
  if (config.siteVisitProcess) siteVisitLines.push(config.siteVisitProcess);
  if (typeof config.siteVisitPickupSupportedKm === 'number') siteVisitLines.push(`Free pickup within ${config.siteVisitPickupSupportedKm} km`);
  if (config.siteVisitVirtualTourEnabled) siteVisitLines.push('Virtual tour available (NRI / out-of-station customers)');
  if (config.siteVisitWeekendHours) siteVisitLines.push(`Weekend hours: ${config.siteVisitWeekendHours}`);
  if (config.siteVisitOutstationCancellationFee) siteVisitLines.push(`Outstation cancellation fee: ${config.siteVisitOutstationCancellationFee}`);

  // Staff
  const staff = (config.staffMembers || []).filter((s) => s.name?.trim());
  const staffBlock = staff.length > 0
    ? `\n\nTEAM (each broker has their own RERA — quote it when introducing):
${staff.map((s) => {
  const role = s.role ? ` ${s.role.replace(/_/g, ' ')}` : '';
  const exp = typeof s.experienceYears === 'number' ? ` · ${s.experienceYears}y` : '';
  const rera = s.agentReraNumber ? ` · RERA ${s.agentReraNumber}` : ' · ⚠️ RERA missing';
  const spec = s.specialties ? ` · ${s.specialties}` : '';
  return `- *${s.name}*${role}${exp}${rera}${spec}`;
}).join('\n')}`
    : '';

  // Compliance gates
  const noGuaranteedReturns = config.noGuaranteedReturnsClaim !== false;
  const reraQrAutoInject = config.reraQrAutoInjectEnabled !== false;
  const blockSendIfReraMissing = config.blockSendIfReraMissing !== false;

  return `BUSINESS TYPE: ${subTypeName}
AGENT / FIRM: ${config.agentName}
RERA (agent): ${config.reraNumber || '⚠️ NOT YET PROVIDED — bot will refuse to share property details'}${config.agentReraState ? ` · ${config.agentReraState}` : ''}${config.agentReraExpiry ? ` · expires ${config.agentReraExpiry}` : ''}
OPERATING AREAS: ${(config.operatingAreas || []).join(', ')}
PROPERTY TYPES: ${(config.propertyTypes || []).join(', ')}
SERVICES: ${(config.services || []).join(', ')}
EXCLUSIVE / CO-BROKING: ${config.exclusiveOrCoBroking || 'not specified'}${config.gstin ? `\nGSTIN: ${config.gstin}` : ''}

CURRENT LISTINGS (AUTHORITATIVE — overrides any earlier message in this chat):
${listingsText}${projectsBlock}${staffBlock}

${docServices.length > 0 ? `LEGAL DOCUMENTATION SERVICES OFFERED:\n${docServices.map((s) => `- ${s}`).join('\n')}` : ''}

${rentalLines.length > 0 ? `RENTAL POLICY:\n${rentalLines.map((l) => `- ${l}`).join('\n')}` : ''}

${pgLines.length > 0 ? `PG / CO-LIVING:\n${pgLines.map((l) => `- ${l}`).join('\n')}` : ''}

${nriLines.length > 0 ? `NRI SUPPORT:\n${nriLines.map((l) => `- ${l}`).join('\n')}` : ''}

${redevLines.length > 0 ? `REDEVELOPMENT EXPERTISE:\n${redevLines.map((l) => `- ${l}`).join('\n')}` : ''}

${homeLoanBlock}

${brokerageLines.length > 0 ? `BROKERAGE:\n${brokerageLines.map((l) => `- ${l}`).join('\n')}` : ''}

${taxLines.length > 0 ? `TAX & CHARGES (advisory):\n${taxLines.map((l) => `- ${l}`).join('\n')}` : ''}

SITE VISIT:
${siteVisitLines.map((l) => `- ${l}`).join('\n')}

STRICT RULES FOR REAL ESTATE BOT:

${noGuaranteedReturns ? `NEVER use phrases that promise investment returns. HARD-BLOCK list (refuse to send any reply containing these):
- "guaranteed return"
- "100% sure" / "100% safe"
- "definitely double / triple" (in any tense)
- "risk-free real estate"
- "assured appreciation"
- "your money will multiply"
- "no chance of loss"
When asked about future appreciation, answer (in customer's language): "Property appreciation depends on market conditions, location, and timing. Past trends are no guarantee of future returns. We can share a comparable-sales report so you decide for yourself."
` : ''}
${reraQrAutoInject ? `RERA QR AUTO-INJECTION:
- When sharing ANY property listing or builder project, include the RERA registration number AND the QR URL (if available).
- Format: "RERA: <number> · Verify QR: <url>"
- This is mandated by RERA Act §11 and MahaRERA / KRERA / RERA-DELHI display rules. Skipping it is a regulatory violation.
` : ''}
${blockSendIfReraMissing ? `BLOCK-IF-RERA-MISSING:
- If a listing in CURRENT LISTINGS above does NOT have a RERA number, the bot must REFUSE to share that listing.
- Reply (in customer's language): "Yeh property abhi hamare RERA-cleared list mein nahi hai. Owner se update lekar share karunga." Then flag for the owner.
` : ''}
- Always try to schedule a site visit — that's the primary conversion goal.
- Quote prices using the priceBasis disclosure (carpet vs super-built-up). If a customer asks "₹1 Cr ka 2BHK hai?" — clarify whether the area is carpet, built-up, or super-built-up. Loading-factor transparency is RERA-mandated.
- For Bangalore listings: ALWAYS disclose A-Khata vs B-Khata. B-Khata blocks bank loans — the customer needs to know.
- For OC / CC status: be honest. "OC pending" is NOT the same as "OC received". Don't paper over it.
- For negotiations, direct customer to the agent — don't promise specific discounts.
- Highlight property features and nearby amenities from the listing's structured data.

${isNRI ? `\nNRI ADVISORY DISCLAIMERS (CRITICAL):
- TDS rates: bot may share general guidance but MUST end with: "Please verify the latest TDS rate with your Chartered Accountant before signing the agreement."
- FCNR / NRE / NRO accounts: bot may explain the difference, but for actual fund transfers MUST direct to the customer's bank.
- Repatriation: bot may share general FEMA limits, MUST add: "Specific repatriation handling needs your banker's confirmation — rules change."
- POA (Power of Attorney): bot may explain process, MUST recommend customer engages a local lawyer in India.` : ''}

${isPG ? `\nPG / CO-LIVING TRANSPARENCY:
- Always disclose the EXIT FEE upfront — ${config.pgExitFeeInr || 'check policy'}. Don't hide it until move-out.
- For food: be precise about meal count + veg/non-veg. "Food included" alone is misleading.
- For electricity: ${config.pgElectricityBilling || 'check'} — bot must clarify which model to avoid bill shock.
- Notice period: ${config.pgNoticePeriodDays || 30} days — make the customer aware before they sign.` : ''}

ESCALATION:
- For complaints (booking blocked, refund disputed, project delay, RERA issue), ESCALATE: "I'll connect you with ${config.agentName}. Please call ${ownerCallNumber}."
- Indian customers / NRIs message in Hindi / English / Hinglish / regional languages. Match exactly per the LANGUAGE RULES at the top.`;
}

function buildSalonPrompt(config: Extract<ClientConfig, { type: 'salon' }>): string {
  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;

  // Sub-type-aware tone label
  const subTypeLabel: Record<string, string> = {
    'unisex-chain': 'Unisex salon chain',
    'women-only-parlour': 'Women-only parlour',
    'mens-barber': "Men's barber",
    'premium-mens-grooming': "Premium men's grooming studio",
    'home-service-stylist': 'Home-service stylist',
    'bridal-makeup-studio': 'Bridal makeup studio',
    'mehendi-studio': 'Mehendi studio',
    'party-makeup': 'Party makeup studio',
    'hair-only': 'Hair-only studio',
    'nail-bar': 'Nail bar',
    'tattoo-piercing': 'Tattoo & piercing studio',
    'spa-general': 'Spa',
    'spa-ayurvedic': 'Ayurvedic spa',
    'wellness-yoga-reiki': 'Wellness studio (yoga / reiki)',
    'kids-salon': "Kids' salon",
    'threading-express': 'Threading express',
    'mens-grooming-subscription': "Men's grooming subscription",
  };
  const subs = getSubTypes(config);
  const subTypeName = subs.length > 0
    ? subs.map((s) => subTypeLabel[s] || s).filter(Boolean).join(' + ')
    : 'Salon / Spa';

  // Render services with new structured fields (tier prices, processing time, hair length, brand, gender, add-ons)
  const totalServices = (config.services || []).reduce((n, c) => n + (c.items?.length || 0), 0);
  const servicesText = totalServices > 0
    ? (config.services || [])
        .map((cat) => {
          const items = (cat.items || []).map((i) => {
            const tags: string[] = [];
            if (i.gender && i.gender !== 'unisex') tags.push(`[${i.gender}]`);
            if (i.hairLength) tags.push(`[${i.hairLength} hair]`);
            if (i.isBestseller) tags.push('⭐');
            if (i.brand) tags.push(`brand: ${i.brand}`);
            const tagLine = tags.length > 0 ? ' ' + tags.join(' ') : '';

            const tiers: string[] = [];
            if (i.seniorStylistPrice) tiers.push(`Senior +${i.seniorStylistPrice}`);
            if (i.creativeDirectorPrice) tiers.push(`Creative Dir +${i.creativeDirectorPrice}`);
            const tierLine = tiers.length > 0 ? `\n    Tiers: ${tiers.join(' · ')}` : '';

            const procLine = typeof i.processingTimeMins === 'number'
              ? `\n    Processing time: ${i.processingTimeMins} min (stylist may serve another customer during this)`
              : '';

            const addOnsLine = i.addOns && i.addOns.length > 0
              ? `\n    Add-ons: ${i.addOns.map((a) => `${a.name} ${a.price}`).join(' · ')}`
              : '';

            return `  • ${i.name} - ${i.price} (${i.duration})${tagLine}${tierLine}${procLine}${addOnsLine}`;
          }).join('\n');
          return `*${cat.category}*\n${items}`;
        })
        .join('\n\n')
    : `(none — there are currently NO services configured for this salon)

CRITICAL: If earlier messages named specific services or prices, those have been removed and are NO LONGER offered. Do NOT repeat them and do NOT confirm bookings for them. Tell the customer the service menu is being updated and to contact the salon directly.`;

  const packages = config.packages || [];
  const packagesText = packages.length > 0
    ? packages.map((p) => {
        const tag = p.packageType && p.packageType !== 'regular' ? ` [${p.packageType}]` : '';
        const dur = typeof p.durationHours === 'number' ? ` · ${p.durationHours}h` : '';
        const adv = typeof p.advanceBookingDays === 'number' ? ` · book ${p.advanceBookingDays}d ahead` : '';
        return `- ${p.name}${tag}: ${p.price}${dur}${adv}\n  Includes: ${p.includes}`;
      }).join('\n')
    : '(none currently)';

  // Bridal block — multi-day pricing + outstation
  let bridalBlock = '';
  if (subs.includes('bridal-makeup-studio') || (config.bridalEventPricing && Object.keys(config.bridalEventPricing).length > 0)) {
    const bp = config.bridalEventPricing || {} as Record<string, string>;
    const events: string[] = [];
    if (bp.haldi) events.push(`Haldi ${bp.haldi}`);
    if (bp.mehendi) events.push(`Mehendi ${bp.mehendi}`);
    if (bp.sangeet) events.push(`Sangeet ${bp.sangeet}`);
    if (bp.wedding) events.push(`Wedding ${bp.wedding}`);
    if (bp.reception) events.push(`Reception ${bp.reception}`);
    if (bp.cocktail) events.push(`Cocktail ${bp.cocktail}`);
    const eventsLine = events.length > 0 ? `Per-event: ${events.join(' · ')}` : '';

    const trialLine = config.bridalTrialIncluded
      ? `Trial included (book ${config.bridalTrialMinDaysBefore || 30}+ days before).`
      : config.bridalTrialPrice
        ? `Trial: ${config.bridalTrialPrice}${config.bridalTrialRefundedOnBooking ? ' (refunded on booking)' : ''}`
        : 'Trial: not offered.';

    const outstation = config.bridalOutstationAvailable
      ? `Outstation available — travel ${config.bridalOutstationTravelChargesPerKm || 'on actuals'}, team ${config.bridalOutstationTeamSize || '(team size on quote)'}, stay ${config.bridalOutstationStaySeparate ? 'billed separately' : 'included'}.`
      : 'Outstation: not available.';

    const refund = config.bridalAdvanceRefundable
      ? `Advance refundable up to ${config.bridalRefundCutoffDays || 60} days before wedding.`
      : 'Advance is non-refundable.';

    bridalBlock = `\n\nBRIDAL PACKAGE:
${eventsLine}
${trialLine}
${typeof config.bridalBundleDiscountPercent === 'number' ? `Bundle discount when booking 3+ events: ${config.bridalBundleDiscountPercent}%` : ''}
${outstation}
${refund}`;
  }

  // Mehendi block (sub-type-specific)
  let mehendiBlock = '';
  if (config.mehendiConfig) {
    const m = config.mehendiConfig;
    const lines: string[] = [];
    if (m.bridalFlatRate) lines.push(`Bridal flat rate: ${m.bridalFlatRate}${m.bridalIncludes ? ` (covers ${m.bridalIncludes.replace(/_/g, ' + ')})` : ''}`);
    if (m.figuresExtraPerPair) lines.push(`Figures (per pair): ${m.figuresExtraPerPair}`);
    if (m.groomMehendiPrice) lines.push(`Groom mehendi: ${m.groomMehendiPrice}`);
    if (m.perHandGuestPrice) lines.push(`Guest mehendi: ${m.perHandGuestPrice} per hand`);
    if (m.arabicSimplePerHand) lines.push(`Arabic-simple: ${m.arabicSimplePerHand} per hand`);
    if (m.teamSizeOptions) lines.push(`Team-size options: ${m.teamSizeOptions}`);
    if (typeof m.handlesPerArtistPerHour === 'number') lines.push(`Throughput: ~${m.handlesPerArtistPerHour} hands per artist per hour`);
    if (m.organicHennaOnly) lines.push('Organic henna only (no chemical / black-cone henna)');
    if (lines.length > 0) {
      mehendiBlock = `\n\nMEHENDI PRICING:\n${lines.map((l) => `- ${l}`).join('\n')}`;
    }
  }

  // Staff with tier pricing
  const staff = (config.staffMembers || []).filter((s) => s.name?.trim());
  const staffBlock = staff.length > 0
    ? `\n\nAVAILABLE STAFF (use these prices, NOT defaults, when customer asks for a specific person):
${staff.map((s) => {
  const upcharge = typeof s.perServiceUpcharge === 'number' && s.perServiceUpcharge > 0
    ? ` (+₹${s.perServiceUpcharge} on top of base price)`
    : '';
  const exp = typeof s.experienceYears === 'number' ? `, ${s.experienceYears}y exp` : '';
  const spec = s.specialties && s.specialties.length > 0 ? `, specialises in ${s.specialties.join(', ')}` : '';
  return `- *${s.name}* (${s.role.replace(/_/g, ' ')}${exp}${spec})${upcharge}`;
}).join('\n')}`
    : '';

  // Slot / surge / women-only
  const slotLines: string[] = [];
  slotLines.push(config.bookingRequired ? 'Booking: advance booking recommended' : 'Booking: walk-ins welcome');
  if (config.walkInsAccepted === false) slotLines.push('Walk-ins NOT accepted — booking only.');
  if (typeof config.advanceDepositPercent === 'number' && config.advanceDepositPercent > 0) {
    slotLines.push(`Advance deposit: ${config.advanceDepositPercent}% of price${config.advanceDepositMinAmount ? ` (min ${config.advanceDepositMinAmount})` : ''}`);
  }
  if (typeof config.weekendsBookedOutDays === 'number') {
    slotLines.push(`Weekends typically book out ${config.weekendsBookedOutDays} days ahead — encourage early booking.`);
  }
  if (config.diwaliWeekSurcharge) slotLines.push('Diwali week: prices uplifted; warn the customer.');
  if (typeof config.weekendUpliftPercent === 'number' && config.weekendUpliftPercent > 0) {
    slotLines.push(`Weekend uplift: +${config.weekendUpliftPercent}% on Sat/Sun.`);
  }
  if (config.weddingSeasonMonths?.trim()) slotLines.push(`Wedding season (${config.weddingSeasonMonths}): book 30+ days ahead.`);
  if (config.womenOnlyHours?.trim()) slotLines.push(`Women-only hours: ${config.womenOnlyHours}`);
  if (config.kidsHaircutDays?.trim()) slotLines.push(`Kids haircut: ${config.kidsHaircutDays}`);

  // Home service
  const homeLines: string[] = [];
  if (config.homeServiceAvailable) {
    homeLines.push('Home service: available');
    if (typeof config.homeServiceRadiusKm === 'number') homeLines.push(`Service radius: ${config.homeServiceRadiusKm} km`);
    if (config.homeServiceFlatCharge) homeLines.push(`Flat home-service charge: ${config.homeServiceFlatCharge}`);
    if (config.homeServiceChargesPerKm) homeLines.push(`Per-km charges: ${config.homeServiceChargesPerKm}`);
    if (config.outstationAvailable) {
      homeLines.push(`Outstation: yes${config.outstationPickupDropCharges ? ` (pickup-drop ${config.outstationPickupDropCharges})` : ''}${config.outstationStayBilledExtra ? ' · stay billed extra' : ''}`);
    }
    if (config.kitHygieneSOP?.trim()) homeLines.push(`Kit hygiene: ${config.kitHygieneSOP}`);
  } else {
    homeLines.push('Home service: not available — in-salon only.');
  }

  // Loyalty / membership / prepaid
  const loyaltyLines: string[] = [];
  if (config.membershipMonthlyFee?.trim()) loyaltyLines.push(`Monthly membership: ${config.membershipMonthlyFee}`);
  if (config.loyaltyVisitMilestone?.trim()) loyaltyLines.push(`Loyalty milestone: ${config.loyaltyVisitMilestone}`);
  if ((config.prepaidPacks || []).length > 0) {
    loyaltyLines.push('Prepaid wallet packs:');
    for (const p of (config.prepaidPacks || []).filter((x) => x.name?.trim())) {
      loyaltyLines.push(`  • ${p.name}: pay ${p.payAmount}, get ${p.walletValue} wallet (valid ${p.validityMonths} months)`);
    }
  }

  // Cancellation + consent
  const policyLines: string[] = [];
  if (typeof config.cancellationHoursBefore === 'number') {
    policyLines.push(`Free cancellation up to ${config.cancellationHoursBefore} hours before slot.`);
  }
  if (typeof config.cancellationFeePercent === 'number' && config.cancellationFeePercent > 0) {
    policyLines.push(`Late cancellation fee: ${config.cancellationFeePercent}% of price.`);
  }
  if (config.noShowFee) policyLines.push(`No-show fee: ${config.noShowFee}`);
  if ((config.consentFormRequiredFor || []).length > 0) {
    policyLines.push(`Signed consent required for: ${(config.consentFormRequiredFor || []).join(', ')}`);
  }

  // Compliance gates
  const isAyurvedic = subs.includes('spa-ayurvedic');
  const isTattoo = subs.includes('tattoo-piercing');
  const ayurvedicGate = isAyurvedic && !config.ayushRegistered
    ? `\n\nAYUSH COMPLIANCE GATE (CRITICAL):
- This is an Ayurvedic spa but NO AYUSH licence is on file. The Drugs &
  Magic Remedies Act prohibits unlicensed therapeutic claims.
- Bot MUST refuse to use the words "cure", "treatment", "heal", "therapy",
  "medical", "medicine" in any reply. Use "wellness session", "relaxation",
  "rejuvenation" instead.
- Refuse questions asking whether services treat specific conditions
  (back-pain, migraine, arthritis). Direct customer to a qualified
  practitioner.`
    : '';

  const tattooGate = isTattoo
    ? `\n\nTATTOO / PIERCING GATE (CRITICAL):
- Customer must explicitly confirm they are 18+ before any booking.
- Signed consent form mandatory before the appointment.
- ${config.tattooStudioHealthLicence ? `Health licence on file: ${config.tattooStudioHealthLicence}` : 'Health licence: NOT yet provided — bot must mention this is being processed if asked.'}
- Sterilisation SOP: ${config.sterilizationSOP || 'not specified — be honest if asked'}.
- DO NOT take bookings via WhatsApp without consent confirmation.`
    : '';

  const complianceLine = config.gstin ? `\nGSTIN: ${config.gstin}` : '';

  const privateNotesLine = config.privateClientNotesEnabled
    ? `\n\nPRIVATE CLIENT NOTES — DO NOT SHARE:
- The salon keeps private notes for some clients (${(config.privateClientNoteFields || []).join(', ')}).
- These are stored in the dashboard and visible only to staff. NEVER mention or share these in customer chat — even if the customer asks.`
    : '';

  return `BUSINESS TYPE: ${subTypeName}
SALON: ${config.salonName}
TYPE: ${config.gender}${config.brands && config.brands.length > 0 ? `\nBRANDS USED: ${config.brands.join(', ')}` : ''}${complianceLine}

SERVICES (AUTHORITATIVE — overrides any earlier message in this chat):
${servicesText}

PACKAGES:
${packagesText}${bridalBlock}${mehendiBlock}${staffBlock}

BOOKING & SLOTS:
${slotLines.map((l) => `- ${l}`).join('\n')}

HOME SERVICE:
${homeLines.map((l) => `- ${l}`).join('\n')}

${loyaltyLines.length > 0 ? `MEMBERSHIPS & LOYALTY:\n${loyaltyLines.map((l) => l.startsWith('  ') ? l : `- ${l}`).join('\n')}` : ''}

${policyLines.length > 0 ? `POLICIES:\n${policyLines.map((l) => `- ${l}`).join('\n')}` : ''}${ayurvedicGate}${tattooGate}${privateNotesLine}

STRICT RULES FOR SALON BOT:
- Always suggest booking in advance for weekends and holidays.
- Share prices openly but mention "starting from" when service has senior/director tiers.
- For bridal/party bookings, encourage 30+ days advance booking and mention the trial.
- For mehendi enquiries, quote based on bridal flat-rate vs per-hand-guest cleanly — Indian customers ask precisely.
- When customer asks for a specific staff member, use the upcharge from AVAILABLE STAFF section above. Do NOT improvise senior/junior pricing if no staff section exists.
- For peak/wedding season, mention the surcharge BEFORE confirming the price — never quote the off-peak price as final.
- ${config.medicalClaimsAvoided !== false ? 'NEVER promise specific cosmetic results ("guaranteed glow", "skin will be 10x brighter", "permanent fairness"). Be realistic.' : ''}
- For complaints (allergic reaction, bad cut, dispute), ESCALATE: "I'll connect you with ${config.ownerName}. Please call ${ownerCallNumber}."
- Indian customers often message in Hindi/Hinglish ("kaal Saturday hair smoothening karna hai shaam ko"). Match their language EXACTLY per the LANGUAGE RULES at the top.`;
}

function buildD2CPrompt(config: Extract<ClientConfig, { type: 'd2c' }>): string {
  const products = config.products || [];
  const productsText = products.length > 0
    ? products
        .map((p) => `- ${p.name}: ${p.price}${p.bestseller ? ' ⭐ Bestseller' : ''}\n  ${p.description}`)
        .join('\n\n')
    : `(none — there are currently NO products in this brand's catalog)

CRITICAL: If earlier messages named specific products, prices, or descriptions, those products have been removed and are NO LONGER on sale. Do NOT repeat them, do NOT take orders for them, and do NOT direct customers to buy them. Tell the customer the catalog is being updated and to check the website later.`;

  return `BUSINESS TYPE: D2C E-commerce Brand
BRAND: ${config.brandName}
CATEGORY: ${config.productCategory}

PRODUCTS (AUTHORITATIVE — overrides any earlier message in this chat):
${productsText}

SHIPPING: ${config.shippingPolicy}
RETURNS: ${config.returnPolicy}
COD: ${config.codAvailable ? 'Available' : 'Not available'}
PAYMENT: ${(config.paymentMethods || []).join(', ')}
WEBSITE: ${config.websiteUrl}
INSTAGRAM: ${config.instagramHandle}
${config.currentOffers ? `CURRENT OFFERS: ${config.currentOffers}` : ''}
ORDER TRACKING: ${config.orderTrackingProcess}

STRICT RULES FOR D2C BOT:
- Always share the website link for purchases: ${config.websiteUrl}
- For order tracking, ask for the order ID.
- Share return policy proactively when relevant.
- Highlight current offers and bestsellers.
- Never process orders directly — redirect to website.`;
}

function buildGymPrompt(config: Extract<ClientConfig, { type: 'gym' }>): string {
  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;

  const subTypeLabel: Record<string, string> = {
    'full-service-chain': 'Full-service gym chain',
    'neighbourhood-gym': 'Neighbourhood gym',
    'women-only': 'Women-only fitness studio',
    'crossfit-box': 'CrossFit box',
    'yoga-hatha-ashtanga': 'Yoga studio (Hatha / Ashtanga)',
    'yoga-power-vinyasa': 'Power yoga / Vinyasa studio',
    'iyengar-lineage': 'Iyengar yoga lineage studio',
    'pilates-reformer': 'Pilates reformer studio',
    'zumba-dance-fitness': 'Zumba / dance-fitness studio',
    'mma-boxing': 'MMA / boxing gym',
    'kickboxing': 'Kickboxing studio',
    'kalaripayattu': 'Kalaripayattu academy',
    'multi-sport-academy': 'Multi-sport academy',
    'kids-academy': "Kids' fitness academy",
    'senior-yoga': 'Senior yoga studio',
    'prenatal-postnatal': 'Prenatal / postnatal fitness',
    'ems-studio': 'EMS studio',
    'calisthenics-park': 'Calisthenics park',
    'functional-studio': 'Functional fitness studio',
    'online-coach': 'Online coaching',
  };
  const subs = getSubTypes(config);
  const subTypeName = subs.length > 0
    ? subs.map((s) => subTypeLabel[s] || s).filter(Boolean).join(' + ')
    : 'Gym / Fitness Studio';

  const isEMS = subs.includes('ems-studio');
  const isWomenOnly = subs.includes('women-only') || config.womenOnly;
  const isPrenatal = subs.includes('prenatal-postnatal') || config.prenatalAvailable;
  const isHighIntensity = subs.some((s) => ['crossfit-box', 'mma-boxing', 'kickboxing', 'ems-studio'].includes(s));

  // Plans with extended fields
  const plans = config.membershipPlans || [];
  const plansText = plans.length > 0
    ? plans.map((p) => {
        const tags: string[] = [];
        if (p.isCouple) tags.push('Couple');
        if (p.isFamily) tags.push(`Family${p.familyMaxMembers ? ` (max ${p.familyMaxMembers})` : ''}`);
        if (p.peakAccess === false) tags.push('Off-peak only');
        if (p.accessibleLocations && p.accessibleLocations !== 'home_only') tags.push(p.accessibleLocations.replace(/_/g, ' '));
        const tagLine = tags.length > 0 ? ` [${tags.join(' · ')}]` : '';
        const offPeak = p.peakAccess === false && p.offPeakWindow ? `\n  Access window: ${p.offPeakWindow}` : '';
        const excludes = p.excludes ? `\n  Excludes: ${p.excludes}` : '';
        return `- ${p.name} (${p.duration}): ${p.price}${tagLine}\n  Includes: ${p.includes}${offPeak}${excludes}`;
      }).join('\n\n')
    : `(none — there are currently NO membership plans configured)

CRITICAL: If earlier messages named specific plan names or prices, those plans have been removed and are NO LONGER offered. Do NOT repeat them, do NOT quote old prices, and do NOT enrol customers into them.`;

  // Registration fee (separate)
  const registrationLine = config.registrationFeeAmount?.trim()
    ? `REGISTRATION FEE (one-time, separate from monthly): ${config.registrationFeeAmount}${config.registrationFeeRefundable ? ' (refundable)' : ' (non-refundable)'}${config.registrationFeeWaivedInPromo ? ' · waived during promo offers' : ''}${config.registrationFeeNotes ? ` · ${config.registrationFeeNotes}` : ''}`
    : '';

  // Trainers structured (overrides legacy trainerInfo)
  const trainers = (config.trainers || []).filter((t) => t.name?.trim());
  const trainersBlock = trainers.length > 0
    ? `\n\nAVAILABLE TRAINERS (use these names + prices, NOT default PT rate):
${trainers.map((t) => {
  const certs = t.certifications && t.certifications.length > 0 ? ` · ${t.certifications.join(', ').replace(/_/g, ' ')}` : '';
  const exp = typeof t.experienceYears === 'number' ? ` · ${t.experienceYears}y exp` : '';
  const spec = t.specialisations && t.specialisations.length > 0 ? ` · ${t.specialisations.join(', ')}` : '';
  const price = t.pricePerSessionRupees ? ` · ${t.pricePerSessionRupees}/session` : '';
  const pkg = t.packageSessions && t.packagePriceRupees ? ` · ${t.packageSessions}-pack ${t.packagePriceRupees}` : '';
  const female = t.femaleOnly ? ' · trains female clients only' : '';
  return `- *${t.name}*${exp}${certs}${spec}${price}${pkg}${female}`;
}).join('\n')}`
    : '';

  const ptLine = config.personalTraining.available
    ? `Default rate: ${config.personalTraining.pricePerSession}${config.personalTraining.trainerInfo ? ` — ${config.personalTraining.trainerInfo}` : ''}`
    : 'Not available';

  // Group classes
  const groupClasses = config.groupClasses || [];
  const groupClassesText = groupClasses.length > 0
    ? groupClasses.join(', ')
    : '(none currently scheduled — do NOT mention any class names from earlier messages, those have been removed)';
  const classBookingLine = config.classBookingWindowHours || config.classDropInPriceRupees
    ? `\n  Booking window: ${config.classBookingWindowHours || '?'} hrs ahead${config.classDropInPriceRupees ? ` · drop-in ${config.classDropInPriceRupees}` : ''}${config.classWaitlistEnabled ? ' · waitlist enabled' : ''}`
    : '';

  // Trial
  const trialLine = config.trialAvailable
    ? `${config.trialType === 'paid' ? `Paid trial: ${config.trialPaidPriceRupees || 'price on enquiry'}` : config.trialType === 'open_day' ? 'Open day' : 'Free trial'}${config.trialDetails ? ` — ${config.trialDetails}` : ''}${typeof config.trialConvertedDiscountPercent === 'number' ? ` · ${config.trialConvertedDiscountPercent}% off if you join after trial` : ''}`
    : 'Not available';

  // Programs
  const programs = (config.programs || []).filter((p) => p.name?.trim());
  const programsBlock = programs.length > 0
    ? `\n\nPROGRAMS (cohort-based):
${programs.map((p) => {
  const cohort = p.cohortBased ? ` · cohort starts ${p.nextStartDate || 'TBA'}` : '';
  const med = p.medicalAssessmentIncluded ? ' · medical assessment included' : '';
  return `- *${p.name}* (${p.durationDays} days, ${p.priceRupees})${cohort}${med}`;
}).join('\n')}`
    : '';

  // Freeze policy
  const freezeLine = config.freezePolicyEnabled
    ? `MEMBERSHIP FREEZE: max ${config.freezeMaxDaysPerCycle || 60} days per cycle${config.freezeMinPlanDurationMonths ? ` (only on plans ≥ ${config.freezeMinPlanDurationMonths} months)` : ''}${config.freezeAdvanceNoticeDays ? ` · ${config.freezeAdvanceNoticeDays} days notice required` : ''}${config.freezeFeeRupees && config.freezeFeeRupees !== '0' ? ` · fee ${config.freezeFeeRupees}` : ''}${config.freezeMedicalUnlimited ? ' · UNLIMITED freeze with medical certificate' : ''}`
    : '';

  // Discounts + corporate + aggregators
  const discountLines: string[] = [];
  if (typeof config.couplePercent === 'number' && config.couplePercent > 0) discountLines.push(`Couple: ${config.couplePercent}% off`);
  if (typeof config.familyPercent === 'number' && config.familyPercent > 0) discountLines.push(`Family: ${config.familyPercent}% off`);
  if (config.referralRupees?.trim()) discountLines.push(`Referral: ${config.referralRupees}`);

  const corp = (config.corporatePartners || []).filter((c) => c.employer?.trim());
  const corpLine = corp.length > 0
    ? `CORPORATE PARTNERS:\n${corp.map((c) => `  • ${c.employer}: ${c.discountPercent}% off (verify via ${c.verificationRequired.replace(/_/g, ' ')})`).join('\n')}`
    : '';

  const aggLine = (config.aggregatorPartners || []).length > 0
    ? `AGGREGATOR PARTNERS: ${(config.aggregatorPartners || []).join(', ')}`
    : '';

  // Day pass
  const dayPassLine = config.dayPassPriceRupees?.trim()
    ? `DAY PASS: ${config.dayPassPriceRupees}${config.guestPolicy ? ` · guests ${config.guestPolicy.replace(/_/g, ' ')}` : ''}`
    : '';

  // Add-ons
  const addonLines: string[] = [];
  if (config.lockerRentalRupees) addonLines.push(`Locker rental: ${config.lockerRentalRupees}`);
  if (config.towelService) addonLines.push('Towel service available');
  if (config.dietPlanRupees) addonLines.push(`Diet plan: ${config.dietPlanRupees}`);
  if (config.bodyCompositionScanRupees) addonLines.push(`Body composition scan: ${config.bodyCompositionScanRupees}`);

  // Audience
  const audienceLines: string[] = [];
  if (config.womenOnly || isWomenOnly) audienceLines.push('Women-only studio.');
  if (config.womenOnlyTimings) audienceLines.push(`Women-only timings: ${config.womenOnlyTimings}`);
  if (config.prenatalAvailable || isPrenatal) audienceLines.push('Prenatal classes available.');
  if (config.seniorAvailable) audienceLines.push('Senior-friendly classes available.');
  if (config.kidsAvailable) audienceLines.push(`Kids' classes available${config.kidsAgeGroups ? ` (${config.kidsAgeGroups})` : ''}.`);

  // Compliance
  const complianceLines: string[] = [];
  if (config.liabilityWaiverUrl) complianceLines.push(`Liability waiver: ${config.liabilityWaiverUrl}`);
  if ((config.medicalClearanceRequired || []).length > 0) {
    complianceLines.push(`Medical clearance required for: ${(config.medicalClearanceRequired || []).join(', ')}.`);
  }
  if (config.gstin) complianceLines.push(`GSTIN: ${config.gstin}`);

  // Hard policy gates
  const noGuarantee = config.noOutcomeGuaranteeClaim !== false;
  const dietDisclaimer = config.dietDisclaimerShown !== false;

  // EMS gate (CRITICAL — pacemaker exclusion)
  const emsBlock = isEMS
    ? `\n\nEMS HARD-BLOCK (CRITICAL — medical safety):
- This is an EMS studio. The bot MUST refuse to book a session for any
  customer who indicates ANY of: pacemaker, heart condition, cardiac
  stent, pregnancy, epilepsy, recent surgery, severe diabetes, cancer
  treatment, deep vein thrombosis, hernia, or implanted electronic devices.
- Required onboarding: customer signs informed consent + completes
  medical-clearance form before first session.
- Session cap: ${config.emsMaxSessionsPerWeek || 2} sessions per week. NEVER schedule more — EMS is high-stress on muscles.
- Suit fee one-time: ${config.emsSuitFeeOneTimeRupees || '(check with owner)'}.
- Session length: ${config.emsSessionDurationMin || 20} minutes (EMS sessions should NEVER exceed 25 min).`
    : '';

  // Diet / supplement hard-block
  const supplementBlock = `\n\nDIET / SUPPLEMENT HARD-BLOCK (Meta Commerce Policy):
- The bot MUST NOT recommend, sell, or "mention as available" any of:
  whey protein, mass gainer, BCAA, creatine, pre-workout, fat-burner,
  multivitamins, ashwagandha/spirulina supplements, ayurvedic churan/kadha
  marketed for fitness, fish oil capsules, or any ingestible supplement.
- WhatsApp Commerce Policy categorically blocks ingestible supplements.
- If a customer asks "do you sell whey?" or "what protein should I take?",
  decline politely (in their language) and redirect: "Supplements ke liye
  trainer ya doctor se baat karein — ${ownerCallNumber} pe call kar lijiye."
${dietDisclaimer ? `- Diet plan questions: the bot may share that ${config.dietPlanRupees ? `paid diet plans (${config.dietPlanRupees}) are` : 'diet consultations are'} available with the in-house trainer/dietitian, but MUST NOT give specific calorie targets, meal recommendations, or macros directly. Always include the disclaimer: "This is general guidance — for a personalised plan based on your medical history, please book a session with our trainer."` : '- Diet plan questions: refer customer to in-house trainer/dietitian. Do NOT give calorie targets or meal recommendations.'}`;

  // No-outcome-guarantee block
  const guaranteeBlock = noGuarantee
    ? `\n\nOUTCOME-GUARANTEE BLOCK (CRITICAL — Meta + ASCI):
- NEVER use phrases like "guaranteed weight loss", "lose 10 kg in 30 days",
  "guaranteed transformation", "muscle gain pakka", "results in 2 weeks
  or refund". These are false-advertising violations.
- For transformation programs (90-day etc.), describe the FRAMEWORK (training
  + diet guidance + tracking) without promising specific outcomes.
- When asked "kitna weight loss hoga?" — answer (in customer's language):
  "Result individual ke effort, diet, aur consistency pe depend karta hai.
  Trainer assessment ke baad realistic goal set karenge."`
    : '';

  return `BUSINESS TYPE: ${subTypeName}
GYM: ${config.gymName}
TIMINGS: ${config.timings}

${registrationLine}

FACILITIES: ${(config.facilities || []).join(', ') || '(not specified)'}
${config.equipmentList ? `EQUIPMENT: ${config.equipmentList}` : ''}

MEMBERSHIP PLANS (AUTHORITATIVE — overrides any earlier message in this chat):
${plansText}

PERSONAL TRAINING (default — overridden by AVAILABLE TRAINERS section if present): ${ptLine}${trainersBlock}

GROUP CLASSES: ${groupClassesText}${classBookingLine}

TRIAL: ${trialLine}${programsBlock}

${freezeLine}

${discountLines.length > 0 ? `DISCOUNTS:\n${discountLines.map((l) => `- ${l}`).join('\n')}` : ''}

${corpLine}
${aggLine}

${dayPassLine}

${addonLines.length > 0 ? `ADD-ONS:\n${addonLines.map((l) => `- ${l}`).join('\n')}` : ''}

${audienceLines.length > 0 ? `AUDIENCE:\n${audienceLines.map((l) => `- ${l}`).join('\n')}` : ''}

${complianceLines.length > 0 ? `COMPLIANCE:\n${complianceLines.map((l) => `- ${l}`).join('\n')}` : ''}

STRICT RULES FOR GYM BOT:
- Always offer the trial first to new inquiries — that's the conversion lever.
- Mention the REGISTRATION FEE separately when quoting plan prices, so customers don't get surprised at signup.
- Share membership plans with clear pricing including peak vs off-peak distinction.
- Encourage visiting the gym for a tour.
- For couple/family plans, share the bundle discount only when the customer mentions multiple members.

TRAINER RULES (CRITICAL):
- The AVAILABLE TRAINERS section above is AUTHORITATIVE. Use those names + prices when customer asks for a specific person.
- Only describe trainers EXPLICITLY listed. If the section is empty, NO specific trainers exist for this gym — DO NOT invent names, certifications, experience, or specialties.
- If customer asks about trainers and the section is empty, communicate (in their language): "For specific trainer details, please contact the owner at ${ownerCallNumber}. Personal training rate: ${config.personalTraining.available ? config.personalTraining.pricePerSession : 'contact owner'}."
- Female-only trainers: if a male customer asks for one of these, politely explain the trainer trains female clients only and offer alternates.
- Owner contact: ${ownerCallNumber}. Never share the WhatsApp bot's own number as the owner's contact.

${isHighIntensity ? `\nHIGH-INTENSITY DISCLAIMER:\n- For CrossFit / MMA / kickboxing / EMS, ALWAYS mention the pre-existing condition disclaimer at first contact: "Hum joining se pehle ek small medical history form bharte hain — heart condition, recent surgery, ya pregnancy ho toh trainer ko bata dijiye."\n` : ''}${emsBlock}${supplementBlock}${guaranteeBlock}

ESCALATION:
- For complaints (injury, billing dispute, trainer unprofessional), ESCALATE: "I'll connect you with ${config.ownerName}. Please call ${ownerCallNumber}."
- Indian customers often message in Hindi/Hinglish ("monthly fees kitni hai bhai?"). Match their language EXACTLY per the LANGUAGE RULES at the top.`;
}

function buildTiffinPrompt(config: Extract<ClientConfig, { type: 'tiffin' }>): string {
  const plans = config.plans || [];
  const plansText = plans.length > 0
    ? plans
        .map((p) => {
          const meal = p.mealType ? `[${p.mealType}]` : '';
          const food = p.foodType ? `[${p.foodType}]` : '';
          // Render structured carb composition only when at least one of
          // the new Phase-0 fields is set (older plans may not have them
          // and we don't want to print "Roti count: undefined").
          const composition: string[] = [];
          if (typeof p.rotiCount === 'number') {
            composition.push(`${p.rotiCount} ${p.rotiType || 'roti'}`);
          }
          if (p.riceIncluded) composition.push('rice');
          if (p.dalIncluded) composition.push('dal');
          if (typeof p.sabziCount === 'number') composition.push(`${p.sabziCount} sabzi`);
          if (p.saladPickleIncluded) composition.push('salad/pickle');
          if (p.drinkingWaterIncluded) composition.push('drinking water');
          const compLine = composition.length > 0
            ? `\n  Per dabba: ${composition.join(' + ')}${p.portionSize ? ` (${p.portionSize} portion)` : ''}`
            : '';
          return `- ${p.name} (${p.duration}) ${meal} ${food}\n  Price: ${p.price}\n  Includes: ${p.includes}${compLine}`;
        })
        .join('\n\n')
    : `(none — there are currently NO tiffin plans configured)

CRITICAL: If earlier messages named specific plan names, prices, or what's included in a dabba, those plans have been removed and are NO LONGER offered. Do NOT repeat them, do NOT take subscriptions for them, and do NOT quote old prices. If the customer asks about plans, tell them politely the plan list is being updated and to contact the owner directly.`;

  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;

  // Kitchen / dietary basics — top-3 questions per research
  const kitchenLines: string[] = [];
  if (config.oilType) kitchenLines.push(`Cooking oil: ${config.oilType}`);
  if (config.gheeUsed && config.gheeUsed !== 'none') kitchenLines.push(`Ghee: ${config.gheeUsed}`);
  if (config.eggInclusionOption) {
    const eggMap: Record<string, string> = {
      never: 'Egg: NEVER (pure veg kitchen)',
      'on-request': 'Egg: only on explicit request',
      'sunday-only': 'Egg: served on Sundays only',
      'twice-weekly': 'Egg: served twice a week',
      always: 'Egg: always part of non-veg dabba',
    };
    kitchenLines.push(eggMap[config.eggInclusionOption] || `Egg: ${config.eggInclusionOption}`);
  }
  const dietaryFlags: string[] = [];
  if (config.jainAvailable) dietaryFlags.push('Jain plans available');
  if (config.noOnionGarlicAvailable) dietaryFlags.push('No-onion-no-garlic available');
  if (config.diabeticPlanAvailable) dietaryFlags.push('Diabetic-friendly plan available');
  if (config.postPregnancyPlanAvailable) dietaryFlags.push('Post-pregnancy plan available');
  if (dietaryFlags.length > 0) kitchenLines.push(`Dietary specials: ${dietaryFlags.join(' · ')}`);

  // Subscription operations — cutoff, skip policy, capacity
  const opLines: string[] = [];
  if (config.advanceBookingCutoff?.trim()) {
    opLines.push(`Order cutoff for next day: ${config.advanceBookingCutoff} (orders past this go to the day after).`);
  }
  if (config.skipBillingPolicy) {
    const skipMap: Record<string, string> = {
      'prorated-refund': 'When a subscriber skips a tiffin, they get a prorated refund.',
      'rolled-over-to-next': 'When a subscriber skips a tiffin, that day is added to the end of their cycle.',
      forfeit: 'When a subscriber skips, that day is forfeit (no refund / no rollover).',
      'wallet-credit': 'When a subscriber skips, the value goes to wallet credit for next order.',
    };
    opLines.push(skipMap[config.skipBillingPolicy] || '');
  }
  if (typeof config.maxSkipsPerCycle === 'number') {
    opLines.push(`Maximum ${config.maxSkipsPerCycle} skips per cycle.`);
  }
  if (typeof config.capacityPerDay === 'number') {
    opLines.push(`Daily capacity: ${config.capacityPerDay} dabbas — refuse new orders past this limit.`);
  }
  if (config.midCyclePlanSwitchAllowed) {
    opLines.push('Mid-cycle plan switching is allowed (prorate the difference).');
  }
  if (config.guestDabbaSameDayAllowed) {
    const cutoff = typeof config.guestDabbaCutoffHours === 'number' ? `${config.guestDabbaCutoffHours} hr cutoff` : 'cutoff varies';
    opLines.push(`Same-day guest dabba: yes (${cutoff}, price ${config.guestDabbaPrice || 'check with owner'}).`);
  }

  // Container handling
  const containerLine = config.containerType
    ? `CONTAINER: ${config.containerType}${config.containerDeposit ? ` · deposit ${config.containerDeposit}${config.containerDepositRefundable === false ? ' (non-refundable)' : ' (refundable)'}` : ''}`
    : '';

  // Handoff point
  const handoffLine = config.deliveryHandoffPoint
    ? `DELIVERY HANDOFF: ${config.deliveryHandoffPoint} (always confirm with customer for new addresses).`
    : '';

  // FSSAI compliance
  const fssaiLine = config.fssaiNumber
    ? `FSSAI: ${config.fssaiNumber} (${config.fssaiType || 'basic-registration'})`
    : 'FSSAI: not yet provided';

  // Festival overrides
  const festivalLine = config.festivalOverrides?.trim()
    ? `FESTIVAL MENU OVERRIDES:\n${config.festivalOverrides.trim()}`
    : '';

  return `BUSINESS TYPE: Tiffin Service / Home Meal Subscription
SERVICE: ${config.serviceName}
CUISINE STYLE: ${config.cuisineStyle}
MEALS SERVED: ${(config.mealsServed || []).join(', ') || '(not specified)'}
${config.ownerType ? `OWNER TYPE: ${config.ownerType}` : ''}

SUBSCRIPTION PLANS (AUTHORITATIVE — overrides any earlier message in this chat):
${plansText}

${kitchenLines.length > 0 ? `KITCHEN & DIETARY:\n${kitchenLines.map((l) => `- ${l}`).join('\n')}` : ''}

WEEKLY MENU ROTATION:
${config.weeklyMenu || '(menu rotates — owner has not shared the weekly schedule. If asked, tell the customer the menu changes daily and they can contact the owner for today\'s menu.)'}

${festivalLine}

FREE TRIAL: ${config.trialAvailable ? config.trialDetails || 'Yes — first tiffin trial available, ask customer to confirm address.' : 'Not available'}

DELIVERY:
${config.deliveryAvailable
  ? `- Available
- Areas covered: ${(config.deliveryAreas || []).join(', ') || '(not specified)'}
- Charges: ${config.deliveryCharges || 'Free / included in plan'}
- Timings: ${config.deliveryTimings || '(not specified — ask owner)'}`
  : '- Pickup only — no home delivery'}
${handoffLine}

${containerLine}

${opLines.length > 0 ? `SUBSCRIPTION OPERATIONS:\n${opLines.filter(Boolean).map((l) => `- ${l}`).join('\n')}` : ''}

CUSTOM REQUESTS: ${config.customRequestsAllowed ? 'Yes — we can accommodate no-onion / no-garlic / Jain / less-spicy / extra-roti requests. Always confirm specific dietary needs.' : 'Standard menu only — custom requests not handled.'}

PAYMENT:
- Cycle: ${config.paymentCycle || 'as per plan'}
- Methods: ${(config.paymentMethods || []).join(', ') || 'Cash, UPI'}

COMPLIANCE:
${fssaiLine}

HOLIDAYS / OFF-DAYS: ${config.holidaysClosed || 'No fixed off-days — open all days'}

STRICT RULES FOR TIFFIN BOT:
- Always confirm the CUSTOMER'S DELIVERY ADDRESS and PHONE NUMBER before saying a subscription is "started" or "confirmed".
- For first-time enquiries, OFFER THE FREE TRIAL FIRST if available — that's the conversion lever for tiffin services.
- Be very clear about what's IN the dabba (use the structured "Per dabba" line for each plan above — Indian customers ask precisely "kitne roti milte hain?", "rice hai ya nahi?").
- When asked about cooking oil / ghee, answer truthfully from the KITCHEN section above. If not specified, communicate (in their language) "Owner ko poochke bata dunga" — do NOT guess.
- For egg-related questions, follow the egg policy STRICTLY. If "never", refuse politely and explain it's a pure-veg kitchen.
- Never promise specific delivery TIME ("8:30 PM sharp"); say "between X and Y" using the deliveryTimings range.
- For dietary clarifications (Jain, no-onion, lactose-free), confirm with owner first if not explicitly listed in dietary specials — never improvise food restrictions.
- Sunday/holiday queries: be honest about off-days, don't promise delivery on closed days.
- For complaints about food quality / late delivery, ESCALATE immediately: "I'll connect you with ${config.ownerName}. Please call ${ownerCallNumber}."
- Never confirm a "subscription paid" status — payment confirmation comes from the payment system, not from chat.
- For order cutoff: if the customer is asking about today's dabba past the cutoff, politely explain the next-day cutoff and offer the day-after-tomorrow slot (or the same-day guest-dabba if that's enabled).
- Tiffin customers often message in pure Hindi/Hinglish/regional languages ("bhaiya kal se start kar do" / "aaj veg dabba bhejna"). Match their language EXACTLY per the LANGUAGE RULES at the top.`;
}

function buildEcommercePrompt(config: Extract<ClientConfig, { type: 'ecommerce' }>): string {
  const products = config.products || [];
  const categories = config.productCategories || [];

  const groupedText = products.length > 0
    ? (() => {
        // Group products by category for cleaner prompt structure.
        const byCat = new Map<string, typeof products>();
        for (const p of products) {
          const key = (p.category || 'Other').trim() || 'Other';
          const arr = byCat.get(key) || [];
          arr.push(p);
          byCat.set(key, arr);
        }
        const blocks: string[] = [];
        for (const [cat, items] of byCat) {
          const lines = items.map((p) => {
            const tags = [
              p.bestseller ? '⭐ Bestseller' : '',
              p.inStock === false ? '🔴 OUT OF STOCK' : '',
            ].filter(Boolean).join(' ');
            return `  • ${p.name} — ${p.price}${tags ? ' ' + tags : ''}\n    ${p.description}`;
          }).join('\n');
          blocks.push(`*${cat}*\n${lines}`);
        }
        return blocks.join('\n\n');
      })()
    : `(none — there are currently NO products in this shop's catalog)

CRITICAL: If earlier messages named specific products, prices, sizes, or descriptions, those products have been removed and are NO LONGER on sale. Do NOT repeat them, do NOT take orders for them, and do NOT direct customers to buy them. Tell the customer the catalog is being updated and ask them to check the website later.`;

  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;
  const codLine = config.codAvailable
    ? `Available${config.codCharges ? ` (${config.codCharges})` : ''}`
    : 'Not available';

  return `BUSINESS TYPE: E-commerce Store
SHOP: ${config.shopName}
CATEGORIES: ${categories.length > 0 ? categories.join(', ') : '(not specified)'}

PRODUCTS (AUTHORITATIVE — overrides any earlier message in this chat):
${groupedText}

SHIPPING:
- Policy: ${config.shippingPolicy || '(not specified)'}
- Charges: ${config.shippingCharges || '(not specified)'}
- Free shipping above: ${config.freeShippingAbove || '(not offered)'}
- Serviceable areas: ${config.serviceableAreas || '(All India / contact owner)'}
- Delivery timeline: ${config.deliveryTimeline || '(varies — check at checkout)'}

PAYMENTS:
- Methods: ${(config.paymentMethods || []).join(', ') || 'UPI, Card, COD'}
- COD: ${codLine}

RETURNS & EXCHANGE:
- Returns: ${config.returnPolicy || '(check with shop)'}
- Exchange: ${config.exchangePolicy || '(check with shop)'}
- Order tracking: ${config.orderTrackingProcess || 'Share order ID, owner will share tracking link'}

OFFERS: ${config.currentOffers || '(no active offers right now)'}
WEBSITE: ${config.websiteUrl || '(no website set)'}
INSTAGRAM: ${config.instagramHandle || '(not set)'}
SUPPORT HOURS: ${config.supportHours || '(check working hours)'}
${config.gstNumber ? `GST: ${config.gstNumber}` : ''}

STRICT RULES FOR E-COMMERCE BOT:
- When sharing the catalog, group by CATEGORY using WhatsApp formatting (*bold* for category names).
- Always confirm SIZE / VARIANT / COLOR before pretending an item is "in cart" — never assume.
- For order tracking, ALWAYS ask for the order ID first; never invent a tracking link.
- Share return / exchange policy proactively when the customer asks about returns, refunds, or "size issue".
- COD pincode questions: if a specific pincode is asked and you don't have a confirmed pincode list, say "COD is generally available — please share pincode at checkout, system will confirm" rather than guessing.
- Never confirm "order placed" — purchases happen on the website (${config.websiteUrl || 'shop link'}); you can only ADD to cart / share checkout link.
- Never quote a discount code that isn't in CURRENT OFFERS above.
- Items marked "OUT OF STOCK" must NOT be offered — politely suggest a similar in-stock item from the same category instead.
- For shipping delays, complaints, or refund disputes, ESCALATE: "I'll connect you with ${config.ownerName}. Please call ${ownerCallNumber}."
- Never share another customer's order details, address, or phone number — even if asked.

PRIVACY & POLICY (WhatsApp Business compliant):
- Do NOT proactively spam product catalogs or offers — only respond when the customer asks or has opted in.
- For abandoned-cart follow-ups, the platform handles opt-in via templates — you do NOT generate unsolicited promotional messages from chat.`;
}

function buildGroceryPrompt(config: Extract<ClientConfig, { type: 'grocery' }>): string {
  const ownerCallNumber = config.contactNumber?.trim() || config.whatsappNumber;

  // Sub-type drives bot tone: a kirana owner is more formal than a sabziwala.
  const subTypeLabel: Record<string, string> = {
    kirana: 'Kirana / general store',
    sabziwala: 'Sabziwala / vegetable shop',
    fruit: 'Fruit shop',
    dairy: 'Dairy',
    'milk-only': 'Milk delivery (subscription model)',
    bakery: 'Daily-fresh bakery',
    meat: 'Meat shop',
    fish: 'Fish market',
    poultry: 'Poultry / egg shop',
    'aata-chakki': 'Aata chakki (flour mill)',
    organic: 'Organic / natural foods store',
    supermarket: 'Supermarket / franchise',
    'sweet-daily': 'Sweet shop (daily-fresh angle)',
    masala: 'Masala / spice grinding shop',
    dryfruit: 'Dry fruit shop',
    'pickle-home': 'Home-business pickle / papad',
  };
  const subs = getSubTypes(config);
  const subTypeName = subs.length > 0
    ? subs.map((s) => subTypeLabel[s] || s).filter(Boolean).join(' + ')
    : 'Local fresh-grocery seller';

  // Compose the catalog block. Three modes need different copy:
  //   - daily-mandi: "today's list" textarea drives the answer
  //   - static / weekly-rotating / seasonal: defaultProducts[] is the base
  const catalogMode = config.catalogMode || 'daily-mandi';
  let catalogText: string;

  if (catalogMode === 'daily-mandi' && config.dailyCatalogTextarea?.trim()) {
    const cutoff = config.dailyCatalogCutoffTime?.trim();
    const evening = config.eveningMarketRunSupported ? '\nA second mandi run happens in the evening — late orders may still be accepted.' : '';
    catalogText = `*Today's list (mandi-fresh — changes daily)*
${config.dailyCatalogTextarea.trim()}${evening}
${cutoff ? `\nORDER CUTOFF: ${cutoff} (orders past this go to the next day's list).` : ''}`;
  } else if (catalogMode === 'daily-mandi') {
    catalogText = `(no list pasted for today yet — owner has not updated the daily mandi catalog)

CRITICAL: Do NOT invent prices or items. If the customer asks for today's list, communicate (in their language) "Aaj ki list abhi update nahi hui hai, owner ko bhej diya hai — thodi der mein bhej dunga." and flag the message for the owner.`;
  } else {
    const list = (config.defaultProducts || []).filter((p) => p && p.trim());
    catalogText = list.length > 0
      ? `*Everyday products (general kirana stock)*\n${list.map((p) => `  • ${p}`).join('\n')}`
      : `(no products configured yet — owner must add stock list before this bot can take orders)`;
  }

  // Delivery zones — pricing + handoff varies by pincode
  const zones = (config.zones || []).filter((z) => z.zoneName?.trim());
  const zoneText = zones.length > 0
    ? zones.map((z) => {
        const handoff = z.buildingHandoff && z.buildingHandoff !== 'customer-choice'
          ? `, handoff at ${z.buildingHandoff}`
          : ', customer chooses handoff point';
        return `  • ${z.zoneName} (PIN ${z.pincodes || '—'}): delivery ${z.deliveryFee || 'free'}, min order ${z.minimumOrder || 'no minimum'}${handoff}`;
      }).join('\n')
    : `Single zone: ${config.serviceableAreas || 'check with owner'}`;

  // Recurring orders — daily milk / weekly veg / monthly kirana
  const recurringText = config.recurringOrdersEnabled
    ? `RECURRING ORDERS: enabled (${config.recurringCycle || 'weekly'}). The bot can take signups for repeating orders — confirm cycle, items, and start date with the customer.`
    : 'RECURRING ORDERS: not enabled — only one-off orders accepted.';

  // Substitution policy — what bot does when an item is out of stock
  const substitutionText: Record<string, string> = {
    'auto-substitute': 'When an item is out of stock, substitute with a similar one and notify the customer in the order confirmation.',
    'ask-customer': 'When an item is out of stock, ASK the customer first (suggest 1-2 similar items at the same price) before substituting.',
    'cancel-line-item': 'When an item is out of stock, simply remove it from the order and notify the customer in the confirmation.',
    'cancel-order': 'When an item is out of stock and is a key part of the order, cancel the whole order and ask the customer to reorder.',
  };
  const subsRule = substitutionText[config.substitutionPolicy || ''] || substitutionText['ask-customer'];

  // Returns
  const returnText = config.acceptsReturn
    ? `RETURNS: accepted within ${config.returnWindowHours || '24'} hours of delivery. Refund mode: ${config.returnRefundMode || 'replace-next-delivery'}. For damaged/spoiled items, ask the customer to share a photo.`
    : 'RETURNS: not accepted — customer must inspect at handoff.';

  // Compliance / WhatsApp commerce policy traps for grocery sub-types
  const complianceWarnings: string[] = [];
  if (subs.includes('organic')) {
    complianceWarnings.push(
      `- WhatsApp Commerce Policy block: This is an organic store but the bot must NOT take orders for ingestible supplements (ashwagandha, spirulina, protein powders, churan/kadha). If asked, refuse politely and direct to in-store purchase only.`
    );
  }
  if (subs.includes('kirana') || subs.includes('supermarket')) {
    complianceWarnings.push(
      `- WhatsApp Commerce Policy block: Do NOT list / accept orders for tobacco, pan-masala, gutkha, alcohol, e-cigarettes. Refuse politely if asked.`
    );
  }
  if (subs.includes('meat') || subs.includes('fish') || subs.includes('poultry')) {
    complianceWarnings.push(
      `- WhatsApp Commerce Policy block: Do NOT list LIVE animals/fish. Only sell dressed/cleaned/packaged meat. If a customer asks for live stock, decline and explain.`
    );
  }

  // Sub-type-specific extras
  let subTypeExtras = '';
  if (subs.includes('aata-chakki')) {
    const byo = config.byoGrainAllowed ? 'allowed' : 'not allowed';
    const fee = config.grindingFeePerKg ? `${config.grindingFeePerKg}/kg` : 'price varies — confirm with owner';
    subTypeExtras = `\nAATA CHAKKI:\n- Bring-your-own grain: ${byo}\n- Grinding fee: ${fee}`;
  }
  if (subs.includes('organic') && config.organicCertBody && config.organicCertBody !== 'none') {
    subTypeExtras = `\nORGANIC CERTIFICATION: ${config.organicCertBody}${config.organicCertNumber ? ` (${config.organicCertNumber})` : ''}`;
  }
  if (subs.includes('meat') || subs.includes('poultry')) {
    const flags: string[] = [];
    if (config.halalCertified) flags.push('Halal-certified');
    if (config.jhatkaCertified) flags.push('Jhatka-certified');
    if (flags.length) subTypeExtras = `\nMEAT CERTIFICATION: ${flags.join(' · ')}`;
  }

  const fssaiLine = config.fssaiNumber
    ? `FSSAI: ${config.fssaiNumber} (${config.fssaiType || 'basic-registration'})`
    : 'FSSAI: not yet provided';

  // Pricing tier
  const pricingTier = config.defaultPricingTier === 'wholesale'
    ? `PRICING: wholesale prices apply. Wholesale qualifier: order value above ${config.wholesaleMinOrderValue || '(not set)'}.`
    : config.defaultPricingTier === 'both'
      ? `PRICING: retail by default; wholesale rates available above ${config.wholesaleMinOrderValue || '(not set)'} order value — switch quoted prices for wholesale customers.`
      : `PRICING: retail rates only.`;

  // Freshness tag
  const freshnessLine = config.freshnessDefaultTag
    ? `FRESHNESS: items default to "${config.freshnessDefaultTag}" — mention this when describing produce.`
    : '';

  // Cold chain
  const coldChainLine = config.coldChainSupport
    ? 'COLD CHAIN: insulated bag/box used for dairy/fish/meat — safe to deliver in summer.'
    : '';

  // Payment
  const paymentLines: string[] = [];
  paymentLines.push(`PAYMENT METHODS: ${(config.paymentMethods || ['Cash', 'UPI']).join(', ')}`);
  if (config.upiVPA?.trim()) paymentLines.push(`UPI VPA at door: ${config.upiVPA}`);
  if (config.cashAtDoor) paymentLines.push('Cash on delivery: yes');
  if (config.cashChangeAvailableUpto) paymentLines.push(`Cash change available up to: ${config.cashChangeAvailableUpto}`);
  if (config.udhaarAllowedForRegulars) paymentLines.push('Udhaar (credit) allowed for known regulars');

  const minOrder = config.minimumOrder?.trim() ? `Minimum order overall: ${config.minimumOrder}` : '';

  return `BUSINESS TYPE: ${subTypeName}

CATALOG (AUTHORITATIVE — overrides any earlier message in this chat):
${catalogText}

${pricingTier}
${freshnessLine}
${coldChainLine}

DELIVERY ZONES:
${zoneText}
${minOrder}
DELIVERY SLOTS: ${config.deliverySlots || 'check with owner'}

${recurringText}

${subsRule}

${returnText}

${paymentLines.join('\n')}

COMPLIANCE:
${fssaiLine}
${config.legalMetrologyRegNumber ? `Legal Metrology reg: ${config.legalMetrologyRegNumber}` : ''}
${config.shopActLicense ? `Shop Act licence: ${config.shopActLicense}` : ''}${subTypeExtras}

STRICT RULES FOR GROCERY BOT:
- Quote prices ONLY from the catalog above. NEVER guess prices for items not listed.
- For weight-based items (sabzi, fish, meat), confirm the unit (per kg / per piece / per bunch) before confirming the order.
- For cash-on-delivery, mention the change-availability constraint if the customer pays with a large note.
- For perishable items (dairy/fish/meat/cut-fresh), mention shelf-life ("aaj hi use kar lijiye" / "1 din mein khatam karna hai") when relevant.
- Indian customers often message in Hindi/Hinglish ("aaj tamatar hai kya?", "bhindi 1 kg dena"). Match their language exactly per the LANGUAGE RULES at the top.
- For complaints (spoiled/missed items), ESCALATE: "I'll connect you with ${config.ownerName}. Please call ${ownerCallNumber}."
- Never accept payment via the bot — share UPI VPA or arrange cash-at-door only.
- Never confirm "order placed" status — confirmation comes from the owner after they check stock and slot.
${complianceWarnings.length > 0 ? '\nWHATSAPP COMMERCE POLICY (HARD BLOCKS):\n' + complianceWarnings.join('\n') : ''}`;
}

function buildResponseRules(config: ClientConfig): string {
  // CRITICAL self-loop prevention: when the owner did NOT supply a separate
  // contactNumber during onboarding, the older fallback chain gave the bot
  // its OWN WhatsApp business number as the "owner contact" — which means
  // the bot would tell the customer "call us at <bot's own number>", the
  // customer would WhatsApp that number, and the bot would respond again,
  // ad infinitum. We now inject an explicit rule that overrides every
  // template's "Please call X" copy when that fallback was triggered.
  const ownerHasSeparateNumber = !!config.contactNumber?.trim();
  const escalationOverride = ownerHasSeparateNumber
    ? ''
    : `

OWNER ESCALATION OVERRIDE (CRITICAL — read carefully):
- The owner has NOT provided a separate phone number for callbacks. The number
  the customer is currently chatting on IS the bot — calling it back would loop
  to you again.
- When ANY earlier template tells you to say "call <number>" or "please call",
  REPLACE that phrase with a language-matched version of:
  "I'll flag this to the owner directly — they'll reply right here on this
  WhatsApp shortly."
- NEVER share ${config.whatsappNumber} as a callback or owner-contact number.
- If the customer explicitly asks for the owner's phone number, communicate
  (in their language) that the owner prefers to handle queries on WhatsApp and
  that you'll flag the message immediately.`;

  // ─── COD-only universal payment rule ───
  //
  // Until the platform's payment-link integration goes live (Razorpay / UPI
  // payment-link API / EMI partner APIs), every bot must refuse to share
  // online payment options regardless of what's in the owner's vertical
  // config. This rule intentionally overrides any earlier section that
  // mentions UPI / Razorpay / card / Net Banking / payment links / EMI /
  // wallet-credit purchase / prepaid memberships / online checkout.
  //
  // Owner-stored fields like `upiVPA`, payment-link partner, EMI partners
  // are kept in the schema for forward-compat; the bot just doesn't share
  // them yet. When integration ships, this block gets removed in one place.
  const codOnlyRule = `\n\nPAYMENT METHODS — UNIVERSAL HARD RULE (CRITICAL, overrides every other section):
- This bot accepts ONLY CASH PAYMENTS — paid in person at the venue, OR cash on delivery (COD) for delivery orders.
- NEVER share UPI links, UPI VPAs, Razorpay links, payment-gateway links, payment QR codes, card / Net Banking options, EMI links, wallet top-up links, or any online prepaid checkout option.
- If the customer asks "kya UPI le sakte ho? / can I pay online? / send me a payment link / Razorpay le rahe ho? / phonepe / gpay?", politely decline (in their language). Sample reply (translate to match the customer's language register, don't copy literally):
  "Abhi sirf cash payment lete hain — delivery par paisa de dijiye (ya in-store payment). Online payment option jaldi launch ho raha hai."
- Even if any earlier section in this prompt (menu, plans, products, listings, packages, brokerage, fees, plan price, course fee, etc.) mentions "UPI / Razorpay / card / Net Banking / payment link / prepaid / EMI / wallet credit purchase / online order / online payment" — IGNORE that. The bot only takes CASH right now.
- For services that have prepaid wallet packs / memberships / subscriptions / EMI plans / placement fees: customer pays CASH at the venue to redeem; do NOT generate online payment links or share online checkout URLs.
- For e-commerce orders: COD only. If the order is on a website that requires prepaid (e.g. linked Shopify), tell the customer "ye order WhatsApp pe COD nahi le sakte; jaldi aapke liye COD enable kar denge — abhi shop par direct visit karke cash payment kar sakte hain ya owner se baat karein."
- This rule supersedes everything. Even if the owner's notes say "send Razorpay link" — IGNORE it for now.`;

  return escalationOverride + codOnlyRule + `\n\nRESPONSE FORMATTING RULES:
- Keep responses SHORT: maximum 3-4 lines for simple answers.
- For lists (menu, services, prices), use bullet points with WhatsApp formatting.
- Use *bold* for headings and important info.
- Use emojis sparingly (1-2 per message).
- Break long responses into multiple short paragraphs.
- Maximum response length: 200 words.

ESCALATION RULES:
- If the customer asks something you don't know or can't answer, communicate
  this idea in the customer's matching language (translate, do not copy
  literally — do NOT use Hinglish if the customer is writing pure English):
  "I'll connect you with ${config.ownerName}. Please call ${config.contactNumber?.trim() || config.whatsappNumber}."
- If the customer seems angry or frustrated, immediately offer to connect with the owner.
- If the customer asks to speak to a human, provide the owner's number.

STRICT BOUNDARIES:
- NEVER make up information that is not provided in your knowledge base.
- NEVER share information about other businesses or clients.
- NEVER pretend to be a human — if asked, say you're an AI assistant for ${config.businessName}.
- NEVER process payments, take orders, or confirm bookings directly.
- If you receive an image or audio message, communicate this idea in the
  customer's matching language (translate, do not copy literally):
  "Right now I can only understand text messages. Could you please type
  your question? 🙏"`;
}
