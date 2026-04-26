import React, { useState } from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';
import { PeoplePanel } from '../panels/PeoplePanel.jsx';

function last1on1Label(dateStr) {
  if (!dateStr) return 'never';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 14) return '1 wk ago';
  return `${Math.floor(days / 7)} wks ago`;
}

function ActionBtn({ children, primary, accent, hot }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px',
      background: primary ? accent : T.bg3,
      color: primary ? T.bg0 : T.text,
      border: primary ? 'none' : `1px solid ${T.border}`,
      borderRadius: 4, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
      fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
    }}>
      {children}
      {hot && <kbd style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, background: T.bg0, color: T.textDim, border: `1px solid ${T.border}` }}>{hot}</kbd>}
    </button>
  );
}

function PersonDetail({ person, accent }) {
  if (!person) return <div style={{ padding: '32px 22px', color: T.textGhost, fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace' }}>select a person with j/k</div>;

  const isOverdue = !person.last1on1 || (Date.now() - new Date(person.last1on1).getTime()) > 14 * 86400000;

  return (
    <div style={{ padding: '16px 22px', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 26,
          background: person.ooo ? '#92400e' : T.bg4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 600, color: person.ooo ? '#fef3c7' : T.textHi, flexShrink: 0,
        }}>{person.initials}</div>
        <div>
          <div style={{ fontSize: 20, color: T.textHi, fontWeight: 600 }}>{person.name}</div>
          <div style={{ fontSize: 11.5, color: T.textDim }}>{person.role} · last 1:1 {last1on1Label(person.last1on1)}</div>
          {person.ooo && <div style={{ fontSize: 11, color: T.warn, marginTop: 2 }}>OOO</div>}
        </div>
        <div style={{ flex: 1 }} />
        {person.notionUrl && (
          <a href={person.notionUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <ActionBtn primary accent={accent} hot="enter">open 1:1 doc</ActionBtn>
          </a>
        )}
        <ActionBtn accent={accent} hot="c">claude prep</ActionBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 22 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: accent }}>cadence</div>
          <div style={{ marginTop: 8, fontSize: 12, color: T.text, lineHeight: 1.7 }}>
            <div>last 1:1: {last1on1Label(person.last1on1)}</div>
            <div>status: {isOverdue ? <span style={{ color: T.warn }}>overdue</span> : <span style={{ color: accent }}>on track</span>}</div>
          </div>

          <div style={{ marginTop: 18, fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: accent }}>talking points</div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: T.textDim }}>
            Use <span style={{ color: accent }}>/1on1 {(person.name ?? '').split(' ')[0]?.toLowerCase()}</span> to pull from 1:1 notes.
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: accent }}>recent activity</div>
          <div style={{ marginTop: 8, fontSize: 11, color: T.textDim, lineHeight: 1.7 }}>
            Activity stream (Slack + calendar + email) — Phase 7.
          </div>
          <div style={{ marginTop: 22, padding: '10px 12px', background: T.bg3, borderLeft: `2px solid ${accent}`, fontSize: 11.5, color: T.textDim, lineHeight: 1.55 }}>
            <span style={{ color: accent }}>last 1:1 notes</span> — open Notion doc for full notes.
          </div>
        </div>
      </div>
    </div>
  );
}

export function PeopleView({ panelFocus, cursors, accent, onPeopleLoaded }) {
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(null);

  const handleLoaded = (list) => {
    setPeople(list);
    onPeopleLoaded?.(list);
    if (list.length > 0 && !selected) setSelected(list[0]);
  };

  const currentPerson = people[cursors.people] ?? selected;

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 1, background: T.border, overflow: 'hidden', minHeight: 0 }}>
      <Panel title="team" hint="j/k" focused={panelFocus === 'people'} accent={accent}>
        <PeoplePanel focused={panelFocus === 'people'} cursor={cursors.people} accent={accent} onLoaded={handleLoaded} onSelect={setSelected} />
      </Panel>
      <Panel title={currentPerson ? `person · ${currentPerson.name.toLowerCase()}` : 'person'} focused={panelFocus === 'detail'} accent={accent}>
        <PersonDetail person={currentPerson} accent={accent} />
      </Panel>
    </div>
  );
}
