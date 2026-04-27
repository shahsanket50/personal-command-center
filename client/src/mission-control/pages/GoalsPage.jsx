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
