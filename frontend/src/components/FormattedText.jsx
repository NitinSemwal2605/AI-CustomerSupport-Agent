import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function FormattedText({ text = '' }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopy = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!text) return null;

  // Split by code blocks: ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let blockCounter = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Push prior text
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Push code block
    parts.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2],
      index: blockCounter++
    });

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return (
    <div className="content-text">
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return (
            <div key={i} className="code-block-wrapper">
              <div className="code-header">
                <span>{part.language || 'code'}</span>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy(part.content, part.index)}
                  title="Copy code"
                >
                  {copiedIndex === part.index ? (
                    <>
                      <Check size={13} color="#16a34a" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="code-block">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }

        // Render plain text paragraphs
        return (
          <div key={i}>
            {part.content.split('\n\n').map((para, pIdx) => (
              <p key={pIdx}>
                {para.split('\n').map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {line}
                    {lIdx < para.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
