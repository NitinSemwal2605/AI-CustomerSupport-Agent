import React, { useState } from 'react';
import { X, Copy, Check, FileJson, Cpu, DollarSign, Layers } from 'lucide-react';

export default function InspectorModal({ isOpen, onClose, telemetryData }) {
  const [activeTab, setActiveTab] = useState('raw-request');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !telemetryData) return null;

  const { inspector, usage, latencyMs, finishReason, modelUsed } = telemetryData;
  const rawRequest = inspector?.rawRequest || {};
  const rawResponse = inspector?.rawResponse || {};
  const cost = usage?.cost || {};

  const handleCopyJson = (data) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileJson size={18} color="#2563eb" />
            <h3 className="modal-title">API Request & Response Inspector</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'raw-request' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw-request')}
          >
            Raw Request JSON
          </button>
          <button
            className={`tab-btn ${activeTab === 'raw-response' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw-response')}
          >
            Raw Response JSON
          </button>
          <button
            className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Roles Mapping
          </button>
          <button
            className={`tab-btn ${activeTab === 'tokens-cost' ? 'active' : ''}`}
            onClick={() => setActiveTab('tokens-cost')}
          >
            Tokens & Cost Math
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'raw-request' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Exact JSON payload formatted for Gemini API:
                </span>
                <button className="copy-btn" onClick={() => handleCopyJson(rawRequest)}>
                  {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />} Copy JSON
                </button>
              </div>
              <pre className="json-display">
                {JSON.stringify(rawRequest, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'raw-response' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Raw response object returned by Google Gemini SDK:
                </span>
                <button className="copy-btn" onClick={() => handleCopyJson(rawResponse)}>
                  {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />} Copy JSON
                </button>
              </div>
              <pre className="json-display">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'roles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#b45309' }}>
                  <span style={{ background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>SYSTEM ROLE</span>
                  <span>systemInstruction</span>
                </div>
                <p style={{ fontSize: '13px', marginTop: '6px', color: '#334155' }}>
                  Sets the guardrails, tone, background persona, and constraints before any turn begins.
                  In Gemini, it is passed separately in <code>modelOptions.systemInstruction</code>.
                </p>
                <div style={{ marginTop: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)', background: '#ffffff', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                  {JSON.stringify(rawRequest.systemInstruction, null, 2)}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#1e40af' }}>
                  <span style={{ background: '#dbeafe', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>USER ROLE</span>
                  <span>contents [role: "user"]</span>
                </div>
                <p style={{ fontSize: '13px', marginTop: '6px', color: '#334155' }}>
                  Represents prompts entered by the human. Each user message is passed as a content turn containing an array of <code>parts: [&#123; text &#125;]</code>.
                </p>
              </div>

              <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#15803d' }}>
                  <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>MODEL / ASSISTANT ROLE</span>
                  <span>contents [role: "model"]</span>
                </div>
                <p style={{ fontSize: '13px', marginTop: '6px', color: '#334155' }}>
                  While OpenAI calls this "assistant", Gemini API designates this role as <strong>"model"</strong>.
                  Previous AI responses in the conversation history are sent back with <code>role: "model"</code> to maintain context.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'tokens-cost' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Prompt Tokens</span>
                  <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                    {usage?.promptTokens || 0}
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>User + System</span>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Candidate Tokens</span>
                  <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                    {usage?.candidatesTokens || 0}
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Model Output</span>
                </div>

                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#065f46', textTransform: 'uppercase', fontWeight: '600' }}>Calculated Cost</span>
                  <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', color: '#047857', fontFamily: 'var(--font-mono)' }}>
                    {cost?.formatted?.totalCostString || '$0.0000000'}
                  </div>
                  <span style={{ fontSize: '11px', color: '#059669' }}>USD</span>
                </div>
              </div>

              <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Pricing Formula Applied:</h4>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: '1.7', color: '#334155' }}>
                  • Input Rate: {cost?.rates?.inputPerMillion || '$0.075'} per 1,000,000 tokens<br />
                  • Output Rate: {cost?.rates?.outputPerMillion || '$0.30'} per 1,000,000 tokens<br />
                  • Formula: <code>({usage?.promptTokens || 0} / 1M × Rate) + ({usage?.candidatesTokens || 0} / 1M × Rate)</code><br />
                  • Roundtrip Latency: <strong>{latencyMs || 0}ms</strong> | Finish Reason: <strong>{finishReason || 'STOP'}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
