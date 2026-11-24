/**
 * Chat & Gemini AI Controller - AI Shopping Assistant
 * Simple, beginner-friendly handlers for chat completion and API testing.
 */

const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { streamGeminiChat } = require('../services/geminiService');
const { saveChatTurn } = require('../services/conversationService');
const env = require('../config/env');

// Helper to extract user ID from JWT Bearer token
function getUserId(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    return token ? jwt.verify(token, env.JWT_SECRET)?.id || null : null;
  } catch {
    return null;
  }
}

// Helper to save conversation turn if user is authenticated
async function maybeSaveTurn(userId, conversationId, messages, response, modelUsed, latencyMs) {
  if (!userId) return conversationId || null;
  try {
    const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
    const promptText = lastUserMsg?.content || lastUserMsg?.text || 'Shopping Query';
    return await saveChatTurn({
      userId,
      conversationId,
      userPrompt: promptText,
      assistantResponse: {
        text: response.text,
        sources: response.sources,
        modelUsed,
        latencyMs,
        usage: response.usage,
        inspector: {
          usage: response.usage,
          modelUsed,
          latencyMs
        }
      }
    });
  } catch (err) {
    console.warn('Could not save conversation to database:', err.message);
    return conversationId || null;
  }
}

/**
 * Streaming Chat endpoint (Server-Sent Events)
 */
async function handleChatStream(req, res, next) {
  try {
    const { apiKey, model = 'gemini-2.5-flash', systemInstruction, messages = [], conversationId } = req.body;
    const activeKey = apiKey || req.headers['x-gemini-api-key'] || env.GEMINI_API_KEY;

    if (!activeKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key missing. Enter your Gemini API key in Settings or set GEMINI_API_KEY in backend/.env'
      });
    }

    if (!messages.length) {
      return res.status(400).json({ success: false, error: 'Messages array cannot be empty.' });
    }

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const startTime = Date.now();

    // Stream from Gemini API
    const result = await streamGeminiChat({
      apiKey: activeKey,
      model,
      systemInstruction,
      messages,
      onChunk: (text) => {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    });

    const latencyMs = Date.now() - startTime;

    // Save full conversation turn to PostgreSQL with usage & latency
    const finalConversationId = await maybeSaveTurn(
      getUserId(req),
      conversationId,
      messages,
      { text: result.fullText, sources: result.sources, usage: result.usage },
      model,
      latencyMs
    );

    // Send final completion event with sources, token usage, latency, and conversationId
    res.write(`data: ${JSON.stringify({
      done: true,
      sources: result.sources,
      usage: result.usage,
      latencyMs,
      conversationId: finalConversationId
    })}\n\n`);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Streaming error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}

/**
 * Quick API Key ping test
 */
async function handleTestKey(req, res, next) {
  try {
    const targetKey = req.body.apiKey || req.headers['x-gemini-api-key'] || env.GEMINI_API_KEY;
    if (!targetKey) {
      return res.status(400).json({ success: false, message: 'No API key provided.' });
    }

    const genAI = new GoogleGenerativeAI(targetKey.trim());
    const testModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    await testModel.generateContent('ping');

    return res.json({ success: true, message: 'API key is valid!' });
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || 'Verification failed.' });
  }
}

/**
 * Models listing
 */
function handleGetModels(req, res) {
  res.json({
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Recommended', description: 'Fast shopping research with search grounding.' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tag: 'Ultra-Fast', description: 'Lightweight and instant.' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', tag: 'Stable', description: 'Standard production Gemini Flash model.' }
    ]
  });
}

function handleGetHealth(req, res) {
  res.json({
    status: 'online',
    assistant: 'AI Shopping Assistant',
    hasEnvKey: Boolean(env.GEMINI_API_KEY?.trim())
  });
}

module.exports = {
  handleChatStream,
  handleTestKey,
  handleGetModels,
  handleGetHealth
};
