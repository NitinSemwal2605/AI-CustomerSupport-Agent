/**
 * Chat & Gemini AI Controller - AI Shopping Assistant
 * Simple, beginner-friendly handlers for chat completion and API testing.
 */

const jwt = require('jsonwebtoken');
const { sendGeminiChat } = require('../services/geminiService');
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
async function maybeSaveTurn(userId, conversationId, messages, response) {
  if (!userId) return conversationId || null;
  try {
    const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
    const promptText = lastUserMsg?.content || lastUserMsg?.text || 'Shopping Query';
    return await saveChatTurn({
      userId,
      conversationId,
      userPrompt: promptText,
      assistantResponse: response
    });
  } catch (err) {
    console.warn('Could not save conversation to database:', err.message);
    return conversationId || null;
  }
}

/**
 * Standard Chat endpoint
 */
async function handleChat(req, res, next) {
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

    const chatResponse = await sendGeminiChat({
      apiKey: activeKey,
      model,
      systemInstruction,
      messages
    });

    if (!chatResponse.success) {
      return res.status(500).json(chatResponse);
    }

    const finalConversationId = await maybeSaveTurn(getUserId(req), conversationId, messages, chatResponse);

    return res.json({
      ...chatResponse,
      conversationId: finalConversationId
    });
  } catch (err) {
    next(err);
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

    const result = await sendGeminiChat({
      apiKey: targetKey,
      model: 'gemini-2.5-flash',
      systemInstruction: 'Respond only with: OK',
      messages: [{ role: 'user', content: 'Ping' }]
    });

    if (result.success) {
      return res.json({ success: true, message: 'API key is valid!' });
    }
    return res.status(401).json({ success: false, message: result.error || 'Verification failed.' });
  } catch (err) {
    next(err);
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
  handleChat,
  handleTestKey,
  handleGetModels,
  handleGetHealth
};
