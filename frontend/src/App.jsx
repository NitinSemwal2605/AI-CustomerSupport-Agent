import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Coins,
  FileJson,
  LogOut,
  Sun,
  Moon
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

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Settings & Model Selection (Model selection is housed inside the search bar)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_user_api_key') || '');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectorData, setInspectorData] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Server health state
  const [serverStatus, setServerStatus] = useState(null);

  // Session stats
  const [sessionStats, setSessionStats] = useState({
    promptTokens: 0,
    candidateTokens: 0,
    totalTokens: 0,
    totalCostUSD: 0
  });

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
  };

  const startNewChat = () => {
    setMessages([]);
    setInputValue('');
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
          systemInstruction: '', // No system persona, fully driven by user prompt
          messages: apiHistory,
          config: {
            temperature,
            maxOutputTokens: maxTokens
          }
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
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (data.usage) {
          setSessionStats((prev) => ({
            promptTokens: prev.promptTokens + (data.usage.promptTokens || 0),
            candidateTokens: prev.candidateTokens + (data.usage.candidatesTokens || 0),
            totalTokens: prev.totalTokens + (data.usage.totalTokens || 0),
            totalCostUSD: prev.totalCostUSD + (data.usage.cost?.totalCostUSD || 0)
          }));
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
              <span>ClosedGPT</span>
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
          {/* Model selection is intentionally removed from sidebar per user request and placed inside search bar */}
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
              <h1 className="welcome-headline">Welcome back, {username}</h1>
              <p className="welcome-subtext">What would you like to explore or create today?</p>

              {/* Centered Search/Chat Bar with MODEL SELECTION ONLY INSIDE */}
              <div className="search-box-unified">
                <textarea
                  ref={centerTextareaRef}
                  className="chat-textarea"
                  rows="2"
                  placeholder="Ask anything, write code, or draft content..."
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
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
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
                      </div>

                      {/* Telemetry metadata for Model responses */}
                      {msg.role === 'assistant' && !msg.isError && msg.usage && (
                        <div className="message-telemetry">
                          <div
                            className="telemetry-pill"
                            onClick={() => openInspector(msg)}
                            title="Click to view raw JSON request & response"
                          >
                            <FileJson size={12} color="#2563eb" />
                            <span>
                              Tokens: <strong>{msg.usage.totalTokens}</strong> ({msg.usage.promptTokens} in / {msg.usage.candidatesTokens} out)
                            </span>
                          </div>

                          <div
                            className="telemetry-pill"
                            onClick={() => openInspector(msg)}
                            title="Calculated cost for this turn"
                          >
                            <Coins size={12} color="#16a34a" />
                            <span>
                              Cost: <strong>{msg.usage.cost?.formatted?.totalCostString}</strong>
                            </span>
                          </div>

                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '1px 6px', borderRadius: '4px', fontWeight: '500' }}>
                              {msg.modelUsed || selectedModel}
                            </span>
                            <span>• {msg.latencyMs}ms • {msg.finishReason}</span>
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
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
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
                  Gemini may display inaccurate info. Token & cost data calculated from standard rates.
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
        temperature={temperature}
        setTemperature={setTemperature}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
      />
    </div>
  );
}
