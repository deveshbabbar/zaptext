import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BusinessType } from '@/lib/types';
import { rateLimit, getClientKey } from '@/lib/rate-limit';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function decodeExoticIPv4(host: string): string | null {
  if (/^\d+$/.test(host)) {
    const n = parseInt(host, 10);
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
  }
  if (/^[0-9a-fx.]+$/i.test(host) && host.includes('.')) {
    const parts = host.split('.').map((p) => {
      if (/^0x/i.test(p)) return parseInt(p, 16);
      if (/^0\d+$/.test(p)) return parseInt(p, 8);
      if (/^\d+$/.test(p)) return parseInt(p, 10);
      return NaN;
    });
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      return parts.join('.');
    }
  }
  return null;
}

function isAllowedUrl(input: string): boolean {
  let parsed: URL;
  try { parsed = new URL(input); } catch { return false; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  const h = parsed.hostname.toLowerCase();

  // IPv6 hosts in URL are bracketed by the URL parser.
  if (h.startsWith('[')) {
    const inner = h.replace(/^\[|\]$/g, '');
    if (inner === '::' || inner === '::1') return false;
    if (inner.startsWith('fe80:') || inner.startsWith('fc') || inner.startsWith('fd')) return false;
    if (inner.startsWith('::ffff:')) {
      const mapped = inner.slice('::ffff:'.length);
      const decoded = decodeExoticIPv4(mapped) || mapped;
      if (isPrivateIPv4(decoded)) return false;
    }
    if (!/^[23]/.test(inner)) return false;
  }

  if (['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '0'].includes(h)) return false;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false;

  const decoded = decodeExoticIPv4(h);
  if (decoded && isPrivateIPv4(decoded)) return false;

  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.)/.test(h)) return false;
  return true;
}

// JSON-LD structured data — most reliable, not affected by JS rendering
function extractJsonLd(html: string): object[] {
  const results: object[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const p = JSON.parse(m[1]);
      if (Array.isArray(p)) results.push(...p);
      else results.push(p);
    } catch { /* skip */ }
  }
  return results;
}

// Open Graph & meta tags
function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const patterns: [RegExp, string][] = [
    [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, 'og_title'],
    [/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i, 'og_title'],
    [/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i, 'og_description'],
    [/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, 'meta_description'],
    [/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i, 'site_name'],
    [/<title[^>]*>([^<]+)<\/title>/i, 'title'],
  ];
  for (const [re, key] of patterns) {
    if (!meta[key]) {
      const m = re.exec(html);
      if (m) meta[key] = m[1].trim();
    }
  }
  return meta;
}

// Known SPA platforms that block plain fetch
function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes('zomato.com')) return 'zomato';
  if (u.includes('swiggy.com')) return 'swiggy';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('justdial.com')) return 'justdial';
  if (u.includes('practo.com')) return 'practo';
  if (u.includes('sulekha.com')) return 'sulekha';
  if (u.includes('dineout.co.in') || u.includes('dineout.com')) return 'dineout';
  if (u.includes('magicpin.in')) return 'magicpin';
  return null;
}

