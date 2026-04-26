import React, { useState, useMemo, useCallback } from 'react';
import { T, PIVOTS, PIVOT_PANELS } from './mission-control/theme.js';
import { useKeyboard } from './mission-control/useKeyboard.js';
import { TopBar } from './mission-control/components/TopBar.jsx';
import { StatusLine } from './mission-control/components/StatusLine.jsx';
import { KeyHints } from './mission-control/components/KeyHints.jsx';
import { CommandPalette } from './mission-control/components/CommandPalette.jsx';
import { HelpOverlay } from './mission-control/components/HelpOverlay.jsx';
import { TodayView } from './mission-control/pivots/TodayView.jsx';
import { TriageView } from './mission-control/pivots/TriageView.jsx';
import { PeopleView } from './mission-control/pivots/PeopleView.jsx';

const ACCENT = '#86efac';
const API = 'http://localhost:3001/api';
const CURSOR_KEY = { triage: 'triage', tasks: 'tasks', people: 'people' };

export default function App() {
  const [pivot, setPivot] = useState('today');
  const [paneIdx, setPaneIdx] = useState(0);
  const [cursors, setCursors] = useState({ tasks: 0, triage: 0, people: 0 });
  const [triageFilter, setTriageFilter] = useState('all');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);
  const [taskLen, setTaskLen] = useState(0);
  const [triageLen, setTriageLen] = useState(0);
  const [peopleLen, setPeopleLen] = useState(0);

  const panels = PIVOT_PANELS[pivot];
  const panelFocus = panels[paneIdx] ?? panels[0];

  const switchPivot = useCallback((p) => { setPivot(p); setPaneIdx(0); }, []);

  const handleCommand = useCallback(async (cmd, arg) => {
    if (cmd === '/today')  { switchPivot('today');  return { close: true }; }
    if (cmd === '/triage') { switchPivot('triage'); return { close: true }; }
    if (cmd === '/people') { switchPivot('people'); return { close: true }; }

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
  }, [switchPivot]);

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

      if (e.key === 'Tab') {
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
  }), [cmdOpen, helpOpen, gPressed, panelFocus, panels, taskLen, triageLen, peopleLen, switchPivot]);

  useKeyboard(handlers);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: T.bg0, overflow: 'hidden' }}>
      <TopBar pivot={pivot} setPivot={switchPivot} onCmd={() => setCmdOpen(true)} accent={ACCENT} />
      <StatusLine accent={ACCENT} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {pivot === 'today'  && <TodayView panelFocus={panelFocus} cursors={cursors} accent={ACCENT} triageFilter={triageFilter} setTriageFilter={setTriageFilter} onTasksLoaded={(l) => setTaskLen(l.length)} onTriageLoaded={(l) => setTriageLen(l.length)} onPeopleLoaded={(l) => setPeopleLen(l.length)} />}
        {pivot === 'triage' && <TriageView panelFocus={panelFocus} cursors={cursors} accent={ACCENT} filter={triageFilter} setFilter={setTriageFilter} onTriageLoaded={(l) => setTriageLen(l.length)} />}
        {pivot === 'people' && <PeopleView panelFocus={panelFocus} cursors={cursors} accent={ACCENT} onPeopleLoaded={(l) => setPeopleLen(l.length)} />}
      </div>

      <KeyHints pivot={pivot} panelFocus={panelFocus} />

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
