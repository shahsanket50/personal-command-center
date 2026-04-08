import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Calendar as CalIcon, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const API = 'http://localhost:3001/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`); // noon to avoid DST edge cases
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatTime(isoStr, allDay) {
  if (allDay) return 'All day';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(start, end, allDay) {
  if (allDay) return 'All day';
  return `${formatTime(start, false)} – ${formatTime(end, false)}`;
}

/** Returns true if dateStr falls within a travel entry's date range. */
function isOOO(dateStr, travelEntries) {
  return travelEntries.some((entry) => {
    if (!entry.startDate) return false;
    const end = entry.endDate ?? entry.startDate;
    return dateStr >= entry.startDate && dateStr <= end;
  });
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, ooo, theme }) {
  const isOffice = event.source === 'office';

  return (
    <div className={clsx('rounded-lg border p-3 mb-2', theme.card)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={clsx(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                isOffice
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              )}
            >
              {isOffice ? 'Office' : 'Personal'}
            </span>
            {ooo && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} />
                OOO
              </span>
            )}
          </div>
          <p className={clsx('mt-1 text-sm font-medium', theme.heading)}>{event.title}</p>
          <p className={clsx('text-xs mt-0.5', theme.subheading)}>
            {formatDuration(event.start, event.end, event.allDay)}
          </p>
          {event.location && (
            <p className={clsx('flex items-center gap-1 text-xs mt-1', theme.subheading)}>
              <MapPin size={11} />
              {event.location}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Connect prompt ───────────────────────────────────────────────────────────

function ConnectPrompt({ label, href, connected, color, theme }) {
  if (connected) return null;
  return (
    <a
      href={href}
      className={clsx(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors',
        color === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
          : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
      )}
    >
      <ExternalLink size={14} />
      Connect {label}
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarModule({ theme }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  const [status, setStatus] = useState({ google: false, microsoft: false });
  const [travelEntries, setTravelEntries] = useState([]);

  const [authMsg, setAuthMsg] = useState(null); // success/error toast from OAuth redirect

  // Handle ?auth= param from OAuth redirect
  useEffect(() => {
    const auth = searchParams.get('auth');
    if (!auth) return;
    const messages = {
      google_ok: 'Google Calendar connected.',
      google_error: 'Google Calendar connection failed.',
      ms_ok: 'Microsoft Calendar connected.',
      ms_error: 'Microsoft Calendar connection failed.',
    };
    setAuthMsg({ text: messages[auth] ?? auth, ok: auth.endsWith('_ok') });
    // Clean the URL
    setSearchParams({}, { replace: true });
    setTimeout(() => setAuthMsg(null), 4000);
  }, [searchParams, setSearchParams]);

  // Fetch connection status
  useEffect(() => {
    fetch(`${API}/calendar/status`)
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  }, [authMsg]); // re-check after OAuth redirect

  // Fetch travel entries (for OOO flags)
  useEffect(() => {
    fetch(`${API}/calendar/travel`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTravelEntries(data); })
      .catch(() => {});
  }, []);

  // Fetch events for selected date
  const fetchEvents = useCallback(async (dateStr) => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await fetch(`${API}/calendar/events?date=${dateStr}`);
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
      else setEventsError(data.error ?? 'Failed to load events');
    } catch (e) {
      setEventsError(e.message);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(selectedDate);
  }, [selectedDate, fetchEvents]);

  const navigate = (delta) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toDateStr(d));
  };

  const neitherConnected = !status.google && !status.microsoft;
  const oooToday = isOOO(selectedDate, travelEntries);

  return (
    <div className="flex flex-col h-full px-6 py-6 max-w-3xl mx-auto w-full">
      {/* Auth toast */}
      {authMsg && (
        <div
          className={clsx(
            'mb-4 px-4 py-2.5 rounded-lg text-sm font-medium',
            authMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          )}
        >
          {authMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className={clsx('p-1.5 rounded-md transition-colors', theme.buttonSecondary)}
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1">
          <h1 className={clsx('text-xl font-semibold', theme.heading)}>
            {formatDateLabel(selectedDate)}
          </h1>
          {oooToday && (
            <span className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
              <AlertTriangle size={11} />
              Travel / OOO — check Life &amp; Goals for details
            </span>
          )}
        </div>

        <button
          onClick={() => navigate(1)}
          className={clsx('p-1.5 rounded-md transition-colors', theme.buttonSecondary)}
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={() => setSelectedDate(toDateStr(new Date()))}
          className={clsx('px-3 py-1.5 rounded-md text-sm transition-colors', theme.buttonSecondary)}
        >
          Today
        </button>
      </div>

      {/* Connect prompts */}
      {(!status.google || !status.microsoft) && (
        <div className="flex gap-3 flex-wrap mb-5">
          <ConnectPrompt
            label="Google Calendar"
            href="http://localhost:3001/api/auth/google"
            connected={status.google}
            color="green"
            theme={theme}
          />
          <ConnectPrompt
            label="Microsoft Calendar"
            href="http://localhost:3001/api/auth/microsoft"
            connected={status.microsoft}
            color="blue"
            theme={theme}
          />
        </div>
      )}

      {/* Events */}
      {eventsLoading && <p className={clsx('text-sm', theme.subheading)}>Loading events…</p>}

      {eventsError && (
        <p className="text-sm text-red-500">{eventsError}</p>
      )}

      {!eventsLoading && !eventsError && (
        <>
          {events.length === 0 ? (
            <div className={clsx('flex flex-col items-center justify-center py-16 text-center', theme.subheading)}>
              <CalIcon size={32} className="mb-3 opacity-30" />
              <p className="text-sm">
                {neitherConnected ? 'Connect a calendar above to see events.' : 'No events on this day.'}
              </p>
            </div>
          ) : (
            <div>
              {events.map((event) => (
                <EventCard
                  key={`${event.source}-${event.id}`}
                  event={event}
                  ooo={isOOO(selectedDate, travelEntries)}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
