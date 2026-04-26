import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

function parseSections(text) {
  const sections = [];
  const lines = text.split('\n');
  let current = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.replace('## ', '').trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p
  );
}

const SECTION_META = {
  'Office Emails': { icon: '🏢' },
  'Personal Emails': { icon: '📬' },
  'Email Insights': { icon: '💡', extra: 'bg-amber-50 border-amber-200' },
};

function SectionBody({ body, theme }) {
  return (
    <div className="space-y-1">
      {body.map((line, i) => {
        if (line.startsWith('- [ ]')) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-orange-400 flex-shrink-0">□</span>
              <span className={theme.label}>{renderInline(line.replace('- [ ]', '').trim())}</span>
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
              <span className={theme.label}>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.trim() === '') return null;
        if (line.startsWith('**')) {
          return (
            <p key={i} className={clsx('text-sm font-medium mt-2', theme.heading)}>
              {renderInline(line.replace(/^\*\*([^*]+)\*\*:?\s*/, '$1: '))}
            </p>
          );
        }
        return <p key={i} className={clsx('text-sm', theme.label)}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function EmailCard({ section, theme, isGenerating }) {
  const meta = SECTION_META[section.heading] || {};
  return (
    <div className={clsx(
      'rounded-xl border p-5 shadow-sm transition-all',
      meta.extra || theme.card,
      isGenerating && 'animate-pulse'
    )}>
      <h3 className={clsx('font-semibold text-base mb-3', theme.heading)}>
        {meta.icon && <span className="mr-2">{meta.icon}</span>}
        {section.heading}
      </h3>
      <SectionBody body={section.body} theme={theme} />
    </div>
  );
}

export default function Email({ theme }) {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => { fetchCachedDigest(); }, []);

  async function fetchCachedDigest() {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/email/digest');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (data) {
        setSections(parseSections(data));
        setGeneratedAt(new Date().toLocaleTimeString());
        setIsLoading(false);
      } else {
        setIsLoading(false);
        await generateDigest();
      }
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
    }
  }

  async function generateDigest() {
    setIsGenerating(true);
    setError(null);
    setSections([]);

    try {
      const res = await fetch('http://localhost:3001/api/email/digest/generate', { method: 'POST' });
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
          if (payload === '[DONE]') { setGeneratedAt(new Date().toLocaleTimeString()); break; }
          try {
            const { text, error: err } = JSON.parse(payload);
            if (err) { setError(err); break; }
            accumulated += text;
            setSections(parseSections(accumulated));
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  const skeletonCards = Array.from({ length: 3 }, (_, i) => (
    <div key={i} className={clsx('rounded-xl border p-5 shadow-sm animate-pulse', theme.card)}>
      <div className="h-4 bg-slate-200 rounded w-1/4 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
      </div>
    </div>
  ));

  return (
    <div className={clsx('min-h-screen p-8', theme.content)}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={clsx('text-2xl font-semibold', theme.heading)}>Email Triage</h1>
            {generatedAt && (
              <p className={clsx('text-xs mt-0.5', theme.subheading)}>Generated at {generatedAt}</p>
            )}
          </div>
          <button
            onClick={generateDigest}
            disabled={isGenerating}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isGenerating ? 'opacity-50 cursor-not-allowed' : '',
              theme.button
            )}
          >
            {isGenerating ? 'Generating…' : '↺ Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {isLoading
            ? skeletonCards
            : sections.length > 0
            ? sections.map((s, i) => (
                <EmailCard key={i} section={s} theme={theme} isGenerating={isGenerating} />
              ))
            : !isGenerating && (
                <p className={clsx('text-sm', theme.subheading)}>No unread emails found.</p>
              )}
        </div>
      </div>
    </div>
  );
}
