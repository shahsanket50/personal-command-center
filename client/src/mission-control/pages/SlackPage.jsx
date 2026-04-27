import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

function parseSections(text) {
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.replace('## ', '').trim(), body: [] };
    } else if (current) { current.body.push(line); }
  }
  if (current) sections.push(current);
  return sections;
}

function signalColor(bodyText, T) {
  if (bodyText.includes('Signal: high'))   return T.accent;
  if (bodyText.includes('Signal: medium')) return T.warn;
  return T.textGhost;
}

function SectionCard({ section }) {
  const T = useTheme();
  const signal = signalColor(section.body.join('\n'), T);
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: T.textHi, fontSize: 13.5, fontWeight: 600 }}>{section.heading}</span>
        <span style={{ fontSize: 11, color: signal }}>●</span>
      </div>
      <div style={{ fontSize: 15, color: T.textDim, lineHeight: 1.6 }}>
        {section.body.filter(l => l.trim() && !l.startsWith('Signal:')).map((line, i) => {
          if (line.startsWith('- [ ]')) return <div key={i} style={{ color: T.warn, marginBottom: 2 }}>□ {line.replace('- [ ]', '').trim()}</div>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: T.textGhost }}>·</span><span>{line.slice(2)}</span></div>;
          if (line.startsWith('**')) return <div key={i} style={{ color: T.textDim, fontWeight: 600, marginTop: 4 }}>{line.replace(/\*\*/g, '')}</div>;
          return <div key={i}>{line}</div>;
        })}
      </div>
    </div>
  );
}

export function SlackPage() {
  const T = useTheme();
  const linkBtn = { background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 11.5, fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', padding: 0 };
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [channels, setChannels] = useState([]);
  const [showChannels, setShowChannels] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/slack/channels`).then(r => r.json()).then(data => setChannels(Array.isArray(data) ? data : [])).catch(() => {});
    fetchCached();
  }, []);

  async function fetchCached() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/slack/digest`);
      if (!res.ok) throw new Error(`digest fetch failed: ${res.status}`);
      const data = await res.json();
      if (data) { setSections(parseSections(data)); setGeneratedAt(new Date().toLocaleTimeString()); }
      else { setIsLoading(false); await generate(); return; }
    } catch (e) {
      setError(e.message);
    } finally { setIsLoading(false); }
  }

  async function generate() {
    setIsGenerating(true); setError(null); setSections([]);
    try {
      const res = await fetch(`${API}/slack/digest/generate`, { method: 'POST' });
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data:')) continue;
          const p = line.slice(5).trim(); if (p === '[DONE]') break;
          try { const { text } = JSON.parse(p); if (text) { acc += text; setSections(parseSections(acc)); } } catch { /* skip */ }
        }
      }
      setGeneratedAt(new Date().toLocaleTimeString());
    } catch (e) { setError(e.message); }
    finally { setIsGenerating(false); }
  }

  async function toggleBlacklist(channelId) {
    const before = channels;
    const updated = channels.map(c => c.id === channelId ? { ...c, isBlacklisted: !c.isBlacklisted } : c);
    setChannels(updated);
    const blacklisted = updated.filter(c => c.isBlacklisted).map(c => c.id);
    try {
      const res = await fetch(`${API}/slack/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: blacklisted }),
      });
      if (!res.ok) throw new Error(`blacklist save failed: ${res.status}`);
    } catch (e) {
      setChannels(before);
      setError(e.message);
    }
  }

  const skeleton = Array.from({ length: 4 }, (_, i) => (
    <div key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, height: 80, marginBottom: 10 }} />
  ));

  const headerRight = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11.5 }}>
      {generatedAt && <span style={{ color: T.textFaint }}>generated {generatedAt}</span>}
      <button onClick={() => setShowChannels(s => !s)} style={linkBtn}>{showChannels ? 'hide channels' : 'channels'}</button>
      <button onClick={generate} disabled={isGenerating} style={{ ...linkBtn, opacity: isGenerating ? 0.5 : 1 }}>{isGenerating ? 'generating...' : '↺ refresh'}</button>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="slack_digest" right={headerRight}>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && <div style={{ color: T.danger, fontSize: 15, marginBottom: 10 }}>{error}</div>}
          {showChannels && channels.length > 0 && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: 5, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 15, color: T.textDim, marginBottom: 8 }}>channel blacklist (checked = included in digest)</div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {channels.map(ch => (
                  <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 15, color: ch.isBlacklisted ? T.textGhost : T.text }}>
                    <input type="checkbox" checked={!ch.isBlacklisted} onChange={() => toggleBlacklist(ch.id)} style={{ accentColor: T.accent }} />
                    {ch.type === 'dm' ? 'dm' : ch.type === 'private' ? 'prv' : '#'} {ch.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {(isLoading || (isGenerating && sections.length === 0)) ? skeleton
            : sections.map((s) => <SectionCard key={s.heading} section={s} />)}
          {!isLoading && !isGenerating && sections.length === 0 && (
            <div style={{ color: T.textGhost, fontSize: 15, textAlign: 'center', paddingTop: 32 }}>no slack activity in the last 24h</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
