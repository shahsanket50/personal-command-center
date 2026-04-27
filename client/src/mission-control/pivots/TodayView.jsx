import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.jsx';
import { Panel } from '../components/Panel.jsx';
import { Schedule } from '../panels/Schedule.jsx';
import { TaskList } from '../panels/TaskList.jsx';
import { Brief } from '../panels/Brief.jsx';
import { TriageStream } from '../panels/TriageStream.jsx';
import { PeoplePanel } from '../panels/PeoplePanel.jsx';

function ViewLink({ to }) {
  const T = useTheme();
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      onMouseDown={e => e.preventDefault()}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: T.textDim, fontSize: 11.5, fontFamily: 'inherit', padding: 0,
      }}
    >
      view →
    </button>
  );
}

export function TodayView({ panelFocus, cursors, triageFilter, setTriageFilter, onTasksLoaded, onTriageLoaded, onPeopleLoaded }) {
  const T = useTheme();
  return (
    <div style={{
      flex: 1, display: 'grid',
      gridTemplateColumns: '320px 1fr 280px',
      gridTemplateRows: '1fr 1fr',
      gap: 1, background: T.border, overflow: 'hidden', minHeight: 0,
    }}>
      <Panel title="schedule_today" hint="g c" right={<ViewLink to="/calendar" />} focused={panelFocus === 'schedule'} style={{ gridArea: '1 / 1 / 3 / 2' }}>
        <Schedule />
      </Panel>

      <Panel title="action_queue" hint="g a" right={<ViewLink to="/notes" />} focused={panelFocus === 'tasks'}>
        <TaskList focused={panelFocus === 'tasks'} cursor={cursors.tasks} onLoaded={onTasksLoaded} />
      </Panel>

      <Panel title="triage" hint="g i" right={<ViewLink to="/triage" />} focused={panelFocus === 'triage'}>
        <TriageStream focused={panelFocus === 'triage'} cursor={cursors.triage} filter={triageFilter} setFilter={setTriageFilter} compact onLoaded={onTriageLoaded} />
      </Panel>

      <Panel title="morning_brief" hint="g b" right={<ViewLink to="/brief" />} focused={panelFocus === 'brief'}>
        <Brief />
      </Panel>

      <Panel title="people" hint="g p" right={<ViewLink to="/people" />} focused={panelFocus === 'people'}>
        <PeoplePanel focused={panelFocus === 'people'} cursor={cursors.people} onLoaded={onPeopleLoaded} />
      </Panel>
    </div>
  );
}
