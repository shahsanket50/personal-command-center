# MC Full Navigation & Module Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three-row TopBar, URL-based routing for MC pivots, MC-native dark full-page module views, task interactivity in the Today panel, and panel click-throughs.

**Architecture:** Replace pivot `useState` with `useLocation`/`useNavigate`; add `<Routes>` to App.jsx content area so pivot views and module pages share the same shell; new pages in `client/src/mission-control/pages/` use T tokens + inline styles only (no Tailwind); old `client/src/modules/` files remain untouched.

**Tech Stack:** React Router DOM (already installed via BrowserRouter in main.jsx), react-syntax-highlighter (already installed), T tokens from theme.js, Panel chrome from components/Panel.jsx

**Spec:** `docs/superpowers/specs/2026-04-26-mc-full-navigation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/mission-control/components/TopBar.jsx` | Replace | Three-row bar: brand+status (Row 1), pivots (Row 2), module links (Row 3) |
| `client/src/App.jsx` | Modify | Remove pivot useState, add Routes, wire /ask palette command, remove StatusLine render |
| `client/src/mission-control/panels/TaskList.jsx` | Modify | Toggle/delete/navigate, No Date group |
| `client/src/mission-control/pivots/TodayView.jsx` | Modify | Add view→ links to each Panel header |
| `client/src/mission-control/pages/NotesPage.jsx` | Create | Two-column: daily note textarea + task CRUD |
| `client/src/mission-control/pages/CalendarPage.jsx` | Create | Date nav, [/]/t keyboard, hour grid |
| `client/src/mission-control/pages/ClaudePage.jsx` | Create | Multi-turn SSE, ?q= param auto-submit, save to Notion |
| `client/src/mission-control/pages/BriefPage.jsx` | Create | Full-width section cards, SSE refresh |
| `client/src/mission-control/pages/SlackPage.jsx` | Create | Dark port of slack module, channel blacklist |
| `client/src/mission-control/pages/EmailPage.jsx` | Create | Dark port of email module, dual-account sections |
| `client/src/mission-control/pages/SettingsPage.jsx` | Create | Dark port of settings, two tabs |
| `client/src/mission-control/pages/GoalsPage.jsx` | Create | Stub "coming soon" page |

---

## Task 1: Three-Row TopBar

**Files:**
- Replace: `client/src/mission-control/components/TopBar.jsx`

Absorbs connection status from StatusLine. Uses `useLocation` and `useNavigate` internally — no `pivot`/`setPivot` props needed.

- [ ] **Step 1: Replace TopBar.jsx**

```jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { T, PIVOTS } from '../theme.js';

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

export function TopBar({ onCmd, accent }) {
  const location = useLocation();
  const navigate = useNavigate();
  const conn = useConnectionStatus();

  const currentPivot = PATH_TO_PIVOT[location.pathname] ?? null;

  function dotColor(v) {
    if (v === null) return T.textGhost;
    return v ? accent : T.danger;
  }

  return (
    <div style={{ flexShrink: 0, fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      {/* Row 1 — brand + status + cmd */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 28, padding: '0 12px', gap: 10,
        background: T.bg0, borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ color: accent, fontSize: 9, letterSpacing: '.12em', fontWeight: 700 }}>
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
                color: active ? accent : T.textDim,
                fontSize: 9.5,
                borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
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
                color: active ? accent : T.textDim,
                fontSize: 8,
                borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
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
            color: location.pathname === '/settings' ? accent : T.textFaint,
            fontSize: 8,
            borderLeft: `1px solid ${T.border}`,
            borderBottom: location.pathname === '/settings' ? `2px solid ${accent}` : '2px solid transparent',
          }}
        >
          Settings ⟶
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/components/TopBar.jsx
git commit -m "feat(mc): replace TopBar with three-row layout (brand+status / pivots / modules)"
```

---

## Task 2: App.jsx — URL routing + /ask wiring + remove StatusLine

**Files:**
- Modify: `client/src/App.jsx`

Key changes: remove `pivot` useState; derive from `useLocation().pathname`; add `useNavigate`; wrap content in `<Routes>`; wire `/ask` to `navigate('/claude?q=...')`; remove `<StatusLine>` render; remove `pivot`/`setPivot` props from `<TopBar>`.

- [ ] **Step 1: Rewrite App.jsx**

