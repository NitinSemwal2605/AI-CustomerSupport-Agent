/**
 * Chat & Gemini AI Controller
 * Handles conversation completions, API testing, models listing, and token counting.
 */

const { PRICING_TIERS } = require('../config/pricing');
const { sendGeminiChat, countPromptTokens } = require('../services/geminiService');
const env = require('../config/env');

async function handleChat(req, res, next) {
  try {
    const keyFromHeader = req.headers['x-gemini-api-key'];
    const {
      apiKey: keyFromBody,
      model = 'gemini-2.5-flash',
      systemInstruction = '',
      messages = [],
      config = {}
    } = req.body;

    const activeKey = keyFromBody || keyFromHeader || env.GEMINI_API_KEY;

    if (!activeKey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication Required: Please enter your Gemini API key in Settings or set GEMINI_API_KEY in backend/.env.',
        authHelp: 'You can get an API key for free from https://aistudio.google.com/'
      });
    }

    if (!messages || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "messages" array cannot be empty.'
      });
    }

    const chatResponse = await sendGeminiChat({
      apiKey: activeKey,
      model,
      systemInstruction,
      messages,
      config
    });

    if (!chatResponse.success) {
      return res.status(500).json(chatResponse);
    }

    return res.json(chatResponse);
  } catch (err) {
    next(err);
  }
}

async function handleTestKey(req, res, next) {
  try {
    const keyFromHeader = req.headers['x-gemini-api-key'];
    const keyFromBody = req.body.apiKey;
    const targetKey = keyFromBody || keyFromHeader || env.GEMINI_API_KEY;

    if (!targetKey) {
      return res.status(400).json({
        success: false,
        message: 'No API key provided. Supply one in the request or in backend/.env'
      });
    }

    const testResult = await sendGeminiChat({
      apiKey: targetKey,
      model: 'gemini-2.5-flash',
      systemInstruction: 'Respond only with: OK',
      messages: [{ role: 'user', content: 'Ping' }],
      config: { maxOutputTokens: 50, temperature: 0.1 }
    });

    if (testResult.success) {
      return res.json({
        success: true,
        message: 'Authentication successful! Your Gemini API key is valid.',
        latencyMs: testResult.latencyMs
      });
    } else {
      return res.status(401).json({
        success: false,
        message: testResult.error || 'Authentication failed'
      });
    }
  } catch (err) {
    next(err);
  }
}

async function handleCountTokens(req, res, next) {
  try {
    const keyFromHeader = req.headers['x-gemini-api-key'];
    const { apiKey: keyFromBody, model = 'gemini-2.5-flash', text = '' } = req.body;
    const activeKey = keyFromBody || keyFromHeader || env.GEMINI_API_KEY;

    if (!activeKey) {
      const approxTokens = Math.ceil(text.length / 4);
      return res.json({
        totalTokens: approxTokens,
        isApproximate: true,
        note: 'Approximate count (4 chars/token). Provide API key for exact SDK count.'
      });
    }

    try {
      const totalTokens = await countPromptTokens({
        apiKey: activeKey,
        model,
        text
      });
      return res.json({ totalTokens, isApproximate: false });
    } catch (err) {
      const approxTokens = Math.ceil(text.length / 4);
      return res.json({
        totalTokens: approxTokens,
        isApproximate: true,
        warning: err.message
      });
    }
  } catch (err) {
    next(err);
  }
}

function handleGetModels(req, res) {
  const models = [
    {
      id: 'gemini-flash-latest',
      name: 'Gemini Flash Latest',
      tag: 'Recommended (Official Google AI Studio)',
      description: 'The latest release of Gemini Flash with maximum speed and cost efficiency.',
      pricing: PRICING_TIERS['gemini-flash-latest']
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      tag: 'Fast & High Throughput',
      description: 'Next-gen lightweight model, optimized for speed and cost efficiency.',
      pricing: PRICING_TIERS['gemini-2.5-flash']
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      tag: 'Complex Reasoning',
      description: 'High-capability model designed for sophisticated reasoning and coding.',
      pricing: PRICING_TIERS['gemini-1.5-pro']
    }
  ];

  res.json({ models });
}

function handleGetHealth(req, res) {
  const hasEnvKey = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim());
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    auth: {
      hasEnvKey,
      hint: hasEnvKey
        ? 'Backend .env API key is configured'
        : 'No backend API key configured yet. You can provide one via frontend settings or add GEMINI_API_KEY in backend/.env'
    }
  });
}

module.exports = {
  handleChat,
  handleTestKey,
  handleCountTokens,
  handleGetModels,
  handleGetHealth
};
