/**
 * Gemini Service Module
 * Handles API authentication, request structure formatting,
 * role mapping (system, user, assistant/model), search grounding,
 * and verified retailer source prioritization.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');

/**
 * Default AI Customer Support & Product Research System Persona
 * Strictly enforces verified sources and prioritizes topmost e-commerce platforms (Amazon, Flipkart, Myntra, etc.)
 */
const DEFAULT_SUPPORT_INSTRUCTION = `You are an expert AI Customer Support & Product Specialist.
Your mission is to provide accurate, comprehensive, and verified assistance to customers regarding any product, service, pricing, or purchasing guidance.

CRITICAL PRODUCT LINK & RETAILER RULES:
1. Topmost Verified Retailers First:
   When listing purchase options and product links, ALWAYS prioritize and place the topmost trusted e-commerce platforms at the very top of your list:
   - Primary Stores: Amazon (Amazon.in / Amazon.com), Flipkart, Myntra
   - Official Brand Stores (e.g., Apple, Samsung, Sony, Nike, Adidas, Dell, HP, etc.)
   - Major Electronics & Department Stores (Croma, Reliance Digital, Tata CLiQ, Best Buy, Walmart, B&H Photo, Target)
2. Verified Sources Only:
   Only link to verified retailer stores and authorized dealers. Never link to YouTube, Reddit, unverified forums, social media, or random blogs for purchasing.
3. Link Formatting:
   Format every store link clearly as a Markdown hyperlink with the retailer name and product details:
   - Example: [Amazon - Product Name](URL) - Current Price & In Stock
   - Example: [Flipkart - Product Name](URL) - Special Offer / Deals
   - Example: [Myntra - Product Name](URL) - Sizes & Colors
   - Example: [Official Brand Store](URL) - Official Warranty
4. Comprehensive Product Advice:
   Provide a concise overview of key specifications, standout pros and cons, current estimated market price, and target buyer recommendations.
5. Tone: Helpful, empathetic, objective, and customer-first.`;

/**
 * Blocked / unverified domains that should not appear as product purchase links
 */
const UNVERIFIED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'tiktok.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'pinterest.com',
  'quora.com',
  'wikipedia.org',
  'medium.com',
  'blogspot.com',
  'wordpress.com',
  'vimeo.com',
  'dailymotion.com'
];

/**
 * Retailer priority tiers for ranking verified sources
 * Topmost platforms (Amazon, Flipkart, Myntra) receive highest scores.
 */
const RETAILER_PRIORITY_TIERS = [
  // Topmost Tier 1: Major E-commerce Platforms
  { pattern: /amazon\.(in|com|co\.uk|de|ca)/i, score: 100, name: 'Amazon', badge: 'Top Retailer' },
  { pattern: /flipkart\.com/i, score: 98, name: 'Flipkart', badge: 'Top Retailer' },
  { pattern: /myntra\.com/i, score: 96, name: 'Myntra', badge: 'Top Fashion' },

  // Tier 2: Major Electronics & Consumer Retailers
  { pattern: /croma\.com/i, score: 92, name: 'Croma', badge: 'Verified Store' },
  { pattern: /reliancedigital\.in/i, score: 90, name: 'Reliance Digital', badge: 'Verified Store' },
  { pattern: /tatacliq\.com/i, score: 88, name: 'Tata CLiQ', badge: 'Verified Store' },
  { pattern: /bestbuy\.com/i, score: 86, name: 'Best Buy', badge: 'Verified Store' },
  { pattern: /walmart\.com/i, score: 84, name: 'Walmart', badge: 'Verified Store' },
  { pattern: /bhphotovideo\.com/i, score: 82, name: 'B&H Photo', badge: 'Verified Store' },
  { pattern: /target\.com/i, score: 80, name: 'Target', badge: 'Verified Store' },
  { pattern: /ajio\.com/i, score: 78, name: 'Ajio', badge: 'Verified Store' },
  { pattern: /nykaa\.com/i, score: 76, name: 'Nykaa', badge: 'Verified Store' },

  // Tier 3: Official Brand Stores
  { pattern: /(apple|sony|samsung|bose|dell|hp|lenovo|asus|acer|nike|adidas|puma|boat-lifestyle|noise|oneplus|xiaomi|mi)\.com/i, score: 74, name: 'Official Brand Store', badge: 'Official Brand' }
];

/**
 * Validates and retrieves the active Gemini API key.
 */
function resolveApiKey(customKey) {
  const key = customKey || env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    const error = new Error(
      'Gemini API Key is missing. Provide it in backend/.env as GEMINI_API_KEY or enter it in Settings.'
    );
    error.statusCode = 401;
    throw error;
  }
  return key.trim();
}

/**
 * Normalize chat roles for Gemini API.
 */
function normalizeContents(messages = []) {
  return messages.map((msg) => {
    let role = msg.role;
    if (role === 'assistant') {
      role = 'model';
    }
    return {
      role: role === 'model' ? 'model' : 'user',
      parts: Array.isArray(msg.parts)
        ? msg.parts
        : [{ text: typeof msg.content === 'string' ? msg.content : (msg.text || '') }]
    };
  });
}

/**
 * Filter out unverified/video/social domains and rank verified retailers to the top
 * Top priority: Amazon, Flipkart, Myntra, followed by Croma, Reliance, Official Brand Stores.
 */
