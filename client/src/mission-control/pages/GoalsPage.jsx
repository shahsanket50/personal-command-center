import React from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { Panel } from '../components/Panel.jsx';

export function GoalsPage() {
  const T = useTheme();
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="life_goals">
        <div style={{ padding: '16px 14px', fontSize: 13.5, color: T.textGhost }}>
          coming soon
        </div>
      </Panel>
    </div>
  );
}
