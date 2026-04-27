import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PIVOTS } from '../theme.js';
import { useTheme } from '../ThemeContext.jsx';

const API = 'http://localhost:3001/api';

const MODULES = [
  { label: 'Notes',       path: '/notes' },
  { label: 'Calendar',    path: '/calendar' },
  { label: 'Claude',      path: '/claude' },
  { label: 'Brief',       path: '/brief' },
  { label: 'Slack',       path: '/slack' },
  { label: 'Email',       path: '/email' },
  { label: 'Life & Goals',path: '/goals' },
];

const PIVOT_PATHS  = { today: '/', triage: '/triage', people: '/people' };
const PATH_TO_PIVOT = { '/': 'today', '/triage': 'triage', '/people': 'people' };

function useConnectionStatus() {
  const [status, setStatus] = useState({ microsoft: null, gmail: null });
  useEffect(() => {
    Promise.allSettled([
      fetch(`${API}/calendar/status`).then(r => r.json()),
      fetch(`${API}/email/status`).then(r => r.json()),
    ]).then(([calRes, emailRes]) => {
      const cal   = calRes.status   === 'fulfilled' ? calRes.value   : {};
      const email = emailRes.status === 'fulfilled' ? emailRes.value : {};
      setStatus({ microsoft: cal.microsoft ?? false, gmail: email.gmail ?? false });
    });
  }, []);
  return status;
}

export function TopBar({ onCmd }) {
  const T = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const conn = useConnectionStatus();

  const currentPivot = PATH_TO_PIVOT[location.pathname] ?? null;

  function dotColor(v) {
    if (v === null) return T.textGhost;
    return v ? T.accent : T.danger;
  }

  return (
    <div style={{ flexShrink: 0, fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      {/* Row 1 — brand + status + cmd */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 28, padding: '0 12px', gap: 10,
        background: T.bg0, borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ color: T.accent, fontSize: 9, letterSpacing: '.12em', fontWeight: 700 }}>
          MISSION CONTROL
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: dotColor(conn.microsoft), fontSize: 8 }}>● ms</span>
        <span style={{ color: dotColor(conn.gmail),     fontSize: 8 }}>● gmail</span>
        <button
          onClick={onCmd}
          onMouseDown={e => e.preventDefault()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px',
            background: T.bg2, border: `1px solid ${T.borderHi}`, borderRadius: 3,
            color: T.textDim, fontSize: 8, cursor: 'pointer',
          }}
        >
          ⌘K
        </button>
      </div>

      {/* Row 2 — pivot tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 30,
        background: T.bg1, borderBottom: `1px solid ${T.border}`,
      }}>
        {PIVOTS.map(p => {
          const active = currentPivot === p.id;
          return (
            <button
              key={p.id}
              onClick={() => navigate(PIVOT_PATHS[p.id])}
              onMouseDown={e => e.preventDefault()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 14px', height: '100%', border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: active ? T.accent : T.textDim,
                fontSize: 9.5,
                borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
              }}
            >
              {p.label}
              <span style={{ color: T.textGhost, fontSize: 8 }}>{p.key}</span>
            </button>
          );
        })}
      </div>

      {/* Row 3 — module links + Settings */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 26,
        background: T.bg2, borderBottom: `1px solid ${T.border}`,
      }}>
        {MODULES.map(m => {
          const active = location.pathname === m.path;
          return (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              onMouseDown={e => e.preventDefault()}
              style={{
                padding: '0 10px', height: '100%', border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: active ? T.accent : T.textDim,
                fontSize: 8,
                borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
              }}
            >
              {m.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/settings')}
          onMouseDown={e => e.preventDefault()}
          style={{
            padding: '0 10px', height: '100%', border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: location.pathname === '/settings' ? T.accent : T.textFaint,
            fontSize: 8,
            borderLeft: `1px solid ${T.border}`,
            borderBottom: location.pathname === '/settings' ? `2px solid ${T.accent}` : '2px solid transparent',
          }}
        >
          Settings ⟶
        </button>
      </div>
    </div>
  );
}
