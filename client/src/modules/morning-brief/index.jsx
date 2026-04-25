import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { RefreshCw, Sun, Calendar, CheckSquare, Flag, AlertCircle, Loader2 } from 'lucide-react';

const SECTION_META = {
  'Good morning, Sanket': { icon: Sun, accent: 'text-amber-500' },
  'Meetings today': { icon: Calendar, accent: 'text-blue-500' },
  'Focus tasks': { icon: CheckSquare, accent: 'text-indigo-500' },
  'Personal flags': { icon: Flag, accent: 'text-emerald-500' },
};

function parseSections(text) {
  const sections = [];
  let current = null;

  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.slice(3).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  return sections.map((s) => ({
    heading: s.heading,
    body: s.lines.join('\n').trim(),
  }));
}

function renderInline(text) {
  // Render **bold** spans
  const parts = text.split(/\*\*(.+?)\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  );
}

function SectionBody({ body, theme }) {
  const lines = body.split('\n');
  return (
    <div className="space-y-1.5 mt-3">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className={clsx('mt-1 text-xs flex-shrink-0', theme.subheading)}>•</span>
              <span className={clsx('text-sm leading-relaxed', theme.label)}>
                {renderInline(line.slice(2))}
              </span>
            </div>
          );
        }
        return (
          <p key={i} className={clsx('text-sm leading-relaxed', theme.label)}>
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function BriefCard({ section, theme, isStreaming }) {
  const meta = SECTION_META[section.heading] ?? { icon: Sun, accent: 'text-slate-400' };
  const Icon = meta.icon;

  return (
    <div className={clsx('rounded-xl border p-5', theme.card)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={meta.accent} />
        <h2 className={clsx('text-sm font-semibold', theme.heading)}>{section.heading}</h2>
        {isStreaming && !section.body && (
          <Loader2 size={12} className={clsx('animate-spin ml-auto', theme.subheading)} />
        )}
      </div>
      {section.body ? (
        <SectionBody body={section.body} theme={theme} />
      ) : (
        <p className={clsx('text-sm mt-3', theme.subheading)}>
          {isStreaming ? 'Writing…' : ''}
        </p>
      )}
    </div>
  );
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MorningBrief({ theme }) {
  const [briefText, setBriefText] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  const sections = parseSections(briefText);

  const generate = useCallback(async () => {
    setBriefText('');
    setIsStreaming(true);
    setError(null);
    setGeneratedAt(null);

    try {
      const res = await fetch('http://localhost:3001/api/brief/generate', { method: 'POST' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') {
            setGeneratedAt(new Date().toISOString());
            break;
          }
          try {
            const { text, error: errMsg } = JSON.parse(payload);
            if (errMsg) throw new Error(errMsg);
            if (text) {
              accumulated += text;
              setBriefText(accumulated);
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  // On mount: check for a cached brief for today; auto-generate if none
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:3001/api/brief/today');
        const data = await res.json();
        if (data?.content) {
          setBriefText(data.content);
          setGeneratedAt(data.createdAt ?? null);
          setIsChecking(false);
          return;
        }
      } catch {
        // fall through to generate
      }
      setIsChecking(false);
      generate();
    })();
  }, [generate]);

  const isLoading = isChecking || (isStreaming && !briefText);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={clsx('text-xl font-semibold', theme.heading)}>Morning Brief</h1>
          {generatedAt && !isStreaming && (
            <p className={clsx('text-xs mt-0.5', theme.subheading)}>
              Generated at {formatTime(generatedAt)}
            </p>
          )}
          {isStreaming && (
            <p className={clsx('text-xs mt-0.5 flex items-center gap-1', theme.subheading)}>
              <Loader2 size={10} className="animate-spin" />
              Generating…
            </p>
          )}
        </div>
        <button
          onClick={generate}
          disabled={isStreaming || isChecking}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            theme.buttonSecondary,
            (isStreaming || isChecking) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <RefreshCw size={13} className={isStreaming ? 'animate-spin' : ''} />
          Refresh briefing
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 mb-4 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Could not generate brief</p>
            <p className="mt-0.5 text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !error && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={clsx('rounded-xl border p-5 animate-pulse', theme.card)}
            >
              <div className={clsx('h-3 w-32 rounded mb-3', 'bg-slate-200')} />
              <div className="space-y-2">
                <div className={clsx('h-2.5 w-full rounded', 'bg-slate-200')} />
                <div className={clsx('h-2.5 w-3/4 rounded', 'bg-slate-200')} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Brief sections */}
      {!isLoading && sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((section) => (
            <BriefCard
              key={section.heading}
              section={section}
              theme={theme}
              isStreaming={isStreaming}
            />
          ))}
        </div>
      )}

      {/* Streaming but no sections parsed yet */}
      {isStreaming && sections.length === 0 && !isLoading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={clsx('rounded-xl border p-5 animate-pulse', theme.card)}>
              <div className="h-3 w-32 rounded mb-3 bg-slate-200" />
              <div className="space-y-2">
                <div className="h-2.5 w-full rounded bg-slate-200" />
                <div className="h-2.5 w-3/4 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
