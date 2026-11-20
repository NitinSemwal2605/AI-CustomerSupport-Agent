/**
 * Conversation Controller
 * Handles HTTP requests for listing, retrieving, renaming, and deleting conversations.
 */

const {
  listUserConversations,
  getConversationWithMessages,
  createConversation,
  renameConversation,
  deleteConversation
} = require('../services/conversationService');

async function handleListConversations(req, res, next) {
  try {
    const userId = req.user?.id;
    const conversations = await listUserConversations(userId);
    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
}

async function handleGetConversation(req, res, next) {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;
    const conversation = await getConversationWithMessages(userId, conversationId);
    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
}

async function handleCreateConversation(req, res, next) {
  try {
    const userId = req.user?.id;
    const { title } = req.body;
    const conversation = await createConversation(userId, title);
    res.status(201).json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
}

async function handleRenameConversation(req, res, next) {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title cannot be empty' });
    }

    const updated = await renameConversation(userId, conversationId, title);
    res.json({ success: true, conversation: updated });
  } catch (err) {
    next(err);
  }
}

async function handleDeleteConversation(req, res, next) {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;
    await deleteConversation(userId, conversationId);
    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleListConversations,
  handleGetConversation,
  handleCreateConversation,
  handleRenameConversation,
  handleDeleteConversation
};
