import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Save, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Content parser ───────────────────────────────────────────────────────────

function parseContent(text) {
  const parts = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1] || 'text', content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return parts;
}

// ─── Message renderer ─────────────────────────────────────────────────────────

function MessageContent({ content, isStreaming }) {
  const parts = parseContent(content);

  return (
    <div className="space-y-2">
      {parts.map((part, i) =>
        part.type === 'code' ? (
          <div key={i} className="rounded-md overflow-hidden text-sm">
            {part.language && part.language !== 'text' && (
              <div className="bg-gray-800 px-3 py-1 text-xs text-gray-400 border-b border-gray-700 font-mono">
                {part.language}
              </div>
            )}
            <SyntaxHighlighter
              language={part.language || 'text'}
              style={oneDark}
              customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8125rem' }}
              wrapLongLines
            >
              {part.content}
            </SyntaxHighlighter>
          </div>
        ) : (
          <p key={i} className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {part.content}
            {isStreaming && i === parts.length - 1 && (
              <span className="inline-block w-2 h-4 bg-green-400 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        )
      )}
    </div>
  );
}

function Message({ msg, isStreaming }) {
  const isUser = msg.role === 'user';

  return (
    <div
      className={clsx(
        'px-6 py-4 border-b border-gray-800',
        !isUser && 'bg-gray-900/50'
      )}
    >
      <div className="max-w-4xl mx-auto flex items-start gap-3">
        <span
          className={clsx(
            'shrink-0 text-xs font-bold font-mono mt-0.5 w-14 text-right',
            isUser ? 'text-green-400' : 'text-blue-400'
          )}
        >
          {isUser ? 'you' : 'claude'}
        </span>
        <div className="flex-1 min-w-0">
          <MessageContent content={msg.content} isStreaming={isStreaming} />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClaudeCLI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'ok' | 'error'

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput('');
    setCmdHistory((h) => [text, ...h]);
    setHistoryIdx(-1);
    setIsStreaming(true);

    // Append empty assistant placeholder for streaming into
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;

          const parsed = JSON.parse(payload);
          if (parsed.error) throw new Error(parsed.error);

          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + parsed.text,
            };
            return updated;
          });
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Error: ${err.message}`,
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, isStreaming, messages]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(next);
      setInput(cmdHistory[next] ?? '');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setInput(next < 0 ? '' : (cmdHistory[next] ?? ''));
      return;
    }

    if (e.key === 'c' && e.ctrlKey && isStreaming) {
      abortRef.current?.abort();
    }
  }

  function clearSession() {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    setSaveStatus(null);
    inputRef.current?.focus();
  }

  async function saveToNotion() {
    if (messages.length === 0) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/claude/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      setSaveStatus(data.ok ? 'ok' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-sm font-semibold">claude-sonnet-4-5</span>
          {messages.length > 0 && (
            <span className="text-gray-600 text-xs">
              · {Math.ceil(messages.length / 2)} exchange{messages.length > 2 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveToNotion}
            disabled={messages.length === 0 || saveStatus === 'saving'}
            title="Save session to Notion"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saveStatus === 'saving' && <Loader2 size={12} className="animate-spin" />}
            {saveStatus === 'ok' && <CheckCircle size={12} className="text-green-400" />}
            {saveStatus === 'error' && <XCircle size={12} className="text-red-400" />}
            {!saveStatus && <Save size={12} />}
            <span>
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'ok'
                ? 'Saved'
                : saveStatus === 'error'
                ? 'Failed'
                : 'Save to Notion'}
            </span>
          </button>

          <button
            onClick={clearSession}
            disabled={messages.length === 0}
            title="Clear session"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 select-none">
            <div className="text-green-400 text-5xl mb-4">◆</div>
            <p className="text-gray-400 text-sm mb-1">Claude CLI</p>
            <p className="text-gray-600 text-xs">
              Enter to send · Shift+Enter for newline · ↑↓ for history · Ctrl+C to cancel
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <Message
                key={i}
                msg={msg}
                isStreaming={
                  isStreaming && i === messages.length - 1 && msg.role === 'assistant'
                }
              />
            ))}
            <div ref={bottomRef} className="h-4" />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-800 px-6 py-4 bg-gray-950">
        <div className="max-w-4xl mx-auto flex items-start gap-3">
          <span className="text-green-400 text-sm mt-1.5 select-none shrink-0">▸</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 192) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude anything…"
            rows={1}
            disabled={isStreaming}
            className={clsx(
              'flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-600',
              'resize-none focus:outline-none leading-relaxed overflow-y-auto',
              isStreaming && 'opacity-50 cursor-not-allowed'
            )}
            style={{ minHeight: '1.75rem', maxHeight: '12rem' }}
          />
        </div>
        <p className="max-w-4xl mx-auto mt-1.5 pl-6 text-gray-700 text-xs">
          Enter to send · Shift+Enter for newline · Ctrl+C to stop generation
        </p>
      </div>
    </div>
  );
}
