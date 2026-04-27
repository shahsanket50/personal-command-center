import React from 'react';
import { useTheme } from '../ThemeContext.jsx';

const GROUPS = [
  { title: 'navigation', items: [
    ['j / k', 'move cursor'],
    ['tab / shift-tab', 'next/prev pane'],
    ['g t', 'today pivot'],
    ['g i', 'triage pivot'],
    ['g p', 'people pivot'],
  ]},
  { title: 'actions', items: [
    ['x', 'mark done'],
    ['e', 'edit / to task'],
    ['r', 'reply'],
    ['s', 'snooze'],
    ['a', 'archive'],
  ]},
  { title: 'global', items: [
    ['cmd+k', 'command palette'],
    ['?', 'this help'],
    ['esc', 'close overlay'],
    ['c', 'ask claude'],
  ]},
];

export function HelpOverlay({ open, onClose }) {
  const T = useTheme();
  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(5,7,9,.7)',
      backdropFilter: 'blur(4px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 640, padding: '20px 24px', borderRadius: 10,
        background: T.bg2, border: `1px solid ${T.borderHi}`,
        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ color: T.accent }}>◆</span>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.textHi }}>keyboard reference</h2>
          <span style={{ flex: 1 }} />
          <kbd style={{ fontSize: 12, padding: '1px 5px', borderRadius: 3, background: T.bg0, border: `1px solid ${T.border}`, color: T.textDim }}>esc</kbd>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.accent, marginBottom: 8 }}>{g.title}</div>
              {g.items.map(([k, d]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13.5 }}>
                  <span style={{ color: T.text }}>{d}</span>
                  <kbd style={{ fontSize: 12.5, padding: '1px 5px', borderRadius: 3, background: T.bg0, border: `1px solid ${T.border}`, color: T.textDim }}>{k}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
