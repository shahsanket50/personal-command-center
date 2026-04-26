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

  const HOURS = Array.from({ length: 17 }, (_, i) => 6 + i);
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
          {frac >= 0 && frac <= HOURS.length && (
            <div style={{ position: 'absolute', left: 54, right: 12, top: `${(frac / HOURS.length) * 100}%`, height: 1, background: '#10b981', boxShadow: '0 0 6px #10b981', zIndex: 2, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', left: -4, top: -3, width: 7, height: 7, borderRadius: 4, background: '#10b981' }} />
            </div>
          )}
          {HOURS.map((h, i) => {
            const hourEvents = events.filter(ev => {
              return ev.start && new Date(ev.start).getHours() === h;
            });
            return (
              <div key={h} style={{ display: 'flex', gap: 10, minHeight: 52, borderTop: i === 0 ? 'none' : `1px solid ${T.bg4}`, paddingTop: 4, position: 'relative', alignItems: 'flex-start' }}>
                <div style={{ color: T.textGhost, minWidth: 42, fontSize: 10.5 }}>{String(h).padStart(2,'0')}:00</div>
                <div style={{ flex: 1 }}>
                  {hourEvents.map((ev, j) => {
                    const now = new Date();
                    const start = new Date(ev.start);
                    const end   = new Date(ev.end);
                    const isPast = end < now;
                    const isNow  = start <= now && now < end;
                    const tagColor = ev.source === 'personal' ? '#10b981' : isNow ? accent : T.info;
                    const startLabel = ev.start ? new Date(ev.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                    const isExpanded = expanded === (ev.id ?? j);
                    return (
                      <div
                        key={ev.id ?? j}
                        onClick={() => setExpanded(isExpanded ? null : (ev.id ?? j))}
                        style={{ padding: '3px 8px', background: isNow ? T.bg4 : T.bg3, borderLeft: `2px solid ${tagColor}`, fontSize: 11, color: isPast ? T.textGhost : isNow ? T.textHi : T.text, borderRadius: 2, marginBottom: 3, cursor: 'pointer', textDecoration: isPast ? 'line-through' : 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: T.textGhost, fontSize: 10, minWidth: 36 }}>{startLabel}</span>
                          {isNow && <span style={{ color: '#10b981' }}>●</span>}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(ev.summary ?? '(no title)').toLowerCase()}</span>
                          {ev.attendeeCount > 0 && <span style={{ color: T.textGhost, fontSize: 10 }}>{ev.attendeeCount}p</span>}
                          <span style={{ color: T.textGhost, fontSize: 9, flexShrink: 0 }}>{ev.source}</span>
                        </div>
                        {isExpanded && (
                          <div style={{ marginTop: 4, color: T.textDim, fontSize: 10.5, lineHeight: 1.5 }}>
                            {ev.location && <div>loc: {ev.location}</div>}
                            {ev.attendeeCount > 0 && <div>{ev.attendeeCount} attendees</div>}
                            {start && end && <div>{startLabel} – {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>}
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
