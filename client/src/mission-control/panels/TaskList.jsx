import React, { useState, useEffect } from 'react';
import { T } from '../theme.js';

const API = 'http://localhost:3001/api';
const TODAY = new Date().toISOString().split('T')[0];
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

function duePriority(dueDate) {
  if (!dueDate) return 3;
  if (dueDate < TODAY) return 0;
  if (dueDate === TODAY) return 1;
  if (dueDate === TOMORROW) return 2;
  return 3;
}

function dueLabel(dueDate) {
  if (!dueDate) return '--';
  if (dueDate < TODAY) return 'overdue';
  if (dueDate === TODAY) return 'today';
  if (dueDate === TOMORROW) return 'tmrw';
  return dueDate.slice(5);
}

export function TaskList({ focused, cursor, accent, onLoaded }) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetch(`${API}/notes/tasks`)
      .then(r => r.json())
      .then((data) => {
        const active = (Array.isArray(data) ? data : [])
          .filter((t) => t.status !== 'Done')
          .sort((a, b) => duePriority(a.dueDate) - duePriority(b.dueDate));
        setTasks(active);
        onLoaded?.(active);
      })
      .catch(() => setTasks([]));
  }, []);

  if (tasks.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: T.textGhost, fontSize: 11.5, fontFamily: 'ui-monospace, Menlo, monospace' }}>
        no tasks — inbox zero.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', fontSize: 11.5, padding: '6px 4px' }}>
      {tasks.map((t, i) => {
        const due = dueLabel(t.dueDate);
        const dueColor = due === 'overdue' ? T.danger : due === 'today' ? T.warn : T.textDim;
        const isCursor = focused && cursor === i;
        return (
          <div key={t.id} style={{
            display: 'flex', gap: 10, padding: '4px 10px', alignItems: 'center',
            background: isCursor ? T.bg4 : 'transparent', borderRadius: 3,
            color: isCursor ? T.textHi : T.text,
            borderLeft: isCursor ? `2px solid ${accent}` : '2px solid transparent',
          }}>
            <span style={{ color: T.textGhost, minWidth: 18, fontSize: 10 }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ color: T.textGhost }}>[ ]</span>
            <span style={{ color: dueColor, minWidth: 64, fontWeight: 600, fontSize: 10.5 }}>{due.padEnd(7)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
          </div>
        );
      })}
    </div>
  );
}
