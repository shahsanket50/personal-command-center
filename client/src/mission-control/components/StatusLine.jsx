import React, { useState, useEffect } from 'react';
import { T } from '../theme.js';

const API = 'http://localhost:3001/api';

export function StatusLine({ accent }) {
  const [status, setStatus] = useState({ google: null, microsoft: null, gmail: null });

  useEffect(() => {
    Promise.allSettled([
      fetch(`${API}/calendar/status`).then(r => r.json()),
      fetch(`${API}/email/status`).then(r => r.json()),
    ]).then(([calRes, emailRes]) => {
      const cal = calRes.status === 'fulfilled' ? calRes.value : {};
      const email = emailRes.status === 'fulfilled' ? emailRes.value : {};
      setStatus({ google: cal.google ?? false, microsoft: cal.microsoft ?? false, gmail: email.gmail ?? false });
    });
  }, []);

  const Dot = ({ v, label }) => (
    <span>
      {label}{' '}
      {v === null
        ? <span style={{ color: T.textGhost }}>…</span>
        : v
          ? <span style={{ color: accent }}>ok</span>
          : <span style={{ color: T.danger }}>disconnected</span>}
    </span>
  );

  return (
    <div style={{
      display: 'flex', gap: 18, padding: '4px 14px', alignItems: 'center',
      fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
      fontSize: 10.5, color: T.textFaint, background: T.bg0,
      borderBottom: `1px solid ${T.border}`, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <span style={{ color: accent }}>● connected</span>
      <Dot v={status.microsoft} label="ms-graph" />
      <Dot v={status.gmail} label="gmail" />
      <span style={{ color: T.textGhost }}>·</span>
      <div style={{ flex: 1 }} />
      <span>uptime ok</span>
    </div>
  );
}
