/**
 * Conversation & Message Persistence Service
 * Manages saving user chats, message history, renaming, and deletion in PostgreSQL via Prisma.
 */

const prisma = require('../config/db');

/**
 * List all conversations for a user, sorted by most recently updated
 */
async function listUserConversations(userId) {
  if (!userId) return [];

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { messages: true }
      }
    }
  });

  return conversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    messageCount: conv._count.messages,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt
  }));
}

/**
 * Get a specific conversation along with all its messages in chronological order
 */
async function getConversationWithMessages(userId, conversationId) {
  if (!conversationId) return null;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      ...(userId ? { userId } : {})
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!conversation) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      modelUsed: m.modelUsed,
      latencyMs: m.latencyMs,
      sources: m.sources || [],
      inspector: m.metadata || null,
      timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }))
  };
}

/**
 * Create a new conversation
 */
async function createConversation(userId, title = 'New Chat') {
  if (!userId) {
    const error = new Error('User ID is required to create a conversation');
    error.statusCode = 400;
    throw error;
  }

  // Ensure user exists in database to prevent foreign key violations on stale sessions
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  if (!user) {
    const error = new Error('User account not found. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  return await prisma.conversation.create({
    data: {
      userId,
      title: title.trim().slice(0, 100) || 'New Chat'
    }
  });
}

/**
 * Rename a conversation title
 */
async function renameConversation(userId, conversationId, newTitle) {
  if (!conversationId || !newTitle || !newTitle.trim()) {
    const error = new Error('Valid conversation ID and new title are required');
    error.statusCode = 400;
    throw error;
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      ...(userId ? { userId } : {})
    }
  });

  if (!existing) {
    const error = new Error('Conversation not found or access denied');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      title: newTitle.trim().slice(0, 100)
    }
  });
}

/**
 * Delete a conversation (and all its cascaded messages)
 */
async function deleteConversation(userId, conversationId) {
  if (!conversationId) {
    const error = new Error('Conversation ID is required');
    error.statusCode = 400;
    throw error;
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      ...(userId ? { userId } : {})
    }
  });

  if (!existing) {
    const error = new Error('Conversation not found or access denied');
    error.statusCode = 404;
    throw error;
  }

  await prisma.conversation.delete({
    where: { id: conversationId }
  });

  return { success: true };
}

/**
 * Save user and assistant messages into a conversation
 */
async function saveChatTurn({
  userId,
  conversationId,
  userPrompt,
  assistantResponse
}) {
  let targetConversationId = conversationId;

  // If no conversation exists yet, create one using the first prompt as the title
  if (!targetConversationId && userId) {
    try {
      const generatedTitle = userPrompt.trim().slice(0, 40) + (userPrompt.length > 40 ? '...' : '');
      const newConv = await createConversation(userId, generatedTitle);
      targetConversationId = newConv.id;
    } catch (err) {
      console.warn(`Could not initialize conversation for user ${userId}:`, err.message);
      return null;
    }
  }

  if (targetConversationId) {
    // 1. Save User Prompt
    await prisma.message.create({
      data: {
        conversationId: targetConversationId,
        role: 'user',
        content: userPrompt
      }
    });

    // 2. Save Assistant Response
    await prisma.message.create({
      data: {
        conversationId: targetConversationId,
        role: 'assistant',
        content: assistantResponse.text || '',
        modelUsed: assistantResponse.modelUsed || null,
        latencyMs: assistantResponse.latencyMs || null,
        sources: assistantResponse.sources || null,
        metadata: assistantResponse.inspector || null
      }
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: targetConversationId },
      data: { updatedAt: new Date() }
    });
  }

  return targetConversationId;
}

module.exports = {
  listUserConversations,
  getConversationWithMessages,
  createConversation,
  renameConversation,
  deleteConversation,
  saveChatTurn
};