function extractGroundingSources(groundingMetadata) {
  if (!groundingMetadata || !Array.isArray(groundingMetadata.groundingChunks)) {
    return [];
  }

  const seenUrls = new Set();
  const parsedSources = [];

  for (const chunk of groundingMetadata.groundingChunks) {
    const web = chunk.web;
    if (!web || !web.uri) continue;

    const rawTitle = (web.title || '').trim();
    const rawUri = web.uri.trim();

    // Check against unverified/blocked list
    const isBlocked = UNVERIFIED_DOMAINS.some(
      (blocked) => rawTitle.toLowerCase().includes(blocked) || rawUri.toLowerCase().includes(blocked)
    );
    if (isBlocked) continue;

    if (seenUrls.has(rawUri)) continue;
    seenUrls.add(rawUri);

    // Score and identify retailer
    let score = 20; // default score for generic product pages
    let displayName = rawTitle || 'Product Link';
    let badge = 'Store Link';
    let isTopTier = false;

    for (const tier of RETAILER_PRIORITY_TIERS) {
      if (tier.pattern.test(rawTitle) || tier.pattern.test(rawUri)) {
        score = tier.score;
        displayName = tier.name;
        badge = tier.badge;
        isTopTier = true;
        break;
      }
    }

    parsedSources.push({
      title: displayName,
      originalTitle: rawTitle,
      url: rawUri,
      score,
      badge,
      isTopTier
    });
  }

  // Sort descending: Amazon (100) -> Flipkart (98) -> Myntra (96) -> Croma -> Best Buy -> Official Stores -> Others
  return parsedSources.sort((a, b) => b.score - a.score);
}

/**
 * Send a chat completion request to Gemini API with Google Search grounding
 */
async function sendGeminiChat({
  apiKey: customKey,
  model = 'gemini-2.5-flash',
  systemInstruction = '',
  messages = []
}) {
  const apiKey = resolveApiKey(customKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const activeSystemInstruction = (systemInstruction && systemInstruction.trim())
    ? systemInstruction.trim()
    : DEFAULT_SUPPORT_INSTRUCTION;

  const startTime = Date.now();
  const contents = normalizeContents(messages);

  const modelOptions = {
    model,
    systemInstruction: {
      role: 'system',
      parts: [{ text: activeSystemInstruction }]
    },
    tools: [{ googleSearch: {} }] // Real-time web search grounding for live product links & data
  };

  const rawRequestPayload = {
    model: modelOptions.model,
    systemInstruction: modelOptions.systemInstruction,
    contents,
    tools: modelOptions.tools
  };

  let lastError = null;
  let useSearchTools = true;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const currentOptions = { ...modelOptions };
      if (!useSearchTools) {
        delete currentOptions.tools;
      }

      const generativeModel = genAI.getGenerativeModel(currentOptions);
      const result = await generativeModel.generateContent({ contents });
      const response = await result.response;
      const durationMs = Date.now() - startTime;

      const responseText = response.text ? response.text() : '';
      const candidates = response.candidates || [];
      const firstCandidate = candidates[0] || {};
      const finishReason = firstCandidate.finishReason || 'STOP';
      const safetyRatings = firstCandidate.safetyRatings || [];

      // Extract verified & prioritized search grounding sources
      const groundingMetadata = firstCandidate.groundingMetadata || null;
      const webSearchQueries = groundingMetadata?.webSearchQueries || [];
      const sources = extractGroundingSources(groundingMetadata);

      const rawResponsePayload = {
        candidates,
        modelVersion: response.modelVersion || modelOptions.model,
        groundingMetadata
      };

      return {
        success: true,
        text: responseText,
        role: 'model',
        modelUsed: modelOptions.model,
        latencyMs: durationMs,
        finishReason,
        safetyRatings,
        sources,
        webSearchQueries,
        inspector: {
          rawRequest: rawRequestPayload,
          rawResponse: rawResponsePayload,
          rolesExplainer: {
            system: {
              role: 'system',
              purpose: 'Defines customer support persona, verified retailer prioritization, and web search grounding.',
              appliedAs: 'systemInstruction parameter in model initialization.'
            },
            user: {
              role: 'user',
              purpose: 'The product inquiry, comparison, or issue prompt from the customer.',
              appliedAs: '{ role: "user", parts: [{ text: "..." }] }'
            },
            model: {
              role: 'model (assistant)',
              purpose: 'Previous AI responses in multi-turn customer conversation history.',
              appliedAs: '{ role: "model", parts: [{ text: "..." }] }'
            }
          }
        }
      };
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || '';

      // If tools are not supported for this model, retry once without tools
      if (useSearchTools && (errorMsg.includes('tool') || errorMsg.includes('not supported') || errorMsg.includes('INVALID_ARGUMENT'))) {
        useSearchTools = false;
        continue;
      }

      // If high demand spike (503) or deprecated model (404), switch model to fallback and retry
      const isHighDemand = errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('no longer available') || errorMsg.includes('404');
      if (isHighDemand && attempt <= 2) {
        const fallback = modelOptions.model === 'gemini-3.5-flash-lite' ? 'gemini-flash-latest' : 'gemini-3.5-flash-lite';
        console.warn(`[GeminiService] Model ${modelOptions.model} returned error. Retrying with fallback: ${fallback}`);
        modelOptions.model = fallback;
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      break;
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    success: false,
    error: lastError?.message || 'Gemini API call failed',
    latencyMs: durationMs,
    inspector: {
      errorDetails: {
        message: lastError?.message,
        stack: lastError?.stack
      }
    }
  };
}

module.exports = {
  resolveApiKey,
  normalizeContents,
  extractGroundingSources,
  sendGeminiChat,
  DEFAULT_SUPPORT_INSTRUCTION
};
