import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.jsx';

const API = 'http://localhost:3001/api';

function nowFraction() {
  const d = new Date();
  return (d.getHours() - 8) + d.getMinutes() / 60;
}

function NowLine() {
  const frac = nowFraction();
  if (frac < 0 || frac > 10) return null;
  return (
    <div style={{ position: 'absolute', left: 42, right: 10, top: `${(frac / 10) * 100}%`, height: 1, background: '#10b981', boxShadow: '0 0 6px #10b981', zIndex: 2, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: -4, top: -3, width: 7, height: 7, borderRadius: 4, background: '#10b981' }} />
    </div>
  );
}

function EventRow({ ev, onNavigate }) {
  const T = useTheme();
  const now = new Date();
  const start = new Date(ev.start?.dateTime ?? ev.start?.date);
  const end = new Date(ev.end?.dateTime ?? ev.end?.date);
  const isPast = end < now;
  const isNow = start <= now && now < end;
  const tagColor = ev.source === 'personal' ? '#10b981' : isNow ? T.accent : T.info;
  const startLabel = ev.start?.dateTime
    ? new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <div
      onClick={onNavigate}
      style={{
        padding: '2px 7px', background: isNow ? T.bg4 : T.bg3,
        borderLeft: `2px solid ${tagColor}`,
        fontSize: 13, color: isPast ? T.textGhost : isNow ? T.textHi : T.text,
        borderRadius: 2, marginBottom: 2,
        display: 'flex', alignItems: 'center', gap: 6,
        textDecoration: isPast ? 'line-through' : 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: T.textFaint, fontSize: 12, minWidth: 36 }}>{startLabel.replace(':', '')}</span>
      {isNow && <span style={{ color: '#10b981', animation: 'mc-pulse 1.6s infinite' }}>●</span>}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {(ev.summary ?? '(no title)').toLowerCase()}
      </span>
      {ev.attendeeCount > 0 && <span style={{ color: T.textGhost, fontSize: 12 }}>{ev.attendeeCount}p</span>}
    </div>
  );
}

export function Schedule() {
  const T = useTheme();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    fetch(`${API}/calendar/events?date=${today}`)
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : []))
      .catch(() => {});
  }, []);

  const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i);

  return (
    <div style={{ position: 'relative', padding: '4px 10px', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', fontSize: 13 }}>
      {HOURS.map((h, i) => {
        const evs = events.filter((ev) => {
          const s = ev.start?.dateTime ?? ev.start?.date;
          return s && new Date(s).getHours() === h;
        });
        return (
          <div key={h} style={{
            display: 'flex', gap: 8, minHeight: 44,
            borderTop: i === 0 ? 'none' : `1px solid ${T.bg4}`,
            position: 'relative', alignItems: 'flex-start', paddingTop: 4,
          }}>
            <div style={{ color: T.textGhost, minWidth: 32, fontSize: 12.5 }}>{String(h).padStart(2, '0')}:00</div>
            <div style={{ flex: 1 }}>
              {evs.map((ev, j) => <EventRow key={ev.id ?? j} ev={ev} onNavigate={() => navigate('/calendar')} />)}
            </div>
          </div>
        );
      })}
      <NowLine />
    </div>
  );
}