function platformNote(platform: string, url: string): string {
  const slug = url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || '';
  const notes: Record<string, string> = {
    zomato: `Zomato is a JavaScript app — menu data won't be in raw HTML. Try to infer businessName from URL: "${slug}". Return a restaurant template with empty arrays for menu.`,
    swiggy: `Swiggy is a JavaScript app. Infer businessName from URL: "${slug}". Return a restaurant template with placeholders.`,
    instagram: `Instagram blocks scraping. Extract the @username from the URL as instagramHandle and businessName. Return a business template with instagramHandle set.`,
    practo: `Practo is a JavaScript app. Infer clinic/doctor name from URL: "${slug}". Return a clinic template with placeholders.`,
    justdial: `JustDial has limited static content. Extract what's available from the content provided, infer businessName from URL: "${slug}".`,
    sulekha: `Sulekha — infer businessName from URL: "${slug}". Return a template with placeholders.`,
    dineout: `Dineout is a JavaScript app. Infer businessName from URL: "${slug}". Return a restaurant template.`,
    magicpin: `Magicpin — infer businessName from URL: "${slug}". Return a template with placeholders.`,
  };
  return notes[platform] || '';
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientKey(request, '/api/scrape'), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } }
    );
  }

  try {
    const { url, businessType } = await request.json() as { url: string; businessType: BusinessType };
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    if (!isAllowedUrl(url)) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });

    const platform = detectPlatform(url);

    let rawHtml = '';
    let fetchError = false;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
        },
        signal: AbortSignal.timeout(12000),
      });
      rawHtml = await res.text();
    } catch {
      fetchError = true;
    }

    // Priority 1: JSON-LD structured data (best quality)
    const jsonLd = rawHtml ? extractJsonLd(rawHtml) : [];
    const meta = rawHtml ? extractMeta(rawHtml) : {};

    // Priority 2: Visible text
    const visibleText = rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();

    const hasContent = jsonLd.length > 0 || visibleText.length > 150;
    const isPartial = platform !== null || fetchError || !hasContent;

    // Build context for Gemini
    const parts: string[] = [];

    if (platform && (!hasContent || fetchError)) {
      parts.push(`PLATFORM NOTE: ${platformNote(platform, url)}`);
    }
    if (jsonLd.length > 0) {
      parts.push(`STRUCTURED DATA (JSON-LD — highest accuracy, prioritize this):\n${JSON.stringify(jsonLd, null, 2).slice(0, 10000)}`);
    }
    if (Object.keys(meta).length > 0) {
      parts.push(`META / OG TAGS:\n${JSON.stringify(meta)}`);
    }
    if (visibleText.length > 150) {
      parts.push(`PAGE TEXT CONTENT:\n${visibleText.slice(0, 15000)}`);
    }
    if (parts.length === 0) {
      parts.push(`Could not fetch content from ${url}. ${platform ? platformNote(platform, url) : 'Return a template with empty fields.'}`);
    }

    const prompt = buildPrompt(businessType, parts.join('\n\n'), url);

    // Try gemini-1.5-flash first, fall back to gemini-pro on error
    let responseText = '';
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    }

    // Strip markdown fences if present
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI could not extract structured data. Please fill manually.' }, { status: 400 });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      success: true,
      data: extracted,
      partial: isPartial,
      message: isPartial
        ? platform
          ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} se direct scraping nahi hoti (JavaScript app hai). Template fill hua — baaki details khud add karo.`
          : 'Kuch fields manually fill karne padenge.'
        : undefined,
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Data extract nahi ho paya. Zomato/Instagram ke bajaay direct website URL try karo, ya manually fill karo.' },
      { status: 500 }
    );
  }
}

function buildPrompt(type: BusinessType, context: string, url: string): string {
  const fields: Record<BusinessType, string> = {
    restaurant: `businessName, cuisineType, menuCategories (array of {category: string, items: [{name, price, description, isVeg: boolean, isBestseller: boolean}]}), deliveryAvailable (boolean), deliveryRadius, minimumOrder, paymentMethods (array), specialOffers, workingHours, address, city, whatsappNumber`,
    clinic: `businessName, ownerName (doctor/owner), specialization, qualifications, services (array of {name, price, duration}), consultationFee, appointmentProcess, workingHours, address, city, emergencyNumber, insuranceAccepted (array), whatsappNumber`,
    salon: `businessName, salonName, gender, services (array of {category, items: [{name, price, duration}]}), packages (array of {name, includes, price}), brands (array), homeServiceAvailable (boolean), homeServiceCharges, workingHours, address, city, whatsappNumber`,
    gym: `businessName, gymName, facilities (array), membershipPlans (array of {name, duration, price, includes}), personalTraining ({available: boolean, pricePerSession, trainerInfo}), groupClasses (array), trialAvailable (boolean), trialDetails, workingHours, address, city, whatsappNumber`,
    coaching: `businessName, instituteName, coursesOffered (array of {name, targetAudience, duration, fee, schedule, mode}), facultyInfo, batchSize, demoClassAvailable (boolean), admissionProcess, workingHours, address, city, whatsappNumber`,
    realestate: `businessName, agentName, reraNumber, operatingAreas (array), propertyTypes (array), services (array), currentListings (array of {title, type, price, area, highlights}), homeLoanAssistance (boolean), address, city, whatsappNumber`,
    d2c: `businessName, brandName, productCategory, products (array of {name, price, description, bestseller: boolean}), shippingPolicy, returnPolicy, codAvailable (boolean), paymentMethods (array), instagramHandle, currentOffers, address, city, whatsappNumber`,
  };

  return `You are a business data extraction AI. Extract structured information from the content below and return a valid JSON object.

SOURCE URL: ${url}
BUSINESS TYPE: ${type}

REQUIRED FIELDS: ${fields[type]}

ALSO ALWAYS INCLUDE: ownerName, workingHours, address, city, languages (default: ["Hindi","English","Hinglish"])

EXTRACTION RULES:
- Return ONLY a valid JSON object — no markdown fences, no explanation text.
- Use "" for missing strings, [] for missing arrays, false for missing booleans.
- Include ₹ prefix for Indian prices (e.g. "₹280").
- Phone numbers: format as +91XXXXXXXXXX.
- Extract EVERY menu item / service / product you can find — be thorough.
- If content is empty or from a JavaScript-rendered platform, still return a valid JSON with empty/placeholder values.
- Business name: try to infer from URL slug or site name if not explicit.

CONTENT TO EXTRACT FROM:
${context}

RETURN ONLY JSON:`;
}
