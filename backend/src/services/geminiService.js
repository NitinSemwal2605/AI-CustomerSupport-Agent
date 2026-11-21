/**
 * Gemini Service Module - AI Shopping Assistant (Indian Market Focused)
 * Priority Retailer Ranking:
 * 1. Tier 1 Big Sites: Amazon India, Flipkart, Myntra, Croma, Reliance Digital, Tata CLiQ, Nykaa, Ajio, Meesho
 * 2. Popular Indian Brands: boAt, Noise, Fire-Boltt, Boult, Titan, Lenskart, Campus, Red Tape, Mamaearth, etc.
 * 3. Official Brand Stores only: Samsung, Apple, OnePlus, Xiaomi, Sony, Dell, HP, Nike, Adidas, etc.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');

/**
 * System prompt defining the AI Shopping Assistant for Indian Shoppers
 */
const DEFAULT_SHOPPING_INSTRUCTION = `You are an expert AI Shopping Assistant dedicated to Indian customers.
Your mission is to help Indian shoppers discover products, compare options, evaluate deals, and make confident purchase decisions.

CRITICAL GUIDELINES FOR INDIAN SHOPPERS:
1. Pricing & Currency:
   - ALWAYS quote prices in Indian Rupees (₹ / INR).
   - If pricing varies across models or sellers, specify the realistic price range in India (e.g. "₹14,999 to ₹16,999").
   - Mention major Indian sales when relevant (e.g., Flipkart Big Billion Days, Amazon Great Indian Festival, Republic Day / Diwali sales).
2. Priority Retailer Platforms (India):
   - Prioritize top trusted platforms for Indian buyers:
     * Tier 1 Big Sites: Amazon India (Amazon.in), Flipkart, Myntra, Croma, Reliance Digital, Tata CLiQ, Nykaa, Ajio
     * Popular Indian Brands: boAt, Noise, Fire-Boltt, Boult, Titan, Fastrack, Lenskart, Campus, Red Tape
     * Official Brand Stores: Samsung India, Apple India, OnePlus, Xiaomi, Realme, Sony India, Dell, HP, Nike, etc.
   - Format links cleanly in Markdown: [Store Name - Product Name](URL) - ₹Price / Deals.
3. Recommendations & Comparisons:
   - Provide structured, practical advice: Key Specs, Pros, Cons, and "Best For".
   - Highlight value-for-money, after-sales service network in India, and warranty coverage where applicable.
4. Tone & Style:
   - Friendly, objective, shopper-first, and concise with clean bullet points.`;

const DEFAULT_SUPPORT_INSTRUCTION = DEFAULT_SHOPPING_INSTRUCTION;

/**
 * Priority Retailer Tiers for Indian Shoppers
 */
const INDIAN_RETAILER_TIERS = [
  // Tier 1: Big E-commerce & Retail Giants in India
  { pattern: /amazon\.in/i, name: 'Amazon India', tier: 'Tier 1 Big Site', score: 100 },
  { pattern: /flipkart\.com/i, name: 'Flipkart', tier: 'Tier 1 Big Site', score: 98 },
  { pattern: /myntra\.com/i, name: 'Myntra', tier: 'Tier 1 Big Site', score: 95 },
  { pattern: /croma\.com/i, name: 'Croma', tier: 'Tier 1 Retailer', score: 92 },
  { pattern: /reliancedigital\.in/i, name: 'Reliance Digital', tier: 'Tier 1 Retailer', score: 90 },
  { pattern: /tatacliq\.com/i, name: 'Tata CLiQ', tier: 'Tier 1 Retailer', score: 88 },
  { pattern: /nykaa\.com/i, name: 'Nykaa', tier: 'Tier 1 Beauty/Fashion', score: 86 },
  { pattern: /ajio\.com/i, name: 'Ajio', tier: 'Tier 1 Fashion', score: 85 },
  { pattern: /meesho\.com/i, name: 'Meesho', tier: 'Tier 1 Value', score: 84 },

  // Tier 2: Popular Indian Brands (Audio, Wearables, Lifestyle, Footwear)
  { pattern: /boat-lifestyle\.com/i, name: 'boAt Official', tier: 'Indian Brand', score: 80 },
  { pattern: /gonoise\.com/i, name: 'Noise Official', tier: 'Indian Brand', score: 80 },
  { pattern: /fireboltt\.com/i, name: 'Fire-Boltt Official', tier: 'Indian Brand', score: 79 },
  { pattern: /boultaudio\.com/i, name: 'Boult Audio Official', tier: 'Indian Brand', score: 78 },
  { pattern: /titan\.co\.in|fastrack\.in/i, name: 'Titan / Fastrack', tier: 'Indian Brand', score: 78 },
  { pattern: /lenskart\.com/i, name: 'Lenskart', tier: 'Indian Brand', score: 77 },
  { pattern: /campusshoes\.com|redtape\.com|woodlandworldwide\.com/i, name: 'Indian Footwear', tier: 'Indian Brand', score: 76 },
  { pattern: /mamaearth\.in|zebronics\.com|portronics\.com/i, name: 'Indian Brand Store', tier: 'Indian Brand', score: 75 },

  // Tier 3: Official Global Brand Stores in India
  { pattern: /(samsung|apple|oneplus|mi|realme|sony|dell|hp|lenovo|asus|nike|adidas|puma)\.(com|in|co\.in)/i, name: 'Official Brand Store', tier: 'Official Store', score: 70 }
];

/**
 * Get active Gemini API Key
 */
