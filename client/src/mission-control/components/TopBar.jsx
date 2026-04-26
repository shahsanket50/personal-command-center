import React from 'react';
import { T, PIVOTS } from '../theme.js';

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="4.5"/>
    <path d="m13.5 13.5-3-3"/>
  </svg>
);

export function TopBar({ pivot, setPivot, onCmd, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px',
      background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0,
    }}>
      <div style={{
        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
        fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', color: accent,
        paddingRight: 12, marginRight: 6, borderRight: `1px solid ${T.border}`,
      }}>
        ◆ COMMAND_CENTER
      </div>

      {PIVOTS.map((p) => {
        const active = pivot === p.id;
        return (
          <button key={p.id} onClick={() => setPivot(p.id)} onMouseDown={(e) => e.preventDefault()} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px',
            background: active ? T.bg4 : 'transparent',
            color: active ? accent : T.textDim,
            border: 'none', borderRadius: 5, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', outline: 'none',
          }}>
            {p.label}
            <span style={{
              fontSize: 9.5, color: T.textGhost,
              fontFamily: 'ui-monospace, Menlo, monospace', marginLeft: 4, letterSpacing: '.05em',
            }}>{p.key}</span>
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <button onClick={onCmd} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 11px',
        background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 5,
        color: T.textDim, fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer',
        minWidth: 240, justifyContent: 'space-between',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <SearchIcon /> /task, /note, /ask, /brief…
        </span>
        <kbd style={{
          fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
          background: T.bg0, border: `1px solid ${T.border}`, color: T.textDim,
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>⌘K</kbd>
      </button>
    </div>
  );
}
