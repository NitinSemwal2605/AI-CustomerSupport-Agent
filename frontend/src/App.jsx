import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  FileJson,
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
import InspectorModal from './components/InspectorModal';
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
  const [inspectorData, setInspectorData] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('gemini_auth_token');
    localStorage.removeItem('gemini_auth_user');
    setUser(null);
    setToken('');
    setMessages([]);
    setConversations([]);
    setCurrentConversationId(null);
  };

  // Load user conversations from PostgreSQL
  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.warn('Could not load conversations:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchConversations();
    } else {
      setConversations([]);
      setCurrentConversationId(null);
    }
  }, [token]);

  // Load a conversation's messages
  const selectConversation = async (convId) => {
    if (convId === currentConversationId || isLoading) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        setCurrentConversationId(data.conversation.id);
        setMessages(data.conversation.messages || []);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInputValue('');
  };

  // Start inline rename
  const handleStartRename = (conv, e) => {
    e.stopPropagation();
    setEditingConversationId(conv.id);
    setEditingTitle(conv.title);
  };

  // Save renamed title
  const handleSaveRename = async (convId) => {
    if (!editingTitle.trim()) {
      setEditingConversationId(null);
      return;
    }
    const cleanTitle = editingTitle.trim();
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: cleanTitle })
      });
      const data = await res.json();
      if (data.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: cleanTitle } : c))
        );
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    } finally {
      setEditingConversationId(null);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
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

  // Dispatch message to Gemini via Express backend
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

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          model: selectedModel,
          messages: apiHistory,
          conversationId: currentConversationId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText = data.error || data.message || 'Failed to generate response.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ **Error from API:**\n${errorText}\n\n*Tip: Check your API key in Settings or backend/.env.*`,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        const assistantMessage = {
          role: 'assistant',
          content: data.text,
          modelUsed: data.modelUsed,
          latencyMs: data.latencyMs,
          finishReason: data.finishReason,
          usage: data.usage,
          inspector: data.inspector,
          sources: data.sources || [],
          webSearchQueries: data.webSearchQueries || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // If conversationId was returned, update current ID and refresh list
        if (data.conversationId) {
          setCurrentConversationId(data.conversationId);
          fetchConversations();
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Network Error:** Could not connect to the backend server.\nMake sure the Express backend is running on \`http://localhost:5000\`.\nError: ${err.message}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
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

  const openInspector = (telemetryData) => {
    setInspectorData(telemetryData);
    setIsInspectorOpen(true);
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
              <Sparkles size={18} color="#10a37f" />
              <span>AI Support Agent</span>
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
              <Plus size={16} /> New Chat
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Ctrl+K</span>
          </button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section-title">Your Conversations</div>
          {conversations.length === 0 ? (
            <div className="empty-conversations-hint">
              <span>No saved chats yet. Start a conversation to save!</span>
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
                          className="conv-inline-btn check"
                          onClick={() => handleSaveRename(conv.id)}
                          title="Save title"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          className="conv-inline-btn cancel"
                          onClick={() => setEditingConversationId(null)}
                          title="Cancel"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="conversation-title" title={conv.title}>
                          {conv.title}
                        </span>

                        <div className="conversation-actions">
                          <button
                            className="conv-action-btn"
                            onClick={(e) => handleStartRename(conv, e)}
                            title="Rename chat"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="conv-action-btn delete"
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            title="Delete chat"
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

        <div className="sidebar-footer">
          {/* Theme Toggle Button */}
          <button className="sidebar-action-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* User Account / Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div className="user-avatar-circle">
                {username.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {username}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
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
        {/* Top Navbar: Clean & minimal, no duplicate buttons */}
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
              <h1 className="welcome-headline">AI Customer Support Agent</h1>
              <p className="welcome-subtext">
                Ask about any product, compare prices across stores, or get technical and shopping assistance with live verified links.
              </p>

              {/* Centered Search/Chat Bar with MODEL SELECTION ONLY INSIDE */}
              <div className="search-box-unified">
                <textarea
                  ref={centerTextareaRef}
                  className="chat-textarea"
                  rows="2"
                  placeholder="Ask about any product, specs, or where to buy with links..."
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

              {/* Quick Customer Support & Product Research Suggestions */}
              <div className="prompt-suggestions">
                <button
                  className="suggestion-pill"
                  onClick={() => handleSendMessage('Where can I buy Sony WH-1000XM5 headphones and what are the best store links?')}
                >
                  <ShoppingBag size={13} color="var(--accent-green)" />
                  <span>Where can I buy Sony WH-1000XM5 with links?</span>
                </button>
                <button
                  className="suggestion-pill"
                  onClick={() => handleSendMessage('Compare MacBook Air M3 vs Dell XPS 13 specs, prices, and retailer links')}
                >
                  <Globe size={13} color="var(--accent-blue)" />
                  <span>Compare MacBook Air M3 vs Dell XPS 13</span>
                </button>
                <button
                  className="suggestion-pill"
                  onClick={() => handleSendMessage('What are the top 3 noise cancelling earbuds under $150 with purchase links?')}
                >
                  <ShoppingBag size={13} color="var(--accent-purple)" />
                  <span>Top noise cancelling earbuds under $150</span>
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
                    key={index}
                    className={`message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="message-avatar assistant">
                        <Sparkles size={16} />
                      </div>
                    )}

                    <div className="message-body">
                      <div className="message-bubble">
                        <FormattedText text={msg.content} />

                        {/* Verified Grounding Sources & Store Links (Prioritizing Top Retailers: Amazon, Flipkart, Myntra, etc.) */}
                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                          <div className="grounding-sources-block">
                            <div className="grounding-sources-header">
                              <ShoppingBag size={13} color="var(--accent-green)" />
                              <span>Verified Retailer Links ({msg.sources.length})</span>
                            </div>
                            <div className="grounding-sources-list">
                              {msg.sources.slice(0, 10).map((source, sIdx) => {
                                const isTopTier = source.isTopTier;
                                const displayTitle = source.title || source.originalTitle || 'Store';
                                const badgeText = source.badge;

                                return (
                                  <a
                                    key={sIdx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`grounding-source-chip ${isTopTier ? 'top-tier' : ''}`}
                                    title={source.originalTitle || source.title || source.url}
                                  >
                                    {isTopTier && (
                                      <CheckCircle2 size={11} color="var(--accent-green)" className="verified-badge-icon" />
                                    )}
                                    <span className="source-chip-text">{displayTitle}</span>
                                    {badgeText && (
                                      <span className="source-badge-tag">{badgeText}</span>
                                    )}
                                    <ExternalLink size={10} className="source-chip-icon" />
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Telemetry metadata for Model responses */}
                      {msg.role === 'assistant' && !msg.isError && (
                        <div className="message-telemetry">
                          <div
                            className="telemetry-pill"
                            onClick={() => openInspector(msg)}
                            title="Click to view raw JSON request & response"
                          >
                            <FileJson size={12} color="#2563eb" />
                            <span>Inspect Payload</span>
                          </div>

                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '1px 6px', borderRadius: '4px', fontWeight: '500' }}>
                              {msg.modelUsed || selectedModel}
                            </span>
                            {msg.latencyMs ? <span>• {msg.latencyMs}ms</span> : null}
                          </span>
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="message-avatar user">
                        {username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
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

            {/* Bottom Docked Input Area during active conversation with MODEL SELECTION INSIDE */}
            <div className="input-dock">
              <div className="input-container">
                <div className="search-box-unified">
                  <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    rows="1"
                    placeholder="Ask Gemini anything..."
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
                  Gemini may display inaccurate info.
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Inspector Modal */}
      <InspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        telemetryData={inspectorData}
      />

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