```jsx
import React, { useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom';
import { T, PIVOTS, PIVOT_PANELS } from './mission-control/theme.js';
import { useKeyboard } from './mission-control/useKeyboard.js';
import { TopBar } from './mission-control/components/TopBar.jsx';
import { KeyHints } from './mission-control/components/KeyHints.jsx';
import { CommandPalette } from './mission-control/components/CommandPalette.jsx';
import { HelpOverlay } from './mission-control/components/HelpOverlay.jsx';
import { TodayView } from './mission-control/pivots/TodayView.jsx';
import { TriageView } from './mission-control/pivots/TriageView.jsx';
import { PeopleView } from './mission-control/pivots/PeopleView.jsx';
import { NotesPage }    from './mission-control/pages/NotesPage.jsx';
import { CalendarPage } from './mission-control/pages/CalendarPage.jsx';
import { ClaudePage }   from './mission-control/pages/ClaudePage.jsx';
import { BriefPage }    from './mission-control/pages/BriefPage.jsx';
import { SlackPage }    from './mission-control/pages/SlackPage.jsx';
import { EmailPage }    from './mission-control/pages/EmailPage.jsx';
import { SettingsPage } from './mission-control/pages/SettingsPage.jsx';
import { GoalsPage }    from './mission-control/pages/GoalsPage.jsx';

const ACCENT = '#86efac';
const API = 'http://localhost:3001/api';

const PATH_TO_PIVOT = { '/': 'today', '/triage': 'triage', '/people': 'people' };
const PIVOT_PATHS   = { today: '/', triage: '/triage', people: '/people' };

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const pivot = PATH_TO_PIVOT[location.pathname] ?? 'today';
  const isModulePage = !PATH_TO_PIVOT[location.pathname];

  const [paneIdx, setPaneIdx] = useState(0);
  const [cursors, setCursors] = useState({ tasks: 0, triage: 0, people: 0 });
  const [triageFilter, setTriageFilter] = useState('all');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);
  const [taskLen, setTaskLen] = useState(0);
  const [triageLen, setTriageLen] = useState(0);
  const [peopleLen, setPeopleLen] = useState(0);

  const panels = PIVOT_PANELS[pivot] ?? PIVOT_PANELS.today;
  const panelFocus = panels[paneIdx] ?? panels[0];

  const switchPivot = useCallback((p) => {
    navigate(PIVOT_PATHS[p]);
    setPaneIdx(0);
  }, [navigate]);

  const handleCommand = useCallback(async (cmd, arg) => {
    if (cmd === '/today')  { switchPivot('today');  return { close: true }; }
    if (cmd === '/triage') { switchPivot('triage'); return { close: true }; }
    if (cmd === '/people') { switchPivot('people'); return { close: true }; }

    if (cmd === '/ask') {
      const q = arg ? encodeURIComponent(arg.trim()) : '';
      navigate(q ? `/claude?q=${q}` : '/claude');
      return { close: true };
    }

    if (cmd === '/task') {
      if (!arg) return { status: 'usage: /task <text> [today|tmrw|YYYY-MM-DD]' };
      const words = arg.split(' ');
      const lastWord = words[words.length - 1];
      const TODAY = new Date().toISOString().split('T')[0];
      const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
      const dueDateMap = { today: TODAY, tmrw: TOMORROW };
      const dueDate = dueDateMap[lastWord] ?? (/^\d{4}-\d{2}-\d{2}$/.test(lastWord) ? lastWord : null);
      const title = dueDate ? words.slice(0, -1).join(' ') : arg;
      await fetch(`${API}/notes/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, dueDate }),
      });
      return { close: true, status: `task created: ${title}` };
    }

    if (cmd === '/note') {
      if (!arg) return { status: 'usage: /note <text>' };
      const noteRes = await fetch(`${API}/notes/today`).then(r => r.json()).catch(() => null);
      if (noteRes?.id) {
        const updated = (noteRes.content ?? '') + '\n- ' + arg;
        await fetch(`${API}/notes/today`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: noteRes.id, content: updated }),
        });
      }
      return { close: true, status: 'note saved' };
    }

    if (cmd === '/brief') {
      return { close: true, status: 'brief regenerating — see morning_brief panel' };
    }

    return { status: `unknown command: ${cmd}` };
  }, [switchPivot, navigate]);

  const CURSOR_KEY = { triage: 'triage', tasks: 'tasks', people: 'people' };

  const handlers = useMemo(() => ({
    any: (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setCmdOpen(true); return;
      }
      if (cmdOpen || helpOpen) return;
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); return; }
      if (e.key === 'Escape') { setCmdOpen(false); setHelpOpen(false); return; }

      if (gPressed) {
        const map = { t: 'today', i: 'triage', p: 'people' };
        if (map[e.key]) switchPivot(map[e.key]);
        setGPressed(false);
        return;
      }
      if (e.key === 'g') { setGPressed(true); setTimeout(() => setGPressed(false), 1200); return; }

      if (!isModulePage && e.key === 'Tab') {
        e.preventDefault();
        setPaneIdx((i) => (i + (e.shiftKey ? -1 : 1) + panels.length) % panels.length);
        return;
      }

      const cKey = CURSOR_KEY[panelFocus];
      const listLen = panelFocus === 'tasks' ? taskLen : panelFocus === 'triage' ? triageLen : panelFocus === 'people' ? peopleLen : 0;
      if (cKey && listLen > 0) {
        if (e.key === 'j') { e.preventDefault(); setCursors((c) => ({ ...c, [cKey]: Math.min(c[cKey] + 1, listLen - 1) })); }
        if (e.key === 'k') { e.preventDefault(); setCursors((c) => ({ ...c, [cKey]: Math.max(c[cKey] - 1, 0) })); }
      }
    },
  }), [cmdOpen, helpOpen, gPressed, panelFocus, panels, taskLen, triageLen, peopleLen, switchPivot, isModulePage]);

  useKeyboard(handlers);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: T.bg0, overflow: 'hidden' }}>
      <TopBar onCmd={() => setCmdOpen(true)} accent={ACCENT} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={
            <TodayView panelFocus={panelFocus} cursors={cursors} accent={ACCENT} triageFilter={triageFilter} setTriageFilter={setTriageFilter} onTasksLoaded={(l) => setTaskLen(l.length)} onTriageLoaded={(l) => setTriageLen(l.length)} onPeopleLoaded={(l) => setPeopleLen(l.length)} />
          } />
          <Route path="/triage" element={
            <TriageView panelFocus={panelFocus} cursors={cursors} accent={ACCENT} filter={triageFilter} setFilter={setTriageFilter} onTriageLoaded={(l) => setTriageLen(l.length)} />
          } />
          <Route path="/people" element={
            <PeopleView panelFocus={panelFocus} cursors={cursors} accent={ACCENT} onPeopleLoaded={(l) => setPeopleLen(l.length)} />
          } />
          <Route path="/notes"    element={<NotesPage    accent={ACCENT} />} />
          <Route path="/calendar" element={<CalendarPage accent={ACCENT} />} />
          <Route path="/claude"   element={<ClaudePage   accent={ACCENT} />} />
          <Route path="/brief"    element={<BriefPage    accent={ACCENT} />} />
          <Route path="/slack"    element={<SlackPage    accent={ACCENT} />} />
          <Route path="/email"    element={<EmailPage    accent={ACCENT} />} />
          <Route path="/settings" element={<SettingsPage accent={ACCENT} />} />
          <Route path="/goals"    element={<GoalsPage    accent={ACCENT} />} />
        </Routes>
      </div>

      {!isModulePage && <KeyHints pivot={pivot} panelFocus={panelFocus} />}

      {gPressed && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 14px', background: T.bg2, border: `1px solid ${ACCENT}`,
          borderRadius: 6, fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12, color: T.textHi, zIndex: 50,
        }}>
          <span style={{ color: ACCENT }}>g</span> + <span style={{ color: T.warn }}>t</span>oday · <span style={{ color: T.warn }}>i</span>nbox · <span style={{ color: T.warn }}>p</span>eople
        </div>
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} accent={ACCENT} onCommand={handleCommand} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} accent={ACCENT} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(mc): switch pivot routing to URL-based, wire /ask, add module page Routes"
```

---

## Task 3: TaskList — toggle, delete, No Date group, title click navigate

**Files:**
- Modify: `client/src/mission-control/panels/TaskList.jsx`

- [ ] **Step 1: Rewrite TaskList.jsx**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../theme.js';

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

export function TaskList({ focused, cursor, accent, onLoaded }) {
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
      <div style={{ padding: '32px 16px', textAlign: 'center', color: T.textGhost, fontSize: 11.5, fontFamily: 'ui-monospace, Menlo, monospace' }}>
        no tasks — inbox zero.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', fontSize: 11.5, padding: '6px 4px' }}>
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
              borderLeft: isCursor ? `2px solid ${accent}` : '2px solid transparent',
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
                color: T.textGhost, fontSize: 9,
              }}
            >
              {t.status === 'Done' && '✓'}
            </button>
            <span style={{ color: dueColor, minWidth: 56, fontWeight: 600, fontSize: 10, flexShrink: 0 }}>
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
                  color: T.textGhost, cursor: 'pointer', fontSize: 11, padding: '0 2px',
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/panels/TaskList.jsx
git commit -m "feat(mc): add toggle/delete/navigate to TaskList, include No Date group"
```

