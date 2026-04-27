import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext.jsx';

const API = 'http://localhost:3001/api';

function last1on1Label(dateStr) {
  if (!dateStr) return 'never';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 14) return '1 wk ago';
  return `${Math.floor(days / 7)} wks ago`;
}

export function PeoplePanel({ focused, cursor, onLoaded, onSelect }) {
  const T = useTheme();
  const [people, setPeople] = useState([]);

  useEffect(() => {
    fetch(`${API}/people`)
      .then(r => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPeople(list);
        onLoaded?.(list);
      })
      .catch(() => setPeople([]));
  }, []);

  if (people.length === 0) {
    return <div style={{ padding: '18px 12px', color: T.textGhost, fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace' }}>no people in DB.</div>;
  }

  return (
    <div style={{ fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', fontSize: 11 }}>
      {people.map((p, i) => {
        const isCursor = focused && cursor === i;
        return (
          <div key={p.id} onClick={() => onSelect?.(p)} style={{
            padding: '6px 11px', borderBottom: `1px solid ${T.bg2}`,
            display: 'flex', alignItems: 'center', gap: 9,
            background: isCursor ? T.bg4 : 'transparent',
            borderLeft: isCursor ? `2px solid ${T.accent}` : '2px solid transparent',
            cursor: 'pointer',
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 12,
              background: p.ooo ? '#92400e' : T.bg4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: p.ooo ? '#fef3c7' : T.text, flexShrink: 0,
            }}>{p.initials}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.text, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                {p.name}
                {p.ooo && <span style={{ color: T.warn, fontSize: 9.5 }}>· OOO</span>}
              </div>
              <div style={{ color: T.textGhost, fontSize: 10 }}>{p.role.split(' · ')[0]} · {last1on1Label(p.last1on1)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
