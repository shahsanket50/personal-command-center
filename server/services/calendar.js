// Calendar service — dual source (Phase 3)
//
// Office calendar:  Microsoft Graph API (Outlook Calendar)
//                   Uses getMSGraphConfig() from outlook.js
//                   Endpoint: GET /me/calendarView?startDateTime=...&endDateTime=...
//
// Personal calendar: Google Calendar API
//                    Uses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
//                    Endpoint: GET /calendars/primary/events
//
// Both sources are merged and sorted by start time before returning to the client.

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

// Install when building Phase 3:
//   npm install @azure/msal-node @microsoft/microsoft-graph-client googleapis
//
// Google scope needed: https://www.googleapis.com/auth/calendar.readonly
// MS scope needed: Calendars.Read, offline_access
