import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BusinessType } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { url, businessType } = await request.json() as { url: string; businessType: BusinessType };

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch website content
    let htmlContent = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      htmlContent = await res.text();
    } catch {
      return NextResponse.json({ error: 'Could not fetch the website. Check the URL.' }, { status: 400 });
    }

    // Clean HTML - remove scripts, styles, keep text content
    const cleanedText = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Limit to 15k chars for Gemini

    if (cleanedText.length < 50) {
      return NextResponse.json({ error: 'Could not extract meaningful content from this website.' }, { status: 400 });
    }

    // Build Gemini prompt based on business type
    const extractionPrompt = buildExtractionPrompt(businessType, cleanedText);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(extractionPrompt);
    const responseText = result.response.text();

    // Parse JSON from Gemini response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI could not extract structured data from this website.' }, { status: 400 });
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Failed to extract data. Try a different URL or fill manually.', details: String(error) },
      { status: 500 }
    );
  }
}

function buildExtractionPrompt(type: BusinessType, websiteText: string): string {
  const typeInstructions: Record<BusinessType, string> = {
    clinic: `Extract: businessName, ownerName (doctor name), specialization, qualifications, services (array of {name, price, duration}), consultationFee, appointmentProcess, workingHours, address, city, emergencyNumber, insuranceAccepted (array of strings), phone number as whatsappNumber.`,

    restaurant: `Extract: businessName, cuisineType, menuCategories (array of {category, items: [{name, price, description, isVeg (boolean), isBestseller (boolean)}]}), deliveryAvailable (boolean), deliveryRadius, deliveryCharges, minimumOrder, paymentMethods (array), specialOffers, workingHours, address, city, phone number as whatsappNumber. Try to extract EVERY menu item with correct prices.`,

    coaching: `Extract: businessName, instituteName, coursesOffered (array of {name, targetAudience, duration, fee, schedule, mode}), facultyInfo, batchSize, demoClassAvailable (boolean), admissionProcess, results, studyMaterial, workingHours, address, city, phone number as whatsappNumber.`,

    realestate: `Extract: businessName, agentName, reraNumber, operatingAreas (array), propertyTypes (array), services (array like ["Buy","Sell","Rent"]), currentListings (array of {title, type, price, area, highlights}), siteVisitProcess, homeLoanAssistance (boolean), homeLoanBanks (array), address, city, phone number as whatsappNumber.`,

    salon: `Extract: businessName, salonName, gender ("Unisex"/"Women only"/"Men only"), services (array of {category, items: [{name, price, duration}]}), packages (array of {name, includes, price}), brands (array), bookingRequired (boolean), homeServiceAvailable (boolean), homeServiceCharges, workingHours, address, city, phone number as whatsappNumber.`,

    d2c: `Extract: businessName, brandName, productCategory, products (array of {name, price, description, bestseller (boolean)}), shippingPolicy, returnPolicy, codAvailable (boolean), paymentMethods (array), websiteUrl, instagramHandle, currentOffers, orderTrackingProcess, address, city, phone number as whatsappNumber.`,

    gym: `Extract: businessName, gymName, facilities (array), membershipPlans (array of {name, duration, price, includes}), personalTraining ({available: boolean, pricePerSession, trainerInfo}), groupClasses (array), trialAvailable (boolean), trialDetails, timings, workingHours, address, city, phone number as whatsappNumber.`,
  };

  return `You are a data extraction AI. Extract business information from the following website content and return it as a valid JSON object.

BUSINESS TYPE: ${type}

EXTRACT THESE FIELDS:
${typeInstructions[type]}

RULES:
- Return ONLY a valid JSON object, no other text.
- If a field is not found, use empty string "" for strings, empty array [] for arrays, false for booleans.
- For prices, include the currency symbol (₹ or Rs.).
- Extract as much data as possible — every menu item, every service, every product.
- For phone numbers, format as +91XXXXXXXXXX if Indian.
- Be thorough — go through the entire content.
- Also extract: ownerName, workingHours, address, city, languages (default to ["Hindi","English","Hinglish"]).

WEBSITE CONTENT:
${websiteText}

RESPOND WITH ONLY THE JSON:`;
}