---

## Task 4: TodayView — panel click-throughs

**Files:**
- Modify: `client/src/mission-control/pivots/TodayView.jsx`

- [ ] **Step 1: Update TodayView.jsx**

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';
import { Schedule } from '../panels/Schedule.jsx';
import { TaskList } from '../panels/TaskList.jsx';
import { Brief } from '../panels/Brief.jsx';
import { TriageStream } from '../panels/TriageStream.jsx';
import { PeoplePanel } from '../panels/PeoplePanel.jsx';

function ViewLink({ to }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      onMouseDown={e => e.preventDefault()}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: T.textDim, fontSize: 9.5, fontFamily: 'inherit', padding: 0,
      }}
    >
      view →
    </button>
  );
}

export function TodayView({ panelFocus, cursors, accent, triageFilter, setTriageFilter, onTasksLoaded, onTriageLoaded, onPeopleLoaded }) {
  return (
    <div style={{
      flex: 1, display: 'grid',
      gridTemplateColumns: '320px 1fr 280px',
      gridTemplateRows: '1fr 1fr',
      gap: 1, background: T.border, overflow: 'hidden', minHeight: 0,
    }}>
      <Panel title="schedule_today" hint="g c" right={<ViewLink to="/calendar" />} focused={panelFocus === 'schedule'} accent={accent} style={{ gridArea: '1 / 1 / 3 / 2' }}>
        <Schedule accent={accent} />
      </Panel>

      <Panel title="action_queue" hint="g a" right={<ViewLink to="/notes" />} focused={panelFocus === 'tasks'} accent={accent}>
        <TaskList focused={panelFocus === 'tasks'} cursor={cursors.tasks} accent={accent} onLoaded={onTasksLoaded} />
      </Panel>

      <Panel title="triage" hint="g i" right={<ViewLink to="/triage" />} focused={panelFocus === 'triage'} accent={accent}>
        <TriageStream focused={panelFocus === 'triage'} cursor={cursors.triage} accent={accent} filter={triageFilter} setFilter={setTriageFilter} compact onLoaded={onTriageLoaded} />
      </Panel>

      <Panel title="morning_brief" hint="g b" right={<ViewLink to="/brief" />} focused={panelFocus === 'brief'} accent={accent}>
        <Brief accent={accent} />
      </Panel>

      <Panel title="people" hint="g p" right={<ViewLink to="/people" />} focused={panelFocus === 'people'} accent={accent}>
        <PeoplePanel focused={panelFocus === 'people'} cursor={cursors.people} accent={accent} onLoaded={onPeopleLoaded} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pivots/TodayView.jsx
git commit -m "feat(mc): add panel click-through view→ links in TodayView"
```

---

## Task 5: NotesPage — daily note + task CRUD

**Files:**
- Create: `client/src/mission-control/pages/NotesPage.jsx`

Two-column layout. Left: daily note textarea with 1.5s debounce autosave. Right: task groups (Overdue / Today / Upcoming / No Date / Done toggle) plus add form.

- [ ] **Step 1: Create NotesPage.jsx**

```jsx
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
            <TaskGroup label="overdue"  tasks={groups.overdue}  labelColor={T.danger}   onToggle={handleToggle} onDelete={handleDelete} />
            <TaskGroup label="today"    tasks={groups.today}    labelColor={accent}     onToggle={handleToggle} onDelete={handleDelete} />
            <TaskGroup label="upcoming" tasks={groups.upcoming} labelColor={T.textDim}  onToggle={handleToggle} onDelete={handleDelete} />
            <TaskGroup label="no date"  tasks={groups.noDate}   labelColor={T.textFaint} onToggle={handleToggle} onDelete={handleDelete} />
            {showDone && <TaskGroup label="done" tasks={groups.done} labelColor={T.textGhost} onToggle={handleToggle} onDelete={handleDelete} />}
          </div>
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/NotesPage.jsx
git commit -m "feat(mc): add NotesPage — daily note autosave + task CRUD with groups"
```

---

## Task 6: CalendarPage — date nav, keyboard shortcuts, hour grid

**Files:**
- Create: `client/src/mission-control/pages/CalendarPage.jsx`

Own `keydown` listener for `[` / `]` / `t` — safe since App.jsx does not handle these keys.

- [ ] **Step 1: Create CalendarPage.jsx**

```jsx
import React, { useState, useEffect } from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

function fmtDate(d) { return d.toISOString().split('T')[0]; }
function dateLabel(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function nowFrac(date) {
  const now = new Date();
  if (fmtDate(now) !== fmtDate(date)) return -1;
  return (now.getHours() - 6) + now.getMinutes() / 60;
}

const btnStyle = { background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 9.5, fontFamily: 'inherit', padding: 0 };

export function CalendarPage({ accent }) {
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState({ google: null, microsoft: null });
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch(`${API}/calendar/status`).then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/calendar/events?date=${fmtDate(date)}`)
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, [date]);

  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === '[') { e.preventDefault(); setDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); }
      if (e.key === ']') { e.preventDefault(); setDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); }
      if (e.key === 't') { e.preventDefault(); setDate(new Date()); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const HOURS = Array.from({ length: 16 }, (_, i) => 6 + i);
  const frac = nowFrac(date);
  const connectWarning = status.google === false || status.microsoft === false;

  const headerRight = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9.5 }}>
      <button onClick={() => setDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })} style={btnStyle}>[ prev</button>
      <span style={{ color: T.textDim }}>{dateLabel(date)}</span>
      <button onClick={() => setDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })} style={btnStyle}>next ]</button>
      <button onClick={() => setDate(new Date())} style={{ ...btnStyle, color: accent }}>t today</button>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="calendar" accent={accent} right={headerRight}>
        {connectWarning && (
          <div style={{ padding: '6px 12px', background: T.bg3, color: T.warn, fontSize: 10.5, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            {status.google === false && 'Google Calendar disconnected — reconnect in /settings. '}
            {status.microsoft === false && 'Microsoft Calendar disconnected — reconnect in /settings.'}
          </div>
        )}
        <div style={{ position: 'relative', overflowY: 'auto', flex: 1, padding: '4px 12px' }}>
          {frac >= 0 && frac <= 16 && (
            <div style={{ position: 'absolute', left: 54, right: 12, top: `${(frac / 16) * 100}%`, height: 1, background: '#10b981', boxShadow: '0 0 6px #10b981', zIndex: 2, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', left: -4, top: -3, width: 7, height: 7, borderRadius: 4, background: '#10b981' }} />
            </div>
          )}
          {HOURS.map((h, i) => {
            const hourEvents = events.filter(ev => {
              const s = ev.start?.dateTime ?? ev.start?.date;
              return s && new Date(s).getHours() === h;
            });
            return (
              <div key={h} style={{ display: 'flex', gap: 10, minHeight: 52, borderTop: i === 0 ? 'none' : `1px solid ${T.bg4}`, paddingTop: 4, position: 'relative', alignItems: 'flex-start' }}>
                <div style={{ color: T.textGhost, minWidth: 42, fontSize: 10.5 }}>{String(h).padStart(2,'0')}:00</div>
                <div style={{ flex: 1 }}>
                  {hourEvents.map((ev, j) => {
                    const now = new Date();
                    const start = new Date(ev.start?.dateTime ?? ev.start?.date);
                    const end   = new Date(ev.end?.dateTime ?? ev.end?.date);
                    const isPast = end < now;
                    const isNow  = start <= now && now < end;
                    const tagColor = ev.source === 'personal' ? '#10b981' : isNow ? accent : T.info;
                    const startLabel = ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                    const isExpanded = expanded === (ev.id ?? j);
                    return (
                      <div
                        key={ev.id ?? j}
                        onClick={() => setExpanded(isExpanded ? null : (ev.id ?? j))}
                        style={{ padding: '3px 8px', background: isNow ? T.bg4 : T.bg3, borderLeft: `2px solid ${tagColor}`, fontSize: 11, color: isPast ? T.textGhost : isNow ? T.textHi : T.text, borderRadius: 2, marginBottom: 3, cursor: 'pointer', textDecoration: isPast ? 'line-through' : 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: T.textFaint, fontSize: 10, minWidth: 36 }}>{startLabel}</span>
                          {isNow && <span style={{ color: '#10b981' }}>●</span>}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(ev.summary ?? '(no title)').toLowerCase()}</span>
                          {ev.attendeeCount > 0 && <span style={{ color: T.textGhost, fontSize: 10 }}>{ev.attendeeCount}p</span>}
                          <span style={{ color: T.textGhost, fontSize: 9, flexShrink: 0 }}>{ev.source}</span>
                        </div>
                        {isExpanded && (
                          <div style={{ marginTop: 4, color: T.textDim, fontSize: 10.5, lineHeight: 1.5 }}>
                            {ev.location && <div>📍 {ev.location}</div>}
                            {ev.attendeeCount > 0 && <div>👥 {ev.attendeeCount} attendees</div>}
                            {start && end && <div>🕐 {startLabel} – {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/CalendarPage.jsx
git commit -m "feat(mc): add CalendarPage — date nav, [/]/t keyboard, hour grid, event expand"
```

---

## Task 7: ClaudePage — multi-turn streaming, ?q= auto-submit, Notion save

**Files:**
- Create: `client/src/mission-control/pages/ClaudePage.jsx`

Reuses streaming/parsing logic from old `claude-cli/index.jsx`. Reads `?q=` URL param on mount and auto-submits.

- [ ] **Step 1: Create ClaudePage.jsx**

```jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { T } from '../theme.js';

const API = 'http://localhost:3001/api';

function parseContent(text) {
  const parts = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    parts.push({ type: 'code', language: match[1] || 'text', content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });
  return parts;
}

function MessageBubble({ msg, isStreaming }) {
  const isUser = msg.role === 'user';
  const parts = parseContent(msg.content);
  return (
    <div style={{ padding: '12px 16px', background: isUser ? 'transparent' : T.bg1, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', gap: 12, maxWidth: 800, margin: '0 auto' }}>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: isUser ? T.accent : T.info, fontFamily: 'ui-monospace, Menlo, monospace', minWidth: 52, textAlign: 'right', paddingTop: 2 }}>
          {isUser ? 'you >' : 'claude >'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {parts.map((p, i) => p.type === 'code' ? (
            <div key={i} style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              {p.language && p.language !== 'text' && (
                <div style={{ background: '#1a1a2e', padding: '3px 10px', fontSize: 9.5, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>{p.language}</div>
              )}
              <SyntaxHighlighter language={p.language || 'text'} style={oneDark} customStyle={{ margin: 0, borderRadius: 0, fontSize: 12 }} wrapLongLines>
                {p.content}
              </SyntaxHighlighter>
            </div>
          ) : (
            <p key={i} style={{ color: T.text, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 4px', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
              {p.content}
              {isStreaming && i === parts.length - 1 && (
                <span style={{ display: 'inline-block', width: 8, height: 14, background: T.accent, marginLeft: 2, verticalAlign: 'middle', animation: 'mc-pulse 1s infinite' }} />
              )}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const hdrBtn = { background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: 'pointer', fontSize: 10, padding: '3px 8px', fontFamily: 'ui-monospace, Menlo, monospace' };

export function ClaudePage({ accent }) {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !autoSubmitted.current) {
      autoSubmitted.current = true;
      const decoded = decodeURIComponent(q);
      setTimeout(() => sendMessage(decoded), 100);
    }
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async (text) => {
    const prompt = (typeof text === 'string' ? text : input).trim();
    if (!prompt || isStreaming) return;

    setHistory(prev => [prompt, ...prev.filter(h => h !== prompt)]);
    setHistoryIdx(-1);
    setInput('');

    const userMsg      = { role: 'user',      content: prompt };
    const assistantMsg = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API}/claude/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') break;
          try {
            const { text: t } = JSON.parse(payload);
            if (t) { accumulated += t; setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: accumulated } : m)); }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: '[error: ' + e.message + ']' } : m));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages]);

  async function handleSave() {
    setSaveStatus('saving…');
    try {
      await fetch(`${API}/claude/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) });
      setSaveStatus('saved'); setTimeout(() => setSaveStatus(''), 2000);
    } catch { setSaveStatus('error'); }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); return; }
    if (e.ctrlKey && e.key === 'c') { abortRef.current?.abort(); return; }
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault();
      const idx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(idx); if (history[idx]) setInput(history[idx]);
    }
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault();
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx); setInput(idx === -1 ? '' : (history[idx] ?? ''));
    }
  }

  const exchangeCount = Math.floor(messages.length / 2);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, fontSize: 10.5 }}>
        <span style={{ color: accent }}>$ claude-chat</span>
        <span style={{ color: T.textGhost }}>claude-sonnet-4-5</span>
        <span style={{ color: T.textFaint }}>{exchangeCount} exchanges</span>
        <div style={{ flex: 1 }} />
        {saveStatus && <span style={{ color: saveStatus === 'error' ? T.danger : T.textDim, fontSize: 10 }}>{saveStatus}</span>}
        <button onClick={handleSave} style={hdrBtn}>Save to Notion</button>
        <button onClick={() => { abortRef.current?.abort(); setMessages([]); setHistoryIdx(-1); }} style={hdrBtn}>Clear</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: T.bg0 }}>
        {messages.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: T.textGhost, fontSize: 12 }}>
            $ ask anything — ↑↓ history · Ctrl+C abort
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} isStreaming={isStreaming && i === messages.length - 1 && m.role === 'assistant'} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: T.bg1, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ color: accent, fontSize: 13, alignSelf: 'center' }}>{'>'}</span>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="ask something… (Enter to send, Shift+Enter newline)"
          style={{ flex: 1, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 12.5, padding: '6px 10px', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={isStreaming || !input.trim()}
          style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 4, color: accent, cursor: 'pointer', fontSize: 11, padding: '0 12px', alignSelf: 'stretch', opacity: (isStreaming || !input.trim()) ? 0.4 : 1 }}
        >
          {isStreaming ? '…' : '⏎'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/ClaudePage.jsx
git commit -m "feat(mc): add ClaudePage — streaming chat, ?q= auto-submit, Notion save, history"
```

---

## Task 8: BriefPage — full-width section cards, SSE refresh

**Files:**
- Create: `client/src/mission-control/pages/BriefPage.jsx`

- [ ] **Step 1: Create BriefPage.jsx**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/BriefPage.jsx
git commit -m "feat(mc): add BriefPage — section cards with SSE refresh"
```

---

## Task 9: SlackPage — dark port with channel blacklist

**Files:**
- Create: `client/src/mission-control/pages/SlackPage.jsx`

- [ ] **Step 1: Create SlackPage.jsx**

```jsx
import React, { useState, useEffect } from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

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

function signalColor(bodyText) {
  if (bodyText.includes('Signal: high'))   return T.accent;
  if (bodyText.includes('Signal: medium')) return T.warn;
  return T.textGhost;
}

function SectionCard({ section }) {
  const signal = signalColor(section.body.join('\n'));
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: T.textHi, fontSize: 11.5, fontWeight: 600 }}>{section.heading}</span>
        <span style={{ fontSize: 9, color: signal }}>●</span>
      </div>
      <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.6 }}>
        {section.body.filter(l => l.trim() && !l.startsWith('Signal:')).map((line, i) => {
          if (line.startsWith('- [ ]')) return <div key={i} style={{ color: T.warn, marginBottom: 2 }}>□ {line.replace('- [ ]', '').trim()}</div>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: T.textGhost }}>·</span><span>{line.slice(2)}</span></div>;
          if (line.startsWith('**')) return <div key={i} style={{ color: T.textDim, fontWeight: 600, marginTop: 4 }}>{line.replace(/\*\*/g, '')}</div>;
          return <div key={i}>{line}</div>;
        })}
      </div>
    </div>
  );
}

const linkBtn = { background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 9.5, fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', padding: 0 };

export function SlackPage({ accent }) {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [channels, setChannels] = useState([]);
  const [showChannels, setShowChannels] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/slack/channels`).then(r => r.json()).then(data => setChannels(Array.isArray(data) ? data : [])).catch(() => {});
    fetchCached();
  }, []);

  async function fetchCached() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/slack/digest`);
      const data = await res.json();
      if (data) { setSections(parseSections(data)); setGeneratedAt(new Date().toLocaleTimeString()); }
      else await generate();
    } catch { await generate(); }
    finally { setIsLoading(false); }
  }

  async function generate() {
    setIsGenerating(true); setError(null); setSections([]);
    try {
      const res = await fetch(`${API}/slack/digest/generate`, { method: 'POST' });
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

  async function toggleBlacklist(channelId) {
    const updated = channels.map(c => c.id === channelId ? { ...c, isBlacklisted: !c.isBlacklisted } : c);
    setChannels(updated);
    const blacklisted = updated.filter(c => c.isBlacklisted).map(c => c.id);
    await fetch(`${API}/slack/blacklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelIds: blacklisted }) });
  }

  const skeleton = Array.from({ length: 4 }, (_, i) => (
    <div key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, height: 80, marginBottom: 10 }} />
  ));

  const headerRight = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 9.5 }}>
      {generatedAt && <span style={{ color: T.textFaint }}>generated {generatedAt}</span>}
      <button onClick={() => setShowChannels(s => !s)} style={linkBtn}>{showChannels ? 'hide channels' : 'channels'}</button>
      <button onClick={generate} disabled={isGenerating} style={{ ...linkBtn, opacity: isGenerating ? 0.5 : 1 }}>{isGenerating ? 'generating…' : '↺ refresh'}</button>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="slack_digest" accent={accent} right={headerRight}>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && <div style={{ color: T.danger, fontSize: 11, marginBottom: 10 }}>{error}</div>}
          {showChannels && channels.length > 0 && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: 5, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>channel blacklist (checked = included in digest)</div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {channels.map(ch => (
                  <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: ch.isBlacklisted ? T.textGhost : T.text }}>
                    <input type="checkbox" checked={!ch.isBlacklisted} onChange={() => toggleBlacklist(ch.id)} style={{ accentColor: accent }} />
                    {ch.type === 'dm' ? '💬' : ch.type === 'private' ? '🔒' : '#'}{ch.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {(isLoading || (isGenerating && sections.length === 0)) ? skeleton
            : sections.map((s, i) => <SectionCard key={i} section={s} />)}
          {!isLoading && !isGenerating && sections.length === 0 && (
            <div style={{ color: T.textGhost, fontSize: 11, textAlign: 'center', paddingTop: 32 }}>no slack activity in the last 24h</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/SlackPage.jsx
git commit -m "feat(mc): add SlackPage — dark port with channel blacklist management"
```

---

## Task 10: EmailPage — dark port with dual-account sections

**Files:**
- Create: `client/src/mission-control/pages/EmailPage.jsx`

- [ ] **Step 1: Create EmailPage.jsx**

```jsx
import React, { useState, useEffect } from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

const SECTION_ICONS = { 'Office Emails': '🏢', 'Personal Emails': '📬', 'Email Insights': '💡' };

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
  const icon = SECTION_ICONS[section.heading] ?? '◆';
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textHi, marginBottom: 8 }}>{icon} {section.heading}</div>
      <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.6 }}>
        {section.body.filter(l => l.trim()).map((line, i) => {
          if (line.startsWith('- [ ]')) return <div key={i} style={{ color: T.warn, marginBottom: 2 }}>□ {line.replace('- [ ]', '').trim()}</div>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: T.textGhost }}>·</span><span>{line.slice(2)}</span></div>;
          if (line.startsWith('**')) return <div key={i} style={{ color: T.textDim, fontWeight: 600, marginTop: 4 }}>{line.replace(/\*\*/g, '')}</div>;
          return <div key={i}>{line}</div>;
        })}
      </div>
    </div>
  );
}