function resolveApiKey(customKey) {
  const key = customKey || env.GEMINI_API_KEY;
  if (!key || !key.trim()) {
    const error = new Error('Gemini API Key missing. Set GEMINI_API_KEY in backend/.env or enter it in Settings.');
    error.statusCode = 401;
    throw error;
  }
  return key.trim();
}

/**
 * Context Management:
 * Formats chat history so Gemini API can understand it:
 * 1. Converts role 'assistant' -> 'model' (Gemini SDK uses 'model').
 * 2. Combines consecutive same-role messages (Gemini requires alternating user/model turns).
 * 3. Keeps the latest 20 messages (sliding window to prevent memory bloat).
 */
function manageContext(messages = [], maxTurns = 20) {
  if (!Array.isArray(messages)) return [];

  const turns = [];

  for (const msg of messages.slice(-maxTurns)) {
    const text = (msg.content || msg.text || '').trim();
    if (!text) continue;

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const last = turns[turns.length - 1];

    if (last && last.role === role) {
      last.parts[0].text += `\n\n${text}`;
    } else {
      turns.push({ role, parts: [{ text }] });
    }
  }

  return turns;
}

function normalizeContents(messages = []) {
  return manageContext(messages);
}

/**
 * Extract and rank web search sources prioritized for Indian customers:
 * 1. Tier 1 Big Sites (Amazon India, Flipkart, Myntra, Croma, Reliance Digital, etc.)
 * 2. Popular Indian Brands (boAt, Noise, Fire-Boltt, Titan, etc.)
 * 3. Official Brand Stores only (Samsung, Apple, OnePlus, etc.)
 */
function extractGroundingSources(groundingMetadata) {
  if (!groundingMetadata?.groundingChunks) return [];

  const sources = [];
  const seenUrls = new Set();

  for (const chunk of groundingMetadata.groundingChunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seenUrls.has(uri)) continue;
    seenUrls.add(uri);

    const rawTitle = chunk.web.title?.trim() || '';

    // Match against Indian priority tiers
    let matched = null;
    for (const item of INDIAN_RETAILER_TIERS) {
      if (item.pattern.test(uri)) {
        matched = item;
        break;
      }
    }

    if (matched) {
      sources.push({
        title: matched.name,
        originalTitle: rawTitle,
        url: uri,
        tier: matched.tier,
        score: matched.score,
        isPriority: true
      });
    } else {
      sources.push({
        title: rawTitle || 'Store Link',
        url: uri,
        tier: 'Store Link',
        score: 10,
        isPriority: false
      });
    }
  }

  return sources.sort((a, b) => b.score - a.score);
}

/**
 * Send chat completion request to Gemini API
 * 
 * Flow:
 * 1. Validate & resolve API key
 * 2. Format conversation history using `manageContext`
 * 3. Initialize Gemini model with System Instructions & Google Search tool (Grounding)
 * 4. Generate content (with automatic fallback to plain LLM if search tool fails)
 * 5. Extract response text, latency, and grounded source links (Amazon, Flipkart, etc.)
 */
async function sendGeminiChat({
  apiKey: customKey,
  model = 'gemini-2.5-flash',
  systemInstruction = '',
  messages = []
}) {
  // Step 1: Validate and retrieve the Gemini API key (from user settings or backend/.env)
  const apiKey = resolveApiKey(customKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  // Step 2: Use custom system instructions if provided, otherwise default to Indian Shopping Assistant prompt
  const activeInstruction = systemInstruction?.trim() || DEFAULT_SHOPPING_INSTRUCTION;

  // Step 3: Clean and format chat history to comply with Gemini's rules (alternating user/model roles)
  const contents = manageContext(messages);

  if (contents.length === 0) {
    return { success: false, error: 'No valid message content to send.' };
  }

  // Step 4: Configure the Gemini Model with Google Search Grounding.
  // - `systemInstruction`: Guides the AI to act as a shopping assistant for Indian shoppers and quote in ₹ INR.
  // - `tools: [{ googleSearch: {} }]`: Enables real-time Google Search grounding so Gemini can fetch
  //   live Indian product prices, recent deals, and official store URLs (Amazon.in, Flipkart, boAt, etc.).
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: {
      role: 'system',
      parts: [{ text: activeInstruction }]
    },
    tools: [{ googleSearch: {}}] // Real-time web search grounding for live product links
  });

  let response = null;

  try {
    // Attempt 1: Call Gemini with Google Search Grounding enabled.
    // Gemini will query Google Search if it needs live product info, prices, or store links.
    const result = await generativeModel.generateContent({ contents });
    response = await result.response;
  } catch (err) {
    // Attempt 2 (Fallback Mechanism):
    // If the search grounding tool fails (e.g. rate limit, tool timeout),
    // retry with standard generation without tools so the user still gets an answer.
    console.warn('Search grounding tool failed or unavailable; falling back to standard generation:', err.message);
    const fallbackModel = genAI.getGenerativeModel({
      model,
      systemInstruction: { role: 'system', parts: [{ text: activeInstruction }] }
    });
    const result = await fallbackModel.generateContent({ contents });
    response = await result.response;
  }

  // Extract live product links found via Google Search grounding
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;

  // Step 5: Return clean, essential response (text and ranked store sources)
  return {
    success: true,
    text: response.text ? response.text() : '',
    sources: extractGroundingSources(groundingMetadata)
  };
}

module.exports = {
  resolveApiKey,
  manageContext,
  normalizeContents,
  extractGroundingSources,
  sendGeminiChat,
  DEFAULT_SHOPPING_INSTRUCTION,
  DEFAULT_SUPPORT_INSTRUCTION
};
