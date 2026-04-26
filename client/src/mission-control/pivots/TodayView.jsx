import React from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';
import { Schedule } from '../panels/Schedule.jsx';
import { TaskList } from '../panels/TaskList.jsx';
import { Brief } from '../panels/Brief.jsx';
import { TriageStream } from '../panels/TriageStream.jsx';
import { PeoplePanel } from '../panels/PeoplePanel.jsx';

export function TodayView({ panelFocus, cursors, accent, triageFilter, setTriageFilter, onTasksLoaded, onTriageLoaded, onPeopleLoaded }) {
  return (
    <div style={{
      flex: 1, display: 'grid',
      gridTemplateColumns: '320px 1fr 280px',
      gridTemplateRows: '1fr 1fr',
      gap: 1, background: T.border, overflow: 'hidden', minHeight: 0,
    }}>
      <Panel title="schedule_today" hint="g c" focused={panelFocus === 'schedule'} accent={accent} style={{ gridArea: '1 / 1 / 3 / 2' }}>
        <Schedule accent={accent} />
      </Panel>

      <Panel title="action_queue" hint="g a" focused={panelFocus === 'tasks'} accent={accent}>
        <TaskList focused={panelFocus === 'tasks'} cursor={cursors.tasks} accent={accent} onLoaded={onTasksLoaded} />
      </Panel>

      <Panel title="triage" hint="g i" focused={panelFocus === 'triage'} accent={accent}>
        <TriageStream focused={panelFocus === 'triage'} cursor={cursors.triage} accent={accent} filter={triageFilter} setFilter={setTriageFilter} compact onLoaded={onTriageLoaded} />
      </Panel>

      <Panel title="morning_brief" hint="g b" focused={panelFocus === 'brief'} accent={accent}>
        <Brief accent={accent} />
      </Panel>

      <Panel title="people" hint="g p" focused={panelFocus === 'people'} accent={accent}>
        <PeoplePanel focused={panelFocus === 'people'} cursor={cursors.people} accent={accent} onLoaded={onPeopleLoaded} />
      </Panel>
    </div>
  );
}