export function EmailPage({ accent }) {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { fetchCached(); }, []);

  async function fetchCached() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/email/digest`);
      const data = await res.json();
      if (data) { setSections(parseSections(data)); setGeneratedAt(new Date().toLocaleTimeString()); }
      else await generate();
    } catch { await generate(); }
    finally { setIsLoading(false); }
  }

  async function generate() {
    setIsGenerating(true); setError(null); setSections([]);
    try {
      const res = await fetch(`${API}/email/digest/generate`, { method: 'POST' });
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

  const skeleton = Array.from({ length: 3 }, (_, i) => (
    <div key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, height: 80, marginBottom: 10 }} />
  ));

  const headerRight = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 9.5 }}>
      {generatedAt && <span style={{ color: T.textFaint }}>generated {generatedAt}</span>}
      <button onClick={generate} disabled={isGenerating} style={{ background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 9.5, fontFamily: 'inherit', opacity: isGenerating ? 0.5 : 1 }}>
        {isGenerating ? 'generating…' : '↺ refresh'}
      </button>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="email_triage" accent={accent} right={headerRight}>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && <div style={{ color: T.danger, fontSize: 11, marginBottom: 10 }}>{error}</div>}
          {(isLoading || (isGenerating && sections.length === 0)) ? skeleton
            : sections.map((s, i) => <SectionCard key={i} section={s} />)}
          {!isLoading && !isGenerating && sections.length === 0 && (
            <div style={{ color: T.textGhost, fontSize: 11, textAlign: 'center', paddingTop: 32 }}>no unread emails</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/EmailPage.jsx
git commit -m "feat(mc): add EmailPage — dark port with dual-account digest sections"
```

