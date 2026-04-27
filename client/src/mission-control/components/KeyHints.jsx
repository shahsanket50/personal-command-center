import React from 'react';
import { useTheme } from '../ThemeContext.jsx';

export function KeyHints({ pivot, panelFocus }) {
  const T = useTheme();

  const K = ({ children }) => (
    <kbd style={{
      fontSize: 11.5, padding: '1px 4px', borderRadius: 3,
      background: T.bg3, border: `1px solid ${T.border}`,
      color: T.textDim, fontFamily: 'ui-monospace, Menlo, monospace',
    }}>{children}</kbd>
  );

  return (
    <div style={{
      display: 'flex', gap: 13, padding: '5px 14px',
      borderTop: `1px solid ${T.border}`, background: T.bg0,
      fontSize: 12, color: T.textGhost,
      fontFamily: 'ui-monospace, Menlo, monospace',
      flexShrink: 0, alignItems: 'center',
    }}>
      <span><K>j</K>/<K>k</K> nav</span>
      <span><K>tab</K> next pane</span>
      <span><K>x</K> done</span>
      <span><K>r</K> reply</span>
      <span><K>s</K> snooze</span>
      <span><K>g</K><K>t</K>/<K>i</K>/<K>p</K> pivot</span>
      <span><K>⌘k</K> cmd</span>
      <span><K>?</K> all keys</span>
      <div style={{ flex: 1 }} />
      <span style={{ color: T.textFaint }}>
        pivot: <span style={{ color: T.text }}>{pivot}</span>
        {' · '}pane: <span style={{ color: T.text }}>{panelFocus}</span>
      </span>
    </div>
  );
}
