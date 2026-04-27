import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../ThemeContext.jsx';

const API = 'http://localhost:3001/api';

function parseContent(text) {
  const parts = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    parts.push({ type: 'code', language: match[1] || 'text', content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });
  return parts;
}

function MessageBubble({ msg, isStreaming }) {
  const T = useTheme();
  const isUser = msg.role === 'user';
  const parts = parseContent(msg.content);
  return (
    <div style={{ padding: '12px 16px', background: isUser ? 'transparent' : T.bg1, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', gap: 12, maxWidth: 800, margin: '0 auto' }}>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: isUser ? T.accent : T.info, fontFamily: 'ui-monospace, Menlo, monospace', minWidth: 52, textAlign: 'right', paddingTop: 2 }}>
          {isUser ? 'you >' : 'claude >'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {parts.map((p, i) => p.type === 'code' ? (
            <div key={i} style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              {p.language && p.language !== 'text' && (
                <div style={{ background: '#1a1a2e', padding: '3px 10px', fontSize: 9.5, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>{p.language}</div>
              )}
              <SyntaxHighlighter language={p.language || 'text'} style={oneDark} customStyle={{ margin: 0, borderRadius: 0, fontSize: 12 }} wrapLongLines>
                {p.content}
              </SyntaxHighlighter>
            </div>
          ) : (
            <p key={i} style={{ color: T.text, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 4px', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
              {p.content}
              {isStreaming && i === parts.length - 1 && (
                <span style={{ display: 'inline-block', width: 8, height: 14, background: T.accent, marginLeft: 2, verticalAlign: 'middle', animation: 'mc-pulse 1s infinite' }} />
              )}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClaudePage() {
  const T = useTheme();
  const hdrBtn = { background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: 'pointer', fontSize: 10, padding: '3px 8px', fontFamily: 'ui-monospace, Menlo, monospace' };
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const autoSubmitted = useRef(false);
  const messagesRef = useRef([]);
  const inputRef = useRef('');

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { inputRef.current = input; }, [input]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async (text) => {
    const prompt = (typeof text === 'string' ? text : inputRef.current).trim();
    if (!prompt || isStreaming) return;

    setHistory(prev => [prompt, ...prev.filter(h => h !== prompt)]);
    setHistoryIdx(-1);
    setInput('');

    const userMsg      = { role: 'user',      content: prompt };
    const assistantMsg = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API}/claude/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: [...messagesRef.current, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') break;
          try {
            const { text: t } = JSON.parse(payload);
            if (t) { accumulated += t; setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: accumulated } : m)); }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: '[error: ' + e.message + ']' } : m));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !autoSubmitted.current) {
      autoSubmitted.current = true;
      sendMessage(decodeURIComponent(q));
    }
  }, [sendMessage]);

  async function handleSave() {
    setSaveStatus('saving\u2026');
    try {
      await fetch(`${API}/claude/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) });
      setSaveStatus('saved'); setTimeout(() => setSaveStatus(''), 2000);
    } catch { setSaveStatus('error'); }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); return; }
    if (e.ctrlKey && e.key === 'c') { abortRef.current?.abort(); return; }
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault();
      const idx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(idx); if (history[idx]) setInput(history[idx]);
    }
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault();
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx); setInput(idx === -1 ? '' : (history[idx] ?? ''));
    }
  }

  const exchangeCount = Math.floor(messages.length / 2);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, fontSize: 10.5 }}>
        <span style={{ color: T.accent }}>$ claude-chat</span>
        <span style={{ color: T.textGhost }}>claude-sonnet-4-5</span>
        <span style={{ color: T.textFaint }}>{exchangeCount} exchanges</span>
        <div style={{ flex: 1 }} />
        {saveStatus && <span style={{ color: saveStatus === 'error' ? T.danger : T.textDim, fontSize: 10 }}>{saveStatus}</span>}
        <button onClick={handleSave} style={hdrBtn}>Save to Notion</button>
        <button onClick={() => { abortRef.current?.abort(); setMessages([]); setHistoryIdx(-1); }} style={hdrBtn}>Clear</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: T.bg0 }}>
        {messages.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: T.textGhost, fontSize: 12 }}>
            $ ask anything \u2014 \u2191\u2193 history \u00b7 Ctrl+C abort
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} isStreaming={isStreaming && i === messages.length - 1 && m.role === 'assistant'} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: T.bg1, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ color: T.accent, fontSize: 13, alignSelf: 'center' }}>{'>'}</span>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="ask something\u2026 (Enter to send, Shift+Enter newline)"
          style={{ flex: 1, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 12.5, padding: '6px 10px', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={isStreaming || !input.trim()}
          style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 4, color: T.accent, cursor: 'pointer', fontSize: 11, padding: '0 12px', alignSelf: 'stretch', opacity: (isStreaming || !input.trim()) ? 0.4 : 1 }}
        >
          {isStreaming ? '\u2026' : '\u23ce'}
        </button>
      </div>
    </div>
  );
}
