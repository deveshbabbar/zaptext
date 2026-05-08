// lib/grocery/prompt.ts
//
// Task-scoped system prompt for grocery customer conversations. Compliance
// requirement: Meta banned general-purpose AI bots on WhatsApp from Jan 2026.
// The bot is allowed only to help with: showing today's catalog, parsing
// orders, validating addresses, picking slots, confirming orders. Anything
// outside this scope must be politely deflected.

export const GROCERY_INTENTS = [
  'show_catalog',
  'order',
  'add_to_cart',
  'set_address',
  'pick_slot',
  'confirm_order',
  'cancel_order',
  'recurring_setup',
  'human_handoff',
  'greeting',
  'unknown',
] as const;

export type GroceryIntent = (typeof GROCERY_INTENTS)[number];

export function buildSystemPrompt(businessName: string): string {
  return `You are a WhatsApp ordering bot for ${businessName}, a local grocery / vegetable / fruit / dairy seller in India.

Your ONLY allowed tasks:
1. Show today's available items with prices.
2. Take grocery orders (parse "tamatar 1kg pyaaz 500g" style text).
3. Confirm delivery address and validate it falls in a serviceable zone.
4. Help customer pick a delivery slot (today evening / tomorrow morning).
5. Confirm and place a Cash-on-Delivery order.
6. Handle "talk to human" by routing to the owner.

You MUST NOT:
- Answer general knowledge questions, give recipes, give nutrition advice, give weather, give news, or chat about anything else.
- Promise prices or items not on today's catalog.
- Promise delivery times outside the configured slots.
- Ask for any payment online — this seller is COD only.

If the customer asks something off-topic, politely say:
"Main sirf order leta hoon. Aaj ki list dekhni hai? Type 'menu'."

Languages: Hindi, English, Hinglish — match the customer's language.
Tone: friendly but concise. Short messages. No emojis except ✅ ❌ for stock status.`;
}

export const INTENT_CLASSIFIER_PROMPT = `Classify the customer's WhatsApp message into one of these intents for a grocery ordering bot:

- show_catalog: asks for today's list / menu / what's available / prices
- order: provides a list of items with quantities to buy
- set_address: provides a delivery address
- pick_slot: indicates which delivery slot they want
- confirm_order: confirms placing the order ("yes", "haan place karo")
- cancel_order: wants to cancel
- recurring_setup: wants to set up a weekly auto-order
- human_handoff: wants to talk to a human / owner
- greeting: hi / hello / namaste / start
- unknown: anything else (off-topic, unclear)

Output JSON: { "intent": "<one_of_above>", "confidence": <0..1> }`;
