import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.jsx';

const API = 'http://localhost:3001/api';
const TODAY = new Date().toISOString().split('T')[0];
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

function duePriority(dueDate) {
  if (!dueDate) return 4;
  if (dueDate < TODAY) return 0;
  if (dueDate === TODAY) return 1;
  if (dueDate === TOMORROW) return 2;
  return 3;
}

function dueLabel(dueDate) {
  if (!dueDate) return 'no date';
  if (dueDate < TODAY) return 'overdue';
  if (dueDate === TODAY) return 'today';
  if (dueDate === TOMORROW) return 'tmrw';
  return dueDate.slice(5);
}

export function TaskList({ focused, cursor, onLoaded }) {
  const T = useTheme();
  const [tasks, setTasks] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const navigate = useNavigate();

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

  async function handleToggle(task) {
    const newStatus = task.status === 'Done' ? 'Todo' : 'Done';
    setTasks(prev => prev.filter(t => t.id !== task.id));
    try {
      await fetch(`${API}/notes/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setTasks(prev => [...prev, task].sort((a, b) => duePriority(a.dueDate) - duePriority(b.dueDate)));
    }
  }

  async function handleDelete(task) {
    setTasks(prev => prev.filter(t => t.id !== task.id));
    try {
      await fetch(`${API}/notes/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Done' }),
      });
    } catch {
      setTasks(prev => [...prev, task].sort((a, b) => duePriority(a.dueDate) - duePriority(b.dueDate)));
    }
  }

  if (tasks.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: T.textGhost, fontSize: 13.5, fontFamily: 'ui-monospace, Menlo, monospace' }}>
        no tasks — inbox zero.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', fontSize: 13.5, padding: '6px 4px' }}>
      {tasks.map((t, i) => {
        const due = dueLabel(t.dueDate);
        const dueColor = due === 'overdue' ? T.danger : due === 'today' ? T.warn : due === 'no date' ? T.textFaint : T.textDim;
        const isCursor = focused && cursor === i;
        const isHovered = hoveredId === t.id;
        return (
          <div
            key={t.id}
            style={{
              display: 'flex', gap: 8, padding: '4px 10px', alignItems: 'center',
              background: isCursor ? T.bg4 : 'transparent', borderRadius: 3,
              color: isCursor ? T.textHi : T.text,
              borderLeft: isCursor ? `2px solid ${T.accent}` : '2px solid transparent',
            }}
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <button
              onClick={() => handleToggle(t)}
              style={{
                flexShrink: 0, width: 13, height: 13,
                border: `1px solid ${T.textGhost}`, borderRadius: 2,
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.textGhost, fontSize: 11,
              }}
            >
              {t.status === 'Done' && '✓'}
            </button>
            <span style={{ color: dueColor, minWidth: 56, fontWeight: 600, fontSize: 16, flexShrink: 0 }}>
              {due}
            </span>
            <span
              onClick={() => navigate('/notes')}
              style={{
                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}
              title={t.title}
            >
              {t.title}
            </span>
            {(isCursor || isHovered) && (
              <button
                onClick={() => handleDelete(t)}
                style={{
                  flexShrink: 0, background: 'transparent', border: 'none',
                  color: T.textGhost, cursor: 'pointer', fontSize: 15, padding: '0 2px',
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
