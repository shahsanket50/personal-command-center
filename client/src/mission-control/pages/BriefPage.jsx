import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

const SECTION_ICONS = { greeting: '☀', meetings: '◫', tasks: '✓', flags: '⚑', travel: '✈' };

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

function SectionCard({ section }) {
  const T = useTheme();
  const icon = SECTION_ICONS[section.heading.toLowerCase()] ?? '◆';
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: 5, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 14, color: T.textHi, fontWeight: 600 }}>
        <span style={{ color: T.accent }}>{icon}</span>{section.heading}
      </div>
      <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.7 }}>
        {section.body.filter(l => l.trim()).map((line, i) => {
          if (line.startsWith('- ') || line.startsWith('* ')) return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ color: T.textGhost, flexShrink: 0 }}>·</span>
              <span>{line.slice(2)}</span>
            </div>
          );
          return <p key={i} style={{ margin: '2px 0' }}>{line}</p>;
        })}
      </div>
    </div>
  );
}

export function BriefPage() {
  const T = useTheme();
  const [sections, setSections] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    fetchCached();
    return () => abortRef.current?.abort();
  }, []);

  async function fetchCached() {
    try {
      const res = await fetch(`${API}/brief/today`);
      if (res.status === 404 || !res.ok) { return; } // no brief yet, user can click Refresh
      const data = await res.json();
      if (data?.content) {
        setSections(parseSections(data.content));
        setGeneratedAt(new Date().toLocaleTimeString());
      }
      // 200 but no content → show empty state, do not auto-generate
    } catch (e) {
      setError(e.message); // show error, do not call generate()
    }
  }

  async function generate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true); setError(null); setSections([]);
    try {
      const res = await fetch(`${API}/brief/generate`, { method: 'POST', signal: controller.signal });
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = ''; let buf = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const p = line.slice(5).trim(); if (p === '[DONE]') break;
          try { const { text } = JSON.parse(p); if (text) { acc += text; setSections(parseSections(acc)); } } catch { /* skip */ }
        }
      }
      setGeneratedAt(new Date().toLocaleTimeString());
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally { setIsGenerating(false); }
  }

  const skeleton = Array.from({ length: 4 }, (_, i) => (
    <div key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, height: 100, animation: 'mc-skeleton-pulse 1.5s ease-in-out infinite' }} />
  ));

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <style>{`@keyframes mc-skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <Panel
        title="morning_brief"
        right={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11.5 }}>
            {generatedAt && <span style={{ color: T.textFaint }}>generated {generatedAt}</span>}
            <button onClick={generate} disabled={isGenerating} style={{ background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', opacity: isGenerating ? 0.5 : 1 }}>
              {isGenerating ? 'generating…' : '↺ refresh'}
            </button>
          </div>
        }
      >
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {isGenerating && sections.length === 0 ? skeleton : sections.map((s) => <SectionCard key={s.heading} section={s} />)}
          </div>
        </div>
      </Panel>
    </div>
  );
}
