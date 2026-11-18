import React, { useState } from 'react';
import { X, Key, Sliders, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  serverStatus,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens
}) {
  const [testStatus, setTestStatus] = useState(null); // 'testing' | 'success' | 'error'
  const [testMessage, setTestMessage] = useState('');

  if (!isOpen) return null;

  const handleTestKey = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestMessage(data.message || 'API Key is valid and authenticated!');
      } else {
        setTestStatus('error');
        setTestMessage(data.message || 'Authentication failed. Check your API key.');
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage('Network error: Could not reach backend server on port 5000.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="#10a37f" />
            <h3 className="modal-title">API Authentication & Model Settings</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Backend Status Note */}
          <div style={{
            padding: '10px 14px',
            backgroundColor: serverStatus?.auth?.hasEnvKey ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${serverStatus?.auth?.hasEnvKey ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '12.5px',
            color: serverStatus?.auth?.hasEnvKey ? '#166534' : '#92400e'
          }}>
            <strong>Server Status:</strong> {serverStatus?.auth?.hasEnvKey 
              ? '✓ Connected to backend with GEMINI_API_KEY from .env file' 
              : '⚡ Backend online, but no GEMINI_API_KEY detected in backend/.env. Enter your key below or add it to .env'}
          </div>

          {/* API Key Input */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Gemini API Key</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '11.5px', color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                Get Free API Key <ExternalLink size={11} />
              </a>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="AIzaSy... (leave blank to use server .env)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="form-hint">
              Keys entered here are kept in your browser memory for testing. In production, always store keys on the Node.js backend using environment variables!
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={handleTestKey}
              disabled={testStatus === 'testing'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 size={14} className="spin" /> Verifying...
                </>
              ) : (
                'Test API Key'
              )}
            </button>

            {apiKey && (
              <button
                onClick={() => {
                  setApiKey('');
                  localStorage.removeItem('gemini_user_api_key');
                  setTestStatus(null);
                  setTestMessage('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Clear & Use Server .env Key
              </button>
            )}

            {testStatus === 'success' && (
              <span style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> {testMessage}
              </span>
            )}
            {testStatus === 'error' && (
              <span style={{ fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={14} /> {testMessage}
              </span>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />

          {/* Generation Config */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', fontWeight: '600', fontSize: '13px' }}>
            <Sliders size={16} />
            <span>Generation Parameters (generationConfig)</span>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label">Temperature: {temperature}</label>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>0 = Deterministic, 1 = Creative</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#10a37f' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label">Max Output Tokens: {maxTokens}</label>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Token limit per response</span>
            </div>
            <input
              type="range"
              min="128"
              max="4096"
              step="128"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#10a37f' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