---

## Task 11: SettingsPage — dark port, two tabs

**Files:**
- Create: `client/src/mission-control/pages/SettingsPage.jsx`

- [ ] **Step 1: Create SettingsPage.jsx**

```jsx
import React, { useState, useEffect } from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

const FIELDS = {
  Accounts: [
    { key: 'ANTHROPIC_API_KEY',    label: 'Anthropic API Key',       secret: true,  placeholder: 'sk-ant-…' },
    { key: 'NOTION_API_KEY',       label: 'Notion API Key',          secret: true,  placeholder: 'secret_…' },
    { key: 'SLACK_BOT_TOKEN',      label: 'Slack Bot Token',         secret: true,  placeholder: 'xoxb-…' },
    { key: '_section_ms',          label: 'Microsoft 365 (Office)',  type: 'section' },
    { key: 'MS_ACCOUNT_OFFICE',    label: 'Office Email',            secret: false, placeholder: 'you@company.com' },
    { key: 'MS_TENANT_ID',         label: 'Azure AD Tenant ID',      secret: false, placeholder: 'xxxxxxxx-…' },
    { key: 'MS_CLIENT_ID',         label: 'Azure App Client ID',     secret: true,  placeholder: 'xxxxxxxx-…' },
    { key: 'MS_CLIENT_SECRET',     label: 'Azure App Client Secret', secret: true,  placeholder: '…' },
    { key: '_section_google',      label: 'Google (Personal)',       type: 'section' },
    { key: 'GMAIL_ACCOUNT_PERSONAL', label: 'Personal Gmail',        secret: false, placeholder: 'you@gmail.com' },
    { key: 'GOOGLE_CLIENT_ID',     label: 'Google Client ID',        secret: true,  placeholder: '….apps.googleusercontent.com' },
    { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret',    secret: true,  placeholder: 'GOCSPX-…' },
  ],
  Notion: [
    { key: 'NOTION_ROOT_PAGE_ID',        label: 'Root Page ID',         placeholder: '32-char page ID' },
    { key: 'NOTION_DB_DAILY_BRIEFINGS',  label: 'Daily Briefings DB',   placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_TASKS',            label: 'Tasks DB',             placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_PEOPLE',           label: 'People DB',            placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_ACTION_ITEMS',     label: 'Action Items DB',      placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_HABITS_GOALS',     label: 'Habits & Goals DB',    placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_TRAVEL_BOOKINGS',  label: 'Travel & Bookings DB', placeholder: '32-char DB ID' },
  ],
};

function SecretField({ field, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, color: T.textDim, marginBottom: 4 }}>
        {field.label}
        {value && <span style={{ marginLeft: 8, color: T.accent, fontSize: 9 }}>● set</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={field.secret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.secret && !value ? '••••••••' : field.placeholder}
          style={{
            flex: 1, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 3,
            color: T.text, fontSize: 11.5, padding: '5px 8px', outline: 'none',
            fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
          }}
        />
        {field.secret && (
          <button onClick={() => setShow(s => !s)} style={{ background: 'transparent', border: 'none', color: T.textGhost, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage({ accent }) {
  const [activeTab, setActiveTab] = useState('Accounts');
  const [values, setValues] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [notionTest, setNotionTest] = useState(null);

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.json()).then(data => {
      setValues(data.values ?? {});
    }).catch(() => {});
  }, []);

  function handleChange(key, val) { setValues(prev => ({ ...prev, [key]: val })); }

  async function handleSave() {
    setSaveStatus('saving…');
    try {
      await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) });
      setSaveStatus('saved'); setTimeout(() => setSaveStatus(''), 2000);
    } catch { setSaveStatus('error'); }
  }

  async function handleTestNotion() {
    setNotionTest('testing…');
    try {
      const res = await fetch(`${API}/notion/test`);
      const data = await res.json();
      setNotionTest(data.ok ? '✓ connected' : '✗ ' + (data.error ?? 'failed'));
    } catch { setNotionTest('✗ request failed'); }
    setTimeout(() => setNotionTest(null), 4000);
  }

  const fields = FIELDS[activeTab] ?? [];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="settings" accent={accent}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {['Accounts', 'Notion'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === tab ? accent : T.textDim, fontSize: 11,
              borderBottom: activeTab === tab ? `2px solid ${accent}` : '2px solid transparent',
              fontFamily: 'inherit',
            }}>{tab}</button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          {fields.map(f => {
            if (f.type === 'section') return (
              <div key={f.key} style={{ fontSize: 9, letterSpacing: '.1em', color: T.textGhost, marginTop: 20, marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                {f.label.toUpperCase()}
              </div>
            );
            return <SecretField key={f.key} field={f} value={values[f.key] ?? ''} onChange={handleChange} />;
          })}
          {activeTab === 'Notion' && (
            <div style={{ marginTop: 8 }}>
              <button onClick={handleTestNotion} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: 'pointer', fontSize: 10.5, padding: '5px 12px', fontFamily: 'inherit' }}>
                Test Notion Connection
              </button>
              {notionTest && <span style={{ marginLeft: 10, fontSize: 10.5, color: notionTest.startsWith('✓') ? T.accent : T.danger }}>{notionTest}</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '10px 20px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          {saveStatus && <span style={{ fontSize: 10.5, color: saveStatus === 'error' ? T.danger : T.textDim }}>{saveStatus}</span>}
          <button onClick={handleSave} style={{ background: T.bg3, border: `1px solid ${T.borderHi}`, borderRadius: 3, color: accent, cursor: 'pointer', fontSize: 11, padding: '5px 16px', fontFamily: 'inherit' }}>
            Save
          </button>
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/SettingsPage.jsx
git commit -m "feat(mc): add SettingsPage — dark port with two tabs and Notion test"
```

