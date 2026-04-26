import React, { useState, useEffect, useRef } from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';
const TODAY = new Date().toISOString().split('T')[0];
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
const LABEL = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function duePriority(dueDate) {
  if (!dueDate) return 4;
  if (dueDate < TODAY) return 0;
  if (dueDate === TODAY) return 1;
  if (dueDate === TOMORROW) return 2;
  return 3;
}

function groupTasks(tasks) {
  const overdue = [], today = [], upcoming = [], noDate = [], done = [];
  for (const t of tasks) {
    if (t.status === 'Done')      { done.push(t); continue; }
    if (!t.dueDate)               { noDate.push(t); continue; }
    if (t.dueDate < TODAY)        overdue.push(t);
    else if (t.dueDate === TODAY) today.push(t);
    else                          upcoming.push(t);
  }
  return { overdue, today, upcoming, noDate, done };
}

function TaskRow({ task, onToggle, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const dueLabel = !task.dueDate ? '' : task.dueDate < TODAY ? 'overdue' : task.dueDate === TODAY ? 'today' : task.dueDate === TOMORROW ? 'tmrw' : task.dueDate.slice(5);
  const dueColor = dueLabel === 'overdue' ? T.danger : dueLabel === 'today' ? T.warn : T.textFaint;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 3, background: hovered ? T.bg3 : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => onToggle(task)}
        style={{
          flexShrink: 0, width: 13, height: 13, border: `1px solid ${T.textGhost}`,
          borderRadius: 2, background: task.status === 'Done' ? T.textGhost : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.bg0, fontSize: 9,
        }}
      >
        {task.status === 'Done' && '✓'}
      </button>
      <span style={{ flex: 1, fontSize: 11.5, color: task.status === 'Done' ? T.textGhost : T.text, textDecoration: task.status === 'Done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {dueLabel && <span style={{ fontSize: 10, color: dueColor, flexShrink: 0 }}>{dueLabel}</span>}
      {hovered && (
        <button onClick={() => onDelete(task)} style={{ background: 'transparent', border: 'none', color: T.textGhost, cursor: 'pointer', fontSize: 13, flexShrink: 0, padding: 0, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

function TaskGroup({ label, tasks, labelColor, onToggle, onDelete }) {
  if (tasks.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9.5, color: labelColor ?? T.textDim, letterSpacing: '.06em', padding: '2px 8px', marginBottom: 2 }}>
        {label} ({tasks.length})
      </div>
      {tasks.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />)}
    </div>
  );
}

export function NotesPage({ accent }) {
  const [noteId, setNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const saveTimer = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    fetch(`${API}/notes/today`).then(r => r.json()).then(data => {
      if (data?.id) { setNoteId(data.id); setNoteText(data.content ?? ''); }
    }).catch(() => {});
    fetchTasks();
  }, []);

  function fetchTasks() {
    fetch(`${API}/notes/tasks`).then(r => r.json()).then(data => {
      setTasks(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }

  function handleNoteChange(e) {
    const val = e.target.value;
    setNoteText(val);
    setSaveStatus('saving…');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(val), 1500);
  }

  async function saveNote(text) {
    try {
      await fetch(`${API}/notes/today`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId, content: text }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch { setSaveStatus('error'); }
  }

  async function handleAddTask() {
    if (!newTitle.trim()) return;
    await fetch(`${API}/notes/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), dueDate: newDate || null }),
    });
    setNewTitle(''); setNewDate('');
    fetchTasks();
  }

  async function handleToggle(task) {
    const newStatus = task.status === 'Done' ? 'Todo' : 'Done';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    await fetch(`${API}/notes/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleDelete(task) {
    setTasks(prev => prev.filter(t => t.id !== task.id));
    await fetch(`${API}/notes/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Done' }),
    });
  }

  const groups = groupTasks(tasks);
  const activeCount = tasks.filter(t => t.status !== 'Done').length;

  const inputStyle = {
    background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 3,
    color: T.text, fontSize: 11.5, padding: '4px 8px', outline: 'none',
    fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
  };

  return (
    <div style={{
      flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: 1, background: T.border, overflow: 'hidden', minHeight: 0,
      fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
    }}>
      <Panel
        title={`daily_note · ${LABEL}`}
        accent={accent}
        right={saveStatus ? <span style={{ fontSize: 9.5, color: saveStatus === 'error' ? T.danger : T.textDim }}>{saveStatus}</span> : null}
      >
        <textarea
          value={noteText}
          onChange={handleNoteChange}
          onBlur={() => { clearTimeout(saveTimer.current); saveNote(noteText); }}
          placeholder="# today's note…"
          style={{
            width: '100%', height: '100%', background: T.bg1, color: T.text,
            border: 'none', outline: 'none', resize: 'none', padding: '10px 12px',
            fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
            fontSize: 12, lineHeight: 1.6, boxSizing: 'border-box',
          }}
        />
      </Panel>

      <Panel
        title={`tasks [${activeCount} active]`}
        accent={accent}
        right={
          <button onClick={() => setShowDone(s => !s)} style={{ background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 9.5, fontFamily: 'inherit' }}>
            {showDone ? 'hide done' : 'show done'}
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, padding: '8px 8px 4px', flexShrink: 0 }}>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="new task…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ ...inputStyle, width: 110 }}
            />
            <button
              onClick={handleAddTask}
              style={{ ...inputStyle, padding: '4px 10px', cursor: 'pointer', background: T.bg3, color: accent, border: `1px solid ${T.border}` }}
            >+</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            <TaskGroup label="overdue"  tasks={groups.overdue}  labelColor={T.danger}    onToggle={handleToggle} onDelete={handleDelete} />
            <TaskGroup label="today"    tasks={groups.today}    labelColor={accent}      onToggle={handleToggle} onDelete={handleDelete} />
            <TaskGroup label="upcoming" tasks={groups.upcoming} labelColor={T.textDim}   onToggle={handleToggle} onDelete={handleDelete} />
            <TaskGroup label="no date"  tasks={groups.noDate}   labelColor={T.textFaint} onToggle={handleToggle} onDelete={handleDelete} />
            {showDone && <TaskGroup label="done" tasks={groups.done} labelColor={T.textGhost} onToggle={handleToggle} onDelete={handleDelete} />}
          </div>
        </div>
      </Panel>
    </div>
  );
}
