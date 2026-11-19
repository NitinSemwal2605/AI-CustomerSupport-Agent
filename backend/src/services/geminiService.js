/**
 * Gemini Service Module
 * Handles API authentication, request structure formatting,
 * role mapping (system, user, assistant/model), and response extraction.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { calculateCost } = require('../config/pricing');
const env = require('../config/env');

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
 * Send a chat completion request to Gemini API
 */
async function sendGeminiChat({
  apiKey: customKey,
  model = 'gemini-flash-latest',
  systemInstruction = 'You are a helpful, clear, and concise AI customer support assistant.',
  messages = [],
  config = {}
}) {
  const apiKey = resolveApiKey(customKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const generationConfig = {
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
    topP: typeof config.topP === 'number' ? config.topP : 0.95,
    maxOutputTokens: config.maxOutputTokens || (model.includes('pro') ? 4096 : 2048),
  };

  const startTime = Date.now();

  const modelOptions = {
    model,
    generationConfig
  };

  if (systemInstruction && systemInstruction.trim()) {
    modelOptions.systemInstruction = {
      role: 'system',
      parts: [{ text: systemInstruction.trim() }]
    };
  }

  const generativeModel = genAI.getGenerativeModel(modelOptions);
  const contents = normalizeContents(messages);

  const rawRequestPayload = {
    model: modelOptions.model,
    systemInstruction: modelOptions.systemInstruction || null,
    generationConfig,
    contents
  };

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await generativeModel.generateContent({ contents });
      const response = await result.response;
      const durationMs = Date.now() - startTime;

      const responseText = response.text ? response.text() : '';
      const candidates = response.candidates || [];
      const firstCandidate = candidates[0] || {};
      const finishReason = firstCandidate.finishReason || 'STOP';
      const safetyRatings = firstCandidate.safetyRatings || [];

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
      };

      return {
        success: true,
        text: responseText,
        role: 'model',
        modelUsed: model,
        latencyMs: durationMs,
        finishReason,
        safetyRatings,
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
              purpose: 'Defines model persona, guidelines, boundaries, and formatting instructions.',
              appliedAs: 'systemInstruction parameter in model initialization.'
            },
            user: {
              role: 'user',
              purpose: 'The prompt or input provided by the customer or engineer.',
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
      const isHighDemand = error.message && (error.message.includes('503') || error.message.includes('high demand'));
      if (isHighDemand && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1500));
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
  sendGeminiChat,
  countPromptTokens
};
