/**
 * Chat & Gemini AI Routes - AI Shopping Assistant
 */

const express = require('express');
const {
  handleChat,
  handleTestKey,
  handleGetModels,
  handleGetHealth
} = require('../controllers/chatController');

const router = express.Router();

router.get('/health', handleGetHealth);
router.get('/models', handleGetModels);
router.post('/test-key', handleTestKey);
router.post('/chat', handleChat);

module.exports = router;
