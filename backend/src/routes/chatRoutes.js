/**
 * Chat & Gemini AI Routes
 */

const express = require('express');
const {
  handleChat,
  handleTestKey,
  handleCountTokens,
  handleGetModels,
  handleGetHealth
} = require('../controllers/chatController');

const router = express.Router();

router.get('/health', handleGetHealth);
router.get('/models', handleGetModels);
router.post('/test-key', handleTestKey);
router.post('/chat', handleChat);
router.post('/count-tokens', handleCountTokens);

module.exports = router;
