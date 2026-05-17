// Conversation priority classifier (Work Item 7).
//
// Keyword-first, case-insensitive, word-boundary aware. Designed for the
// hot path of the webhook — runs on every inbound text BEFORE the LLM
// call so the priority can be stored on the conversations row in the
// same insert.
//
// Two tiers above 'normal':
//
//   urgent     ALWAYS takes precedence. Reserved for health / legal /
//              regulator threats — situations the owner needs to handle
//              personally within the hour. Triggers an extra escalation
//              block in the bot's system prompt: acknowledge, apologise,
//              promise an owner callback, do NOT offer discounts or
//              process new orders.
//
//   attention  Refund / wrong-order / cold-food / late-delivery /
//              aggregator-review threats / "speak to manager". Surfaces
//              the thread at the top of /client/conversations with an
//              amber dot, but the bot continues replying normally — most
//              of these have a clear resolution the bot can handle
//              (resend the order, offer to escalate, etc.).
//
//   normal     Everything else.
//
// Why keyword-first not LLM-classify: the webhook already burns one LLM
// call per turn for the reply. A second call just to classify would
// double our Groq spend on every message. Keywords cover the high-
// signal cases and are deterministic / debuggable. LLM-fallback is a
// Phase-2 sharpening if we see common false-negatives in real traffic.

import type { PriorityLevel } from './types';

// Keywords are matched as case-insensitive word-boundary occurrences in
// the normalized text. Use single tokens or short phrases; longer
// phrases reduce false positives (e.g. "food poisoning" vs "food").
//
// Indian SMB tone is informal — keep the Hinglish surface broad.
const URGENT_KEYWORDS: readonly string[] = [
  // Health emergencies — English
  'food poisoning',
  'food poisening',
  'food poisining',
  'poisoning',
  'vomiting',
  'vomit',
  'throwing up',
  'diarrhea',
  'diarrhoea',
  'hospital',
  'admitted',
  'ambulance',
  'ill from',
  'sick from',
  'allergic reaction',
  'anaphylaxis',
  'rashes',
  // Health — Hinglish / Hindi
  'bimaar',
  'beemar',
  'beemaar',
  'ulti',
  'ultiyan',
  'pet kharab',
  'dast',
  'aspatal',
  'hospital pahuncha',
  'khaakar bimaar',
  'kha kar bimaar',
  'food poisoning ho gayi',
  // Legal / regulatory
  'lawyer',
  'legal notice',
  'consumer court',
  'consumer forum',
  'fssai',
  'fssai complaint',
  'food safety',
  'police',
  'police complaint',
  'fir',
  'sue',
  'suing',
  'kanoon',
  'kanooni',
  'court mein',
];

const ATTENTION_KEYWORDS: readonly string[] = [
  // Money / refunds
  'refund',
  'refunded',
  'money back',
  'paisa wapas',
  'paisa wapis',
  'paise wapas',
  'paisa return',
  'paise return',
  'paise vapas',
  'paisa vapas',
  // Order quality
  'wrong order',
  'galat order',
  'galat item',
  'galat khana',
  'missing item',
  'item missing',
  'kuch nahi aaya',
  'kuch missing',
  'nahi aaya',
  'nahi mila',
  'cold food',
  'thanda khana',
  'thanda khaana',
  'thanda aaya',
  'half cooked',
  'kacha',
  'kachcha',
  'jhootha',
  'rotten',
  'sadi',
  'sadi hui',
  'sadhi',
  'sadha',
  'spoilt',
  'spoiled',
  'kharab',
  'kharaab',
  'baasi',
  // Delivery / timing
  'too late',
  'bahut late',
  'bahut der',
  'kab aayega',
  'kab tak aayega',
  'order late',
  'cancel my order',
  'order cancel karo',
  // Complaint surface
  'complaint',
  'complain',
  'shikayat',
  'speak to owner',
  'speak to manager',
  'speak to the owner',
  'speak to the manager',
  'talk to manager',
  'talk to the manager',
  'talk to owner',
  'talk to the owner',
  'malik se baat',
  'manager se baat',
  'owner se baat',
  'baat karwao',
  // Aggregator review threat
  'zomato review',
  'swiggy review',
  'zomato par review',
  'swiggy par review',
  'bad review',
  'one star',
  '1 star',
  'rate karunga',
  'rating doonga',
  // Emotional escalation
  'pathetic',
  'horrible',
  'disgusting',
  'ghatiya',
  'bekaar',
  'bakwaas',
  'worst',
];

// Normalize text for matching: lowercase, collapse whitespace, replace
// punctuation with spaces so "lawyer." / "lawyer," / "lawyer!" all hit.
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match a keyword as a whole-word/phrase occurrence. " phrase " test on
// padded text handles word boundaries without per-keyword regex.
function containsKeyword(text: string, keyword: string): boolean {
  if (!keyword) return false;
  return ` ${text} `.includes(` ${keyword} `);
}

export interface ClassifyResult {
  level: PriorityLevel;
  matched: string[]; // keywords that triggered (for debug / logs)
}

export function classifyPriority(raw: string | null | undefined): ClassifyResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { level: 'normal', matched: [] };
  }
  const text = normalize(raw);
  if (!text) return { level: 'normal', matched: [] };

  // Urgent wins. Collect ALL matches so the operator can see what tripped.
  const urgentHits = URGENT_KEYWORDS.filter((k) => containsKeyword(text, k));
  if (urgentHits.length > 0) {
    return { level: 'urgent', matched: urgentHits };
  }

  const attentionHits = ATTENTION_KEYWORDS.filter((k) => containsKeyword(text, k));
  if (attentionHits.length > 0) {
    return { level: 'attention', matched: attentionHits };
  }

  return { level: 'normal', matched: [] };
}