---

## Task 12: GoalsPage — stub

**Files:**
- Create: `client/src/mission-control/pages/GoalsPage.jsx`

- [ ] **Step 1: Create GoalsPage.jsx**

```jsx
import React from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';

export function GoalsPage({ accent }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="life_goals" accent={accent}>
        <div style={{ padding: '16px 14px', fontSize: 11.5, color: T.textGhost }}>
          coming soon
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mission-control/pages/GoalsPage.jsx
git commit -m "feat(mc): add GoalsPage stub"
```

---

## Spec Self-Review

**Spec coverage:**
- Three-row TopBar with brand+status / pivots / modules hierarchy: Task 1
- Status dots (ms, gmail) absorbed from StatusLine into TopBar Row 1: Task 1
- StatusLine removed from App.jsx render: Task 2
- URL-based pivot routing, remove pivot useState: Task 2
- /ask palette command → /claude?q=: Task 2
- Routes for all module pages: Task 2
- TaskList toggle/delete (optimistic) + title-click navigate: Task 3
- No Date group included in Today panel (duePriority 4, sorted last): Task 3
- Done group hidden in Today panel; only shown in NotesPage with toggle: Tasks 3 + 5
- Panel click-throughs (view →) for all 5 Today panels: Task 4
- NotesPage: daily note autosave (1.5s debounce + on blur) + task CRUD groups: Task 5
- CalendarPage: [/]/t keyboard, 06:00-22:00 hour grid, event inline expand: Task 6
- ClaudePage: SSE, ?q= param auto-submit, ↑↓ history, Ctrl+C abort, Notion save: Task 7
- BriefPage: section cards, SSE refresh, loading skeleton, 2-col grid: Task 8
- SlackPage: dark, SSE, channel blacklist: Task 9
- EmailPage: dark, SSE, dual-account section cards: Task 10
- SettingsPage: dark, two tabs (Accounts/Notion), Notion test, save bar: Task 11
- GoalsPage: stub, no content beyond "coming soon": Task 12

**Placeholder scan:** All steps have complete code. No TBD or "similar to" references.

**Type consistency:** All page files export named exports matching imports in App.jsx. `accent` prop passed to every page. `useNavigate` used in TaskList and TodayView (both rendered inside BrowserRouter). `T.accent` referenced in ClaudePage header — T is imported from theme.js in every file. `T.borderHi` used in TopBar and SettingsPage — exists in theme.js.
