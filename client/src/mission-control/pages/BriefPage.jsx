import React, { useState, useEffect } from 'react';
import { T } from '../theme.js';
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
  const icon = SECTION_ICONS[section.heading.toLowerCase()] ?? '◆';
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: 5, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: T.textHi, fontWeight: 600 }}>
        <span style={{ color: '#86efac' }}>{icon}</span>{section.heading}
      </div>
      <div style={{ fontSize: 11.5, color: T.text, lineHeight: 1.7 }}>
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

export function BriefPage({ accent }) {
  const [sections, setSections] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { fetchCached(); }, []);

  async function fetchCached() {
    try {
      const res = await fetch(`${API}/brief/today`);
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      if (data?.content) { setSections(parseSections(data.content)); setGeneratedAt(new Date().toLocaleTimeString()); }
      else await generate();
    } catch { await generate(); }
  }

  async function generate() {
    setIsGenerating(true); setError(null); setSections([]);
    try {
      const res = await fetch(`${API}/brief/generate`, { method: 'POST' });
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

  const skeleton = Array.from({ length: 4 }, (_, i) => (
    <div key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, height: 100 }} />
  ));

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel
        title="morning_brief"
        accent={accent}
        right={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 9.5 }}>
            {generatedAt && <span style={{ color: T.textFaint }}>generated {generatedAt}</span>}
            <button onClick={generate} disabled={isGenerating} style={{ background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 9.5, fontFamily: 'inherit', opacity: isGenerating ? 0.5 : 1 }}>
              {isGenerating ? 'generating…' : '↺ refresh'}
            </button>
          </div>
        }
      >
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && <div style={{ color: T.danger, fontSize: 11, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {isGenerating && sections.length === 0 ? skeleton : sections.map((s, i) => <SectionCard key={i} section={s} />)}
          </div>
        </div>
      </Panel>
    </div>
  );
}
