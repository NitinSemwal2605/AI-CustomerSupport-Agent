/**
 * Gemini Service Module
 * Handles API authentication, request structure formatting,
 * role mapping (system, user, assistant/model), search grounding, and response extraction.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { calculateCost } = require('../config/pricing');
const env = require('../config/env');

/**
 * Default AI Customer Support & Product Research System Persona
 */
const DEFAULT_SUPPORT_INSTRUCTION = `You are an expert AI Customer Support & Product Specialist.
Your mission is to provide accurate, comprehensive, and verified assistance to customers regarding any product, service, pricing, or troubleshooting inquiry.

When the customer asks about any product (e.g. electronics, smartphones, laptops, clothing, appliances, software, or tools):
1. Product Summary & Specs: Give a structured overview of key specifications, standout features, and ideal use cases.
2. Pros & Cons: Provide an honest, objective breakdown of benefits and potential trade-offs.
3. Where to Buy & Direct Store Links: Provide verified, direct product purchase links from multiple major platforms and retailers (such as Official Brand Store, Amazon, Best Buy, Walmart, B&H Photo, Target, etc.).
   - Format every link as a clear, clickable Markdown link: [Store Name - Product Title](URL).
   - Include current market price or deals if available.
4. Alternatives & Recommendations: If relevant, suggest 1 or 2 alternative products that offer similar value or lower price points.
5. Tone & Quality: Maintain a helpful, polite, professional, and transparent customer service tone. Rely on real-time search grounding results for fresh links and availability.`;

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
 * Deduplicate and format grounding sources
 */
function extractGroundingSources(groundingMetadata) {
  if (!groundingMetadata || !Array.isArray(groundingMetadata.groundingChunks)) {
    return [];
  }

  const seenUrls = new Set();
  const sources = [];

  for (const chunk of groundingMetadata.groundingChunks) {
    const web = chunk.web;
    if (web && web.uri && !seenUrls.has(web.uri)) {
      seenUrls.add(web.uri);
      sources.push({
        title: web.title || 'Store / Product Link',
        url: web.uri
      });
    }
  }

  return sources;
}

/**
 * Send a chat completion request to Gemini API with Google Search grounding
 */
async function sendGeminiChat({
  apiKey: customKey,
  model = 'gemini-2.5-flash',
  systemInstruction = '',
  messages = [],
  config = {}
}) {
  const apiKey = resolveApiKey(customKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const activeSystemInstruction = (systemInstruction && systemInstruction.trim())
    ? systemInstruction.trim()
    : DEFAULT_SUPPORT_INSTRUCTION;

  const generationConfig = {
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
    topP: typeof config.topP === 'number' ? config.topP : 0.95,
    maxOutputTokens: config.maxOutputTokens || (model.includes('pro') ? 4096 : 2048),
  };

  const startTime = Date.now();
  const contents = normalizeContents(messages);

  const modelOptions = {
    model,
    generationConfig,
    systemInstruction: {
      role: 'system',
      parts: [{ text: activeSystemInstruction }]
    },
    tools: [{ googleSearch: {} }] // Real-time web search grounding for live product links & data
  };

  const rawRequestPayload = {
    model: modelOptions.model,
    systemInstruction: modelOptions.systemInstruction,
    generationConfig,
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

      // Extract search grounding metadata
      const groundingMetadata = firstCandidate.groundingMetadata || null;
      const webSearchQueries = groundingMetadata?.webSearchQueries || [];
      const sources = extractGroundingSources(groundingMetadata);

      const usageMetadata = response.usageMetadata || {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      };

      const promptTokens = usageMetadata.promptTokenCount || 0;
      const candidatesTokens = usageMetadata.candidatesTokenCount || 0;
      const totalTokens = usageMetadata.totalTokenCount || (promptTokens + candidatesTokens);

      const costDetails = calculateCost(model, promptTokens, candidatesTokens);

      const rawResponsePayload = {
        candidates,
        usageMetadata,
        modelVersion: response.modelVersion || model,
        groundingMetadata
      };

      return {
        success: true,
        text: responseText,
        role: 'model',
        modelUsed: model,
        latencyMs: durationMs,
        finishReason,
        safetyRatings,
        sources,
        webSearchQueries,
        usage: {
          promptTokens,
          candidatesTokens,
          totalTokens,
          cost: costDetails
        },
        inspector: {
          rawRequest: rawRequestPayload,
          rawResponse: rawResponsePayload,
          rolesExplainer: {
            system: {
              role: 'system',
              purpose: 'Defines customer support persona, product guidelines, and web search grounding.',
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
        console.warn(`[GeminiService] Model ${modelOptions.model} returned error. Seamlessly retrying with fallback: ${fallback}`);
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

/**
 * Count tokens for a given prompt
 */
async function countPromptTokens({ apiKey: customKey, model = 'gemini-2.5-flash', text = '' }) {
  const apiKey = resolveApiKey(customKey);
  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({ model });

  const countResult = await generativeModel.countTokens(text);
  return countResult.totalTokens;
}

module.exports = {
  resolveApiKey,
  normalizeContents,
  extractGroundingSources,
  sendGeminiChat,
  countPromptTokens,
  DEFAULT_SUPPORT_INSTRUCTION
};
