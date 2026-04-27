import React, { useState, useEffect, useRef } from 'react';
import { T } from '../theme.js';
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

const SECTION_LABELS = { 'Office Emails': '[o]', 'Personal Emails': '[p]', 'Email Insights': '[i]' };

function SectionCard({ section }) {
  const label = SECTION_LABELS[section.heading] ?? '[ ]';
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textHi, marginBottom: 8 }}>{label} {section.heading}</div>
      <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.6 }}>
        {section.body.filter(l => l.trim()).map((line, i) => {
          if (line.startsWith('- [ ]')) return <div key={i} style={{ color: T.warn, marginBottom: 2 }}>□ {line.replace('- [ ]', '').trim()}</div>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: T.textGhost }}>·</span><span>{line.slice(2)}</span></div>;
          if (line.startsWith('**')) return <div key={i} style={{ color: T.textDim, fontWeight: 600, marginTop: 4 }}>{line.replace(/\*\*/g, '')}</div>;
          return <div key={i}>{line}</div>;
        })}
      </div>
    </div>
  );
}

export function EmailPage({ accent }) {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    fetchCached();
    return () => abortRef.current?.abort();
  }, []);

  async function fetchCached() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/email/digest`);
      if (!res.ok) throw new Error(`digest fetch failed: ${res.status}`);
      const data = await res.json();
      if (data) {
        setSections(parseSections(data));
        setGeneratedAt(new Date().toLocaleTimeString());
      } else {
        setIsLoading(false);
        await generate();
        return;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function generate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true); setError(null); setSections([]);
    try {
      const res = await fetch(`${API}/email/digest/generate`, { method: 'POST', signal: controller.signal });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const p = line.slice(5).trim();
          if (p === '[DONE]') break;
          try { const { text } = JSON.parse(p); if (text) { acc += text; setSections(parseSections(acc)); } } catch { /* skip */ }
        }
      }
      setGeneratedAt(new Date().toLocaleTimeString());
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  const skeleton = Array.from({ length: 3 }, (_, i) => (
    <div key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, height: 80, marginBottom: 10, animation: 'mc-skeleton-pulse 1.5s ease-in-out infinite' }} />
  ));

  const headerRight = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 9.5 }}>
      {generatedAt && <span style={{ color: T.textFaint }}>generated {generatedAt}</span>}
      <button
        onClick={generate}
        disabled={isGenerating}
        style={{ background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 9.5, fontFamily: 'inherit', opacity: isGenerating ? 0.5 : 1, padding: 0 }}
      >
        {isGenerating ? 'generating...' : '↺ refresh'}
      </button>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <style>{`@keyframes mc-skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <Panel title="email_triage" accent={accent} right={headerRight}>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && <div style={{ color: T.danger, fontSize: 11, marginBottom: 10 }}>{error}</div>}
          {(isLoading || (isGenerating && sections.length === 0)) ? skeleton
            : sections.map(s => <SectionCard key={s.heading} section={s} />)}
          {!isLoading && !isGenerating && sections.length === 0 && !error && (
            <div style={{ color: T.textGhost, fontSize: 11, textAlign: 'center', paddingTop: 32 }}>no unread emails</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
