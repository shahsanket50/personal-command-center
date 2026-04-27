import React from 'react';
import { useTheme } from '../ThemeContext.jsx';

export function Panel({ title, hint, right, focused, children, style }) {
  const T = useTheme();
  return (
    <div style={{
      background: T.bg2,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden',
      borderLeft: focused ? `2px solid ${T.accent}` : '2px solid transparent',
      ...style,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 11px',
        borderBottom: `1px solid ${T.border}`,
        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
        fontSize: 14.5,
        color: focused ? T.accent : T.textDim,
        background: T.bg1,
        flexShrink: 0,
      }}>
        <span style={{ color: T.textGhost }}>$</span>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {hint && <code style={{ color: T.textGhost, marginLeft: 'auto', fontSize: 16 }}>{hint}</code>}
        {right && (
          <span style={{ marginLeft: hint ? 12 : 'auto', fontSize: 16, color: T.textDim }}>
            {right}
          </span>
        )}
      </div>
      <div className="mc-scroll" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
