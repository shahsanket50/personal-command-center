import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext.jsx';

const API = 'http://localhost:3001/api';

function BoldText({ text }) {
  const T = useTheme();
  // Split on **...** and render bold parts without innerHTML
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ color: T.textHi }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function BriefLine({ line }) {
  const T = useTheme();
  if (!line.trim()) return <div style={{ height: 6 }} />;

  if (line.startsWith('# ')) {
    return <div style={{ color: T.accent, fontWeight: 700, fontSize: 14 }}>{line.slice(2)}</div>;
  }
  if (line.startsWith('## ')) {
    return <div style={{ color: T.accent, marginTop: 10, fontSize: 13 }}>{line.slice(3)}</div>;
  }
  if (line.startsWith('- ') || line.startsWith('→ ')) {
    return (
      <div style={{ color: T.textDim, display: 'flex', gap: 6, fontSize: 13 }}>
        <span style={{ color: T.textGhost }}>→</span>
        <BoldText text={line.slice(2)} />
      </div>
    );
  }
  return <div style={{ color: T.textDim, fontSize: 13 }}><BoldText text={line} /></div>;
}

export function Brief() {
  const T = useTheme();
  const [content, setContent] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`${API}/brief/today`)
      .then(r => r.json())
      .then(data => setContent(data ?? null))
      .catch(() => setContent(null));
  }, []);

  async function generate() {
    setGenerating(true);
    setContent('');
    try {
      const res = await fetch(`${API}/brief/generate`, { method: 'POST' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') break;
          try { const { text } = JSON.parse(payload); if (text) { acc += text; setContent(acc); } } catch (_) {}
        }
      }
    } catch (_) {}
    setGenerating(false);
  }

  if (content === null) {
    return (
      <div style={{ padding: '18px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13.5 }}>
        <div style={{ color: T.textGhost }}>no brief for today.</div>
        <button onClick={generate} style={{
          marginTop: 10, padding: '4px 10px', background: T.accent, color: T.bg0,
          border: 'none', borderRadius: 4, cursor: 'pointer',
          fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
        }}>generate</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', fontSize: 13.5, lineHeight: 1.7, padding: '8px 12px' }}>
      {content.split('\n').map((line, i) => <BriefLine key={i} line={line} />)}
      {generating && <span style={{ color: T.accent, animation: 'mc-blink 1s infinite' }}>|</span>}
    </div>
  );
}
