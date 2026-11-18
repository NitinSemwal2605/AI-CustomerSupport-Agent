/**
 * Gemini Node.js Express Backend Server
 * 
 * Features:
 * - Direct Gemini API integration via @google/generative-ai
 * - Dynamic API authentication (supports .env or header/request-level key)
 * - Transparent request/response telemetry & inspector
 * - Role conversion and validation (system, user, assistant/model)
 * - Token counting and real-time USD cost estimation
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PRICING_TIERS, calculateCost } = require('./geminiPricing');
const { sendGeminiChat, countPromptTokens } = require('./geminiService');
const { registerUser, loginUser, authMiddleware } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*', // Allows requests from Vite dev server (e.g. http://localhost:5173)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-api-key']
}));

app.use(express.json({ limit: '10mb' }));

/**
 * 1. JWT AUTHENTICATION ENDPOINTS
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = await registerUser({ name, email, password });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * 2. HEALTH & AUTH STATUS ENDPOINT
 */
app.get('/api/health', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
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
});

/**
 * 2. LIST AVAILABLE MODELS & PRICING
 */
app.get('/api/models', (req, res) => {
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
});

/**
 * 3. TEST API KEY AUTHENTICATION
 * Runs a 1-token test prompt to verify credentials with Google AI Studio
 */
app.post('/api/test-key', async (req, res) => {
  const keyFromHeader = req.headers['x-gemini-api-key'];
  const keyFromBody = req.body.apiKey;
  const targetKey = keyFromBody || keyFromHeader || process.env.GEMINI_API_KEY;

  if (!targetKey) {
    return res.status(400).json({
      success: false,
      message: 'No API key provided. Supply one in the request or in backend/.env'
    });
  }

  try {
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
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

/**
 * 4. CHAT COMPLETION ENDPOINT
 * Primary endpoint for conversational interaction
 */
app.post('/api/chat', async (req, res) => {
  const keyFromHeader = req.headers['x-gemini-api-key'];
  const {
    apiKey: keyFromBody,
    model = 'gemini-2.5-flash',
    systemInstruction = '',
    messages = [],
    config = {}
  } = req.body;

  const activeKey = keyFromBody || keyFromHeader || process.env.GEMINI_API_KEY;

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

  try {
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
  } catch (error) {
    console.error('API Error in /api/chat:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while calling Gemini API'
    });
  }
});

/**
 * 5. TOKEN COUNTER ENDPOINT
 * Accurately calculate tokens before sending large prompts
 */
app.post('/api/count-tokens', async (req, res) => {
  const keyFromHeader = req.headers['x-gemini-api-key'];
  const { apiKey: keyFromBody, model = 'gemini-2.5-flash', text = '' } = req.body;
  const activeKey = keyFromBody || keyFromHeader || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    // Return approximate estimation if key is not yet configured (1 token ≈ 4 characters)
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
    // Fallback to estimation
    const approxTokens = Math.ceil(text.length / 4);
    return res.json({
      totalTokens: approxTokens,
      isApproximate: true,
      warning: err.message
    });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Gemini API Node.js Server running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`💡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);
});
