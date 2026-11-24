import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Sun,
  Moon,
  ExternalLink,
  Globe,
  ShoppingBag,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  CheckCircle2
} from 'lucide-react';
import FormattedText from './components/FormattedText';
import SettingsModal from './components/SettingsModal';
import AuthModal from './components/AuthModal';

export default function App() {
  // Theme state: 'light' | 'dark'
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'light');

  // Authentication State
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('gemini_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('gemini_auth_token') || '');

  // Saved Conversations State (Per User)
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Settings & Model Selection (Model selection is housed inside the search bar)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_user_api_key') || '');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Server health state
  const [serverStatus, setServerStatus] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const centerTextareaRef = useRef(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Verify JWT session on mount
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.success) {
            handleLogout();
          } else if (data.user) {
            setUser(data.user);
          }
        })
        .catch(() => {});
    }
  }, [token]);

  // Save custom API key to localStorage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('gemini_user_api_key', apiKey);
    } else {
      localStorage.removeItem('gemini_user_api_key');
    }
  }, [apiKey]);

  // Fetch server health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setServerStatus(data))
      .catch((err) => console.error('Health check failed:', err));
  }, []);

  // Global shortcut: Ctrl+K or Cmd+K to start a new shopping chat
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch conversations when user is logged in
  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchConversations();
    }
  }, [user, token]);

  const handleLoginSuccess = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('gemini_auth_user', JSON.stringify(userData));
    localStorage.setItem('gemini_auth_token', authToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    setConversations([]);
    setCurrentConversationId(null);
    setMessages([]);
    localStorage.removeItem('gemini_auth_user');
    localStorage.removeItem('gemini_auth_token');
  };

  // Select an existing conversation thread
  const selectConversation = async (convId) => {
    if (convId === currentConversationId) return;
    setCurrentConversationId(convId);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        setMessages(
          data.conversation.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            modelUsed: m.modelUsed,
            latencyMs: m.latencyMs,
            sources: m.sources || [],
            inspector: m.inspector || null,
            timestamp: m.timestamp
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a fresh shopping conversation
  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInputValue('');
  };

  // Rename a conversation
  const handleSaveRename = async (convId) => {
    if (!editingTitle.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: editingTitle.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: data.conversation.title } : c))
        );
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    } finally {
      setEditingConversationId(null);
      setEditingTitle('');
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this shopping chat?')) return;

    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (currentConversationId === convId) {
          startNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  };

  // Dispatch message to Gemini via Express backend (Streaming SSE)
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (centerTextareaRef.current) centerTextareaRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      const apiHistory = newMessages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(apiKey ? { 'x-gemini-api-key': apiKey.trim() } : {})
      };

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          model: selectedModel,
          messages: apiHistory,
          conversationId: currentConversationId
        })
      });

      if (!response.ok) {
        let errorMsg = `Server error (${response.status})`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errData.message || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      // Add streaming placeholder assistant message to state
      const assistantId = Date.now().toString();
      const placeholderMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        sources: [],
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, placeholderMessage]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let sources = [];
      let tokenUsage = null;
      let finalConversationId = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulatedText, isStreaming: true } : m))
              );
            }
            if (parsed.sources) {
              sources = parsed.sources;
            }
            if (parsed.usage) {
              tokenUsage = parsed.usage;
            }
            if (parsed.conversationId) {
              finalConversationId = parsed.conversationId;
            }
          } catch (jsonErr) {
            if (jsonErr.message && !jsonErr.message.includes('JSON')) {
              throw jsonErr;
            }
          }
        }
      }

      // Finalize the streaming message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: accumulatedText, sources, inspector: tokenUsage ? { usage: tokenUsage } : m.inspector, isStreaming: false }
            : m
        )
      );

      if (finalConversationId) {
        setCurrentConversationId(finalConversationId);
        fetchConversations();
      }
    } catch (err) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => !(m.role === 'assistant' && m.isStreaming && !m.content));
        return [
          ...filtered,
          {
            role: 'assistant',
            content: `⚠️ **Shopping Assistant Notice:**\n${err.message}\n\n*Check your API key in Settings or backend/.env.*`,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // If user is not authenticated, show JWT Auth Screen
  if (!user || !token) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  const username = user.name || user.email?.split('@')[0] || 'there';

  return (
    <div className="app-container">
      {/* SIDEBAR (Light/Dark Mode ChatGPT Style) */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="brand-row">
            <div className="brand-logo">
              <ShoppingBag size={18} color="#10a37f" />
              <span>Shopping Assistant</span>
            </div>
            <button
              className="toggle-sidebar-btn"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          <button className="new-chat-btn" onClick={startNewChat}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> New Shopping Chat
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Ctrl+K</span>
          </button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section-title">Your Shopping Chats</div>
          {conversations.length === 0 ? (
            <div className="empty-conversations-hint">
              <span>No saved chats yet. Ask a shopping question to begin!</span>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conv) => {
                const isActive = conv.id === currentConversationId;
                const isEditing = editingConversationId === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => !isEditing && selectConversation(conv.id)}
                  >
                    <MessageSquare size={14} className="conversation-icon" />

                    {isEditing ? (
                      <div className="conversation-edit-row" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="conversation-rename-input"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(conv.id);
                            if (e.key === 'Escape') setEditingConversationId(null);
                          }}
                          autoFocus
                        />
                        <button
                          className="conv-inline-btn"
                          onClick={() => handleSaveRename(conv.id)}
                          title="Save title"
                        >
                          <Check size={13} color="#16a34a" />
                        </button>
                        <button
                          className="conv-inline-btn"
                          onClick={() => setEditingConversationId(null)}
                          title="Cancel"
                        >
                          <X size={13} color="#dc2626" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="conversation-title" title={conv.title}>
                          {(conv.title || '').replace(/^['"]+|['"]+$/g, '')}
                        </span>

                        <div className="conversation-actions">
                          <button
                            className="conv-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingConversationId(conv.id);
                              setEditingTitle(conv.title);
                            }}
                            title="Rename"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="conv-action-btn delete"
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer with Theme Toggle & User Account */}
        <div className="sidebar-footer">
          <div className="theme-toggle-row">
            <span className="theme-toggle-label">Appearance</span>
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
              {theme === 'light' ? (
                <>
                  <Moon size={14} /> <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun size={14} /> <span>Light Mode</span>
                </>
              )}
            </button>
          </div>

          <div className="user-profile-bar">
            <div className="user-info-cluster">
              <div className="user-avatar-circle">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="user-details-col">
                <span className="user-name-text">
                  {username}
                </span>
                <span className="user-email-text" title={user.email}>
                  {user.email}
                </span>
              </div>
            </div>

            <button className="logout-icon-btn" onClick={handleLogout} title="Log Out">
              <LogOut size={16} />
            </button>
          </div>

          <button className="sidebar-action-btn" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={15} />
            <span>API Key & Settings</span>
          </button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="main-chat">
        {/* Top Navbar */}
        <header className="chat-navbar">
          <div className="nav-left">
            {!sidebarOpen && (
              <button
                className="toggle-sidebar-btn"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
          </div>
        </header>

        {/* MESSAGES FEED OR CENTERED SEARCH BAR HOME */}
        {messages.length === 0 ? (
          <div className="centered-home-wrapper">
            <div className="centered-home-inner">
              <h1 className="welcome-headline">AI Shopping Assistant</h1>
              <p className="welcome-subtext">
                Your smart companion for finding products, comparing specs, discovering deals, and buying with verified store links.
              </p>

              {/* Centered Search/Chat Bar with MODEL SELECTION ONLY INSIDE */}
              <div className="search-box-unified">
                <textarea
                  ref={centerTextareaRef}
                  className="chat-textarea"
                  rows="2"
                  placeholder="Ask for product recommendations, compare items, or find deals..."
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                
                <div className="search-box-bottom-row">
                  {/* Model Selector Pill INSIDE the Search Bar */}
                  <div className="search-model-pill" title="Select Gemini Model">
                    <Sparkles size={13} color="#10a37f" />
                    <select
                      className="model-inline-select"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                      <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                      <option value="gemini-flash-latest">Gemini Flash Latest</option>
                    </select>
                  </div>

                  <button
                    className="send-btn"
                    disabled={!inputValue.trim() || isLoading}
                    onClick={() => handleSendMessage()}
                    title="Send message (Enter)"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>

              {/* Quick Shopping Suggestions for Indian Customers */}
              <div className="prompt-suggestions">
                <button
                  className="suggestion-pill"
                  onClick={() => handleSendMessage('Recommend the best wireless earbuds under ₹3,000 (boAt, Noise, OnePlus) with Amazon & Flipkart links')}
                >
                  <ShoppingBag size={13} color="var(--accent-green)" />
                  <span>Best earbuds under ₹3,000 with links</span>
                </button>
                <button
                  className="suggestion-pill"
                  onClick={() => handleSendMessage('Compare OnePlus 12R vs Samsung Galaxy S23 FE specs, Indian price, and bank offers')}
                >
                  <Globe size={13} color="var(--accent-blue)" />
                  <span>Compare OnePlus 12R vs Samsung S23 FE</span>
                </button>
                <button
                  className="suggestion-pill"
                  onClick={() => handleSendMessage('What are the best laptops under ₹55,000 for coding and college in India?')}
                >
                  <ShoppingBag size={13} color="var(--accent-purple)" />
                  <span>Best coding laptops under ₹55,000</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="messages-scroll-area">
              <div className="messages-inner">
                {messages.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="message-avatar assistant">
                        <Sparkles size={16} />
                      </div>
                    )}

                    <div className="message-body">
                      <div className="message-bubble">
                        {msg.content ? (
                          <>
                            <FormattedText text={msg.content} />
                            {msg.isStreaming && <span className="streaming-cursor" />}
                          </>
                        ) : msg.isStreaming ? (
                          <div className="typing-indicator" style={{ padding: '4px 0' }}>
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                          </div>
                        ) : null}

                        {/* Grounding Store Links */}
                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                          <div className="grounding-sources-block">
                            <div className="grounding-sources-header">
                              <ShoppingBag size={13} color="var(--accent-green)" />
                              <span>Verified Stores & Brands ({msg.sources.length})</span>
                            </div>
                            <div className="grounding-sources-list">
                              {msg.sources.slice(0, 10).map((src, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`grounding-source-chip ${src.score >= 80 ? 'top-tier' : ''}`}
                                  title={src.originalTitle || src.title || src.url}
                                >
                                  {src.score >= 80 && (
                                    <CheckCircle2 size={11} color="var(--accent-green)" className="verified-badge-icon" />
                                  )}
                                  <span className="source-chip-text">{src.title}</span>
                                  {src.tier && <span className="source-badge-tag">{src.tier}</span>}
                                  <ExternalLink size={10} className="source-chip-icon" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {msg.role === 'user' && (
                      <div className="message-avatar user">
                        {username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && !messages.some((m) => m.isStreaming) && (
                  <div className="message-row assistant">
                    <div className="message-avatar assistant">
                      <Sparkles size={16} />
                    </div>
                    <div className="message-body">
                      <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Docked Input Area */}
            <div className="input-dock">
              <div className="input-container">
                <div className="search-box-unified">
                  <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    rows="1"
                    placeholder="Ask for product recommendations, compare items, or find deals..."
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                  />

                  <div className="search-box-bottom-row">
                    {/* Model Selector Pill INSIDE the Search Bar */}
                    <div className="search-model-pill" title="Select Gemini Model">
                      <Sparkles size={13} color="#10a37f" />
                      <select
                        className="model-inline-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                        <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                        <option value="gemini-flash-latest">Gemini Flash Latest</option>
                      </select>
                    </div>

                    <button
                      className="send-btn"
                      disabled={!inputValue.trim() || isLoading}
                      onClick={() => handleSendMessage()}
                      title="Send message (Enter)"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>

                <div className="input-footer">
                  AI Shopping Assistant powered by Google Gemini with live streaming and verified store links.
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        serverStatus={serverStatus}
      />
    </div>
  );
}
