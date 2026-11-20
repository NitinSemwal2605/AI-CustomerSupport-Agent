/**
 * Conversation Routes (/api/conversations)
 */

const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  handleListConversations,
  handleGetConversation,
  handleCreateConversation,
  handleRenameConversation,
  handleDeleteConversation
} = require('../controllers/conversationController');

const router = express.Router();

// All conversation routes require user authentication
router.use(authMiddleware);

router.get('/', handleListConversations);
router.post('/', handleCreateConversation);
router.get('/:id', handleGetConversation);
router.patch('/:id', handleRenameConversation);
router.put('/:id', handleRenameConversation); // also support PUT for flexibility
router.delete('/:id', handleDeleteConversation);

module.exports = router;
