// Microsoft Graph service — office Outlook email + Outlook Calendar (Phase 3 & 6)
// Auth: Azure AD OAuth2 via MSAL (@azure/msal-node)
// Scope needed: Mail.Read, Calendars.Read, offline_access
// Token stored in ms-token.json (gitignored)

export function getMSGraphConfig() {
  const required = ['MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MS_TENANT_ID'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} is not set`);
  }
  return {
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    tenantId: process.env.MS_TENANT_ID,
    account: process.env.MS_ACCOUNT_OFFICE,
  };
}

// Install when building Phase 3/6:
//   npm install @azure/msal-node @microsoft/microsoft-graph-client
//
// Graph endpoints used:
//   GET /me/messages          — office email (Phase 6)
//   GET /me/events            — Outlook Calendar events (Phase 3)
//   GET /me/calendarView      — calendar range query (Phase 3)
