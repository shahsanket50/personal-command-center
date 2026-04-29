// Calendar service — dual source (Phase 3)
//
// Personal calendar: Google Calendar API (googleapis)
//                    Auth: OAuth2, tokens in google-credentials.json
//
// Office calendar:   Microsoft Graph API
//                    Auth: @azure/msal-node, tokens in ms-token.json
//
// Both sources are merged and sorted by start time before returning to client.

import { google } from 'googleapis';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMSAccessToken } from './outlook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOOGLE_TOKEN_PATH = path.resolve(__dirname, '../../google-credentials.json');
const GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';

// ─── Google Calendar ──────────────────────────────────────────────────────────

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set');
  return new google.auth.OAuth2(clientId, clientSecret, GOOGLE_REDIRECT_URI);
}

export function getGoogleAuthUrl() {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/gmail.readonly'],
  });
}

export async function handleGoogleCallback(code) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  await writeFile(GOOGLE_TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

export async function isGoogleConnected() {
  try {
    await readFile(GOOGLE_TOKEN_PATH, 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function getAuthenticatedGoogleClient() {
  const oauth2 = getOAuth2Client();
  let tokens;
  try {
    const raw = await readFile(GOOGLE_TOKEN_PATH, 'utf8');
    tokens = JSON.parse(raw);
  } catch {
    return null; // not connected
  }
  oauth2.setCredentials(tokens);
  // Persist refreshed tokens automatically
  oauth2.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await writeFile(GOOGLE_TOKEN_PATH, JSON.stringify(merged, null, 2)).catch(() => {});
  });
  return oauth2;
}

/**
 * Fetch Google Calendar events for a given date (primary calendar).
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {CalEvent[]}
 */
export async function getGoogleEvents(dateStr) {
  const auth = await getAuthenticatedGoogleClient();
  if (!auth) return [];

  const cal = google.calendar({ version: 'v3', auth });

  // Use local midnight boundaries so all-day events are captured correctly
  const { data } = await cal.events.list({
    calendarId: 'primary',
    timeMin: new Date(`${dateStr}T00:00:00`).toISOString(),
    timeMax: new Date(`${dateStr}T23:59:59`).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (data.items || []).map((e) => ({
    id: e.id,
    title: e.summary ?? '(No title)',
    start: e.start.dateTime ?? e.start.date,
    end: e.end.dateTime ?? e.end.date,
    allDay: !e.start.dateTime,
    source: 'personal',
    location: e.location ?? null,
    attendeeCount: (e.attendees || []).length,
  }));
}

// ─── Microsoft Graph (Outlook Calendar) ──────────────────────────────────────

/**
 * Fetch MS Outlook Calendar events for a given date.
 * MS Graph calendarView returns times in UTC — client handles display conversion.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {CalEvent[]}
 */
export async function getMSEvents(dateStr) {
  let accessToken;
  try {
    accessToken = await getMSAccessToken();
  } catch (e) {
    // MS_NOT_CONNECTED or MS_TOKEN_EXPIRED — return empty silently
    return [];
  }

  const startDateTime = `${dateStr}T00:00:00`;
  const endDateTime = `${dateStr}T23:59:59`;
  const url =
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(startDateTime)}` +
    `&endDateTime=${encodeURIComponent(endDateTime)}` +
    `&$orderby=start/dateTime&$top=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return [];

  const data = await res.json();

  return (data.value || []).map((e) => ({
    id: e.id,
    title: e.subject ?? '(No title)',
    start: e.start.dateTime,
    end: e.end.dateTime,
    allDay: e.isAllDay ?? false,
    source: 'office',
    location: e.location?.displayName ?? null,
    attendeeCount: (e.attendees || []).length,
  }));
}

// ─── Merged events ────────────────────────────────────────────────────────────

/**
 * Fetch and merge events from both calendars for a given date.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {CalEvent[]}
 */
export async function getMergedEvents(dateStr) {
  const [googleEvents, msEvents] = await Promise.all([
    getGoogleEvents(dateStr).catch(() => []),
    getMSEvents(dateStr).catch(() => []),
  ]);

  const all = [...googleEvents, ...msEvents];
  all.sort((a, b) => {
    // All-day events sort to the top
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.start) - new Date(b.start);
  });
  return all;
}

export function getGoogleCalendarConfig() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} is not set`);
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
