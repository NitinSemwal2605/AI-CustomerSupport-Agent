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
 * Stream chat completion chunks from Gemini API
 *
 * Flow:
 * 1. Validate & resolve API key
 * 2. Format conversation history using `manageContext`
 * 3. Initialize Gemini model with Google Search grounding
 * 4. Call `model.generateContentStream({ contents })`
 * 5. Stream chunks in real-time via `onChunk(text)` callback
 * 6. Extract grounding sources upon stream completion
 */
async function streamGeminiChat({
  apiKey: customKey,
  model = 'gemini-2.5-flash',
  systemInstruction = '',
  messages = [],
  onChunk
}) {
  const apiKey = resolveApiKey(customKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const activeInstruction = systemInstruction?.trim() || DEFAULT_SHOPPING_INSTRUCTION;
  const contents = manageContext(messages);

  if (contents.length === 0) {
    throw new Error('No valid message content to send.');
  }

  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: {
      role: 'system',
      parts: [{ text: activeInstruction }]
    },
    tools: [{ googleSearch: {} }] // Real-time web search grounding for live product links
  });

  let streamResult = null;

  try {
    // Attempt 1: Stream with Google Search grounding enabled
    streamResult = await generativeModel.generateContentStream({ contents });
  } catch (err) {
    // Fallback: Stream without search tools if grounding tool encounters an error
    console.warn('Search grounding stream failed; falling back to standard stream:', err.message);
    const fallbackModel = genAI.getGenerativeModel({
      model,
      systemInstruction: { role: 'system', parts: [{ text: activeInstruction }] }
    });
    streamResult = await fallbackModel.generateContentStream({ contents });
  }

  let fullText = '';

  // Stream each chunk token-by-token
  for await (const chunk of streamResult.stream) {
    const chunkText = chunk.text ? chunk.text() : '';
    if (chunkText) {
      fullText += chunkText;
      if (typeof onChunk === 'function') {
        onChunk(chunkText);
      }
    }
  }

  // Once stream completes, extract live store sources from grounding metadata and token usage
  let sources = [];
  let usage = null;
  try {
    const finalResponse = await streamResult.response;
    const groundingMetadata = finalResponse.candidates?.[0]?.groundingMetadata || null;
    sources = extractGroundingSources(groundingMetadata);

    if (finalResponse.usageMetadata) {
      usage = {
        promptTokens: finalResponse.usageMetadata.promptTokenCount || 0,
        candidatesTokens: finalResponse.usageMetadata.candidatesTokenCount || 0,
        totalTokens: finalResponse.usageMetadata.totalTokenCount || 0
      };
    }
  } catch {
    sources = [];
  }

  return {
    fullText,
    sources,
    usage
  };
}

module.exports = {
  resolveApiKey,
  manageContext,
  normalizeContents,
  extractGroundingSources,
  streamGeminiChat,
  DEFAULT_SHOPPING_INSTRUCTION
};
