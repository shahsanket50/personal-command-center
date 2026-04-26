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
  'Channel Insights': { icon: '💡', extra: 'bg-amber-50 border-amber-200' },
};

function getSignalBadge(bodyLines) {
  const text = bodyLines.join('\n');
  if (text.includes('Signal: high') || text.includes('**Signal:** high')) return { label: 'High signal', color: 'bg-green-100 text-green-700' };
  if (text.includes('Signal: medium') || text.includes('**Signal:** medium')) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' };
  if (text.includes('Signal: low') || text.includes('**Signal:** low')) return { label: 'Low signal', color: 'bg-gray-100 text-gray-500' };
  return null;
}

function SectionBody({ body, theme }) {
  return (
    <div className="space-y-1">
      {body
        .filter(l => !l.startsWith('**Signal:**') && !l.match(/^Signal: (high|medium|low)/i))
        .map((line, i) => {
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
                <span className={clsx('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', theme.subheading === 'text-slate-500' ? 'bg-slate-400' : 'bg-gray-400')} />
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

function DigestCard({ section, theme, isGenerating }) {
  const meta = SECTION_META[section.heading] || {};
  const signal = getSignalBadge(section.body);

  return (
    <div className={clsx(
      'rounded-xl border p-5 shadow-sm transition-all',
      meta.extra || theme.card,
      isGenerating && 'animate-pulse'
    )}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={clsx('font-semibold text-base', theme.heading)}>
          {meta.icon && <span className="mr-2">{meta.icon}</span>}
          {section.heading}
        </h3>
        {signal && (
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', signal.color)}>
            {signal.label}
          </span>
        )}
      </div>
      <SectionBody body={section.body} theme={theme} />
    </div>
  );
}

function ChannelPanel({ channels, theme, onToggleBlacklist }) {
  const typeOrder = { dm: 0, group_dm: 1, private: 2, public: 3 };
  const sorted = [...channels].sort((a, b) => (typeOrder[a.type] ?? 4) - (typeOrder[b.type] ?? 4));

  return (
    <div className={clsx('rounded-xl border p-5 shadow-sm mb-6', theme.card)}>
      <h3 className={clsx('font-semibold text-base mb-1', theme.heading)}>Channels & DMs</h3>
      <p className={clsx('text-xs mb-3', theme.subheading)}>Uncheck to exclude a channel from the digest.</p>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {sorted.map(ch => (
          <label key={ch.id} className="flex items-center gap-2 cursor-pointer py-0.5">
            <input
              type="checkbox"
              checked={!ch.isBlacklisted}
              onChange={() => onToggleBlacklist(ch.id)}
              className="rounded"
            />
            <span className={clsx('text-sm', ch.isBlacklisted ? 'line-through text-gray-400' : theme.label)}>
              {ch.type === 'dm' ? '💬' : ch.type === 'group_dm' ? '👥' : ch.type === 'private' ? '🔒' : '#'} {ch.name}
            </span>
            <span className={clsx('text-xs ml-auto', theme.subheading)}>{ch.type.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Slack({ theme }) {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [channels, setChannels] = useState([]);
  const [showChannels, setShowChannels] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    fetchChannels();
    fetchCachedDigest();
  }, []);

  async function fetchChannels() {
    try {
      const res = await fetch('http://localhost:3001/api/slack/channels');
      if (res.ok) setChannels(await res.json());
    } catch { /* non-fatal */ }
  }

  async function fetchCachedDigest() {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/slack/digest');
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
      const res = await fetch('http://localhost:3001/api/slack/digest/generate', { method: 'POST' });
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
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleToggleBlacklist(channelId) {
    const updated = channels.map(c =>
      c.id === channelId ? { ...c, isBlacklisted: !c.isBlacklisted } : c
    );
    setChannels(updated);
    const blacklisted = updated.filter(c => c.isBlacklisted).map(c => c.id);
    await fetch('http://localhost:3001/api/slack/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelIds: blacklisted }),
    });
  }

  const skeletonCards = Array.from({ length: 4 }, (_, i) => (
    <div key={i} className={clsx('rounded-xl border p-5 shadow-sm animate-pulse', theme.card)}>
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
      </div>
    </div>
  ));

  return (
    <div className={clsx('min-h-screen p-8', theme.content)}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={clsx('text-2xl font-semibold', theme.heading)}>Slack Digest</h1>
            {generatedAt && (
              <p className={clsx('text-xs mt-0.5', theme.subheading)}>Generated at {generatedAt}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowChannels(v => !v)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm transition-colors', theme.buttonSecondary)}
            >
              {showChannels ? 'Hide' : 'Manage'} Channels
            </button>
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
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {showChannels && channels.length > 0 && (
          <ChannelPanel channels={channels} theme={theme} onToggleBlacklist={handleToggleBlacklist} />
        )}

        <div className="space-y-4">
          {isLoading
            ? skeletonCards
            : sections.length > 0
            ? sections.map((s, i) => (
                <DigestCard key={i} section={s} theme={theme} isGenerating={isGenerating} />
              ))
            : !isGenerating && (
                <p className={clsx('text-sm', theme.subheading)}>No Slack activity in the last 24 hours.</p>
              )}
        </div>
      </div>
    </div>
  );
}
