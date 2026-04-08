import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { Plus, Check, Trash2, AlertCircle } from 'lucide-react';

const API = 'http://localhost:3001/api';

const TODAY = new Date();
const TODAY_STR = TODAY.toISOString().split('T')[0];
const DATE_LABEL = TODAY.toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupTasks(tasks) {
  const overdue = [];
  const today = [];
  const upcoming = [];
  const noDate = [];
  const done = [];

  for (const t of tasks) {
    if (t.status === 'Done') { done.push(t); continue; }
    if (!t.dueDate)          { noDate.push(t); continue; }
    if (t.dueDate < TODAY_STR)  overdue.push(t);
    else if (t.dueDate === TODAY_STR) today.push(t);
    else upcoming.push(t);
  }

  return { overdue, today, upcoming, noDate, done };
}

// ─── Task item ────────────────────────────────────────────────────────────────

function TaskItem({ task, theme, onToggle, onDelete }) {
  const isOverdue = task.dueDate && task.dueDate < TODAY_STR && task.status !== 'Done';

  return (
    <div className={clsx('flex items-center gap-3 px-3 py-2 rounded-md group', task.status === 'Done' && 'opacity-50')}>
      <button
        onClick={() => onToggle(task)}
        className={clsx(
          'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          task.status === 'Done' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 hover:border-blue-500'
        )}
      >
        {task.status === 'Done' && <Check size={12} />}
      </button>

      <span className={clsx('flex-1 text-sm', task.status === 'Done' ? 'line-through text-gray-400' : theme.heading)}>
        {task.title}
      </span>

      {task.dueDate && task.status !== 'Done' && (
        <span className={clsx('text-xs flex-shrink-0', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
          {task.dueDate}
        </span>
      )}

      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function TaskGroup({ label, tasks, labelClass, theme, onToggle, onDelete }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-4">
      <p className={clsx('text-xs font-semibold uppercase tracking-wide mb-1 px-3', labelClass)}>
        {label} ({tasks.length})
      </p>
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} theme={theme} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotesTasks({ theme }) {
  // Notes
  const [noteId, setNoteId] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteSaveStatus, setNoteSaveStatus] = useState('idle'); // idle | saving | saved | error
  const saveTimerRef = useRef(null);

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(null);
  const [showDone, setShowDone] = useState(false);

  // Add form
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  // Load today's note
  useEffect(() => {
    fetch(`${API}/notes/today`)
      .then((r) => r.json())
      .then((data) => { setNoteId(data.id); setNoteContent(data.content ?? ''); })
      .catch(() => {});
  }, []);

  // Load tasks
  useEffect(() => {
    setTasksLoading(true);
    fetch(`${API}/notes/tasks`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        else setTasksError(data.error ?? 'Failed to load tasks');
      })
      .catch((e) => setTasksError(e.message))
      .finally(() => setTasksLoading(false));
  }, []);

  // Save note
  const saveNote = useCallback(async (content, id) => {
    if (!id) return;
    setNoteSaveStatus('saving');
    try {
      const res = await fetch(`${API}/notes/today`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content }),
      });
      const data = await res.json();
      setNoteSaveStatus(data.ok ? 'saved' : 'error');
    } catch {
      setNoteSaveStatus('error');
    }
    setTimeout(() => setNoteSaveStatus('idle'), 2000);
  }, []);

  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNoteContent(val);
    setNoteSaveStatus('idle');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNote(val, noteId), 1500);
  };

  // Add task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API}/notes/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), dueDate: newDueDate || null }),
      });
      const task = await res.json();
      if (task.id) {
        setTasks((prev) => [...prev, task]);
        setNewTitle('');
        setNewDueDate('');
      }
    } finally {
      setAdding(false);
    }
  };

  // Toggle complete
  const handleToggle = async (task) => {
    const newStatus = task.status === 'Done' ? 'Not started' : 'Done';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await fetch(`${API}/notes/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
    }
  };

  // Delete (archive via Done)
  const handleDelete = async (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    fetch(`${API}/notes/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Done' }),
    }).catch(() => {});
  };

  const grouped = groupTasks(tasks);

  return (
    <div className="flex h-full">
      {/* ── Left panel: Notes ── */}
      <div className={clsx('flex flex-col w-1/2 border-r p-6', theme.divider)}>
        <div className="mb-5">
          <h1 className={clsx('text-2xl font-semibold', theme.heading)}>{DATE_LABEL}</h1>
          <p className={clsx('text-sm mt-0.5', theme.subheading)}>Daily notes</p>
        </div>

        <textarea
          className={clsx(
            'flex-1 w-full resize-none rounded-lg border p-3 text-sm font-mono leading-relaxed',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            theme.input
          )}
          placeholder="What's on your mind today…"
          value={noteContent}
          onChange={handleNoteChange}
          onBlur={() => saveNote(noteContent, noteId)}
        />

        <div className={clsx('mt-2 text-xs h-4', theme.subheading)}>
          {noteSaveStatus === 'saving' && 'Saving…'}
          {noteSaveStatus === 'saved' && 'Saved'}
          {noteSaveStatus === 'error' && <span className="text-red-500">Save failed</span>}
        </div>
      </div>

      {/* ── Right panel: Tasks ── */}
      <div className="flex flex-col w-1/2 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={clsx('text-2xl font-semibold', theme.heading)}>Tasks</h2>
            <p className={clsx('text-sm mt-0.5', theme.subheading)}>
              {tasks.filter((t) => t.status !== 'Done').length} active
            </p>
          </div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className={clsx('text-xs px-3 py-1.5 rounded-full border transition-colors', theme.buttonSecondary)}
          >
            {showDone ? 'Hide done' : 'Show done'}
          </button>
        </div>

        {/* Add form */}
        <form onSubmit={handleAddTask} className="flex gap-2 mb-5">
          <input
            type="text"
            className={clsx(
              'flex-1 px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
              theme.input
            )}
            placeholder="Add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            type="date"
            className={clsx(
              'px-2 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
              theme.input
            )}
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className={clsx(
              'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50',
              theme.button
            )}
          >
            <Plus size={14} />
          </button>
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {tasksLoading && <p className={clsx('text-sm', theme.subheading)}>Loading tasks…</p>}
          {tasksError && (
            <div className="flex items-center gap-2 text-sm text-red-500 mb-4">
              <AlertCircle size={14} /> {tasksError}
            </div>
          )}
          {!tasksLoading && !tasksError && (
            <>
              <TaskGroup label="Overdue"  tasks={grouped.overdue}  labelClass="text-red-500"  theme={theme} onToggle={handleToggle} onDelete={handleDelete} />
              <TaskGroup label="Today"    tasks={grouped.today}    labelClass="text-blue-600" theme={theme} onToggle={handleToggle} onDelete={handleDelete} />
              <TaskGroup label="Upcoming" tasks={grouped.upcoming} labelClass="text-gray-500" theme={theme} onToggle={handleToggle} onDelete={handleDelete} />
              <TaskGroup label="No date"  tasks={grouped.noDate}   labelClass="text-gray-400" theme={theme} onToggle={handleToggle} onDelete={handleDelete} />
              {showDone && (
                <TaskGroup label="Done" tasks={grouped.done} labelClass="text-gray-400" theme={theme} onToggle={handleToggle} onDelete={handleDelete} />
              )}
              {tasks.length === 0 && (
                <p className={clsx('text-sm px-3', theme.subheading)}>No tasks yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
