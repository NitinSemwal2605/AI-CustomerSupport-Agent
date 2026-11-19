import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

/**
 * Parses inline markdown: links [title](url), bold **text**, and inline `code`.
 */
function renderInlineText(str) {
  if (!str) return null;

  // Regex to match: [text](url) | **bold** | `code`
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  const elements = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = tokenRegex.exec(str)) !== null) {
    // Plain text before token
    if (match.index > lastIndex) {
      elements.push(str.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      // Clickable link with external link icon
      elements.push(
        <a
          key={`link-${keyIndex++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="markdown-link"
          title={`Open ${match[2]}`}
        >
          {match[2]}
          <ExternalLink size={12} className="inline-link-icon" />
        </a>
      );
    } else if (match[4]) {
      // Bold text
      elements.push(<strong key={`bold-${keyIndex++}`}>{match[4]}</strong>);
    } else if (match[5]) {
      // Inline code
      elements.push(
        <code key={`code-${keyIndex++}`} className="inline-code">
          {match[5]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < str.length) {
    elements.push(str.slice(lastIndex));
  }

  return elements.length > 0 ? elements : str;
}

export default function FormattedText({ text = '' }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopy = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!text) return null;

  // Split text by markdown code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let blockCounter = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    parts.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2],
      index: blockCounter++
    });

    lastIndex = match.index + match[0].length;
  }

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

        // Render paragraphs and formatted lines
        return (
          <div key={i}>
            {part.content.split('\n\n').map((para, pIdx) => {
              const lines = para.split('\n');

              // Check if paragraph is a bullet list
              const isBulletList = lines.every((line) => line.trim().startsWith('* ') || line.trim().startsWith('- '));
              if (isBulletList) {
                return (
                  <ul key={pIdx} className="markdown-ul">
                    {lines.map((line, lIdx) => (
                      <li key={lIdx} className="markdown-li">
                        {renderInlineText(line.trim().replace(/^[\*\-]\s+/, ''))}
                      </li>
                    ))}
                  </ul>
                );
              }

              return (
                <div key={pIdx} className="markdown-para">
                  {lines.map((line, lIdx) => {
                    const trimmed = line.trim();

                    if (trimmed.startsWith('### ')) {
                      return (
                        <h4 key={lIdx} className="markdown-h3">
                          {renderInlineText(trimmed.slice(4))}
                        </h4>
                      );
                    }
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h3 key={lIdx} className="markdown-h2">
                          {renderInlineText(trimmed.slice(3))}
                        </h3>
                      );
                    }
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h2 key={lIdx} className="markdown-h1">
                          {renderInlineText(trimmed.slice(2))}
                        </h2>
                      );
                    }
                    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                      return (
                        <div key={lIdx} className="markdown-li single">
                          <span className="bullet-dot">•</span>
                          <span>{renderInlineText(trimmed.replace(/^[\*\-]\s+/, ''))}</span>
                        </div>
                      );
                    }

                    return (
                      <React.Fragment key={lIdx}>
                        {renderInlineText(line)}
                        {lIdx < lines.length - 1 && <br />}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
