# Spec C — Microsoft Bearer Token Design

## Overview

Replace the MSAL/Azure AD OAuth flow in `outlook.js` with a simple bearer token approach. User pastes a token obtained from Microsoft Graph Explorer into Settings. The app uses it directly for Graph API calls. Token expiry is detected and surfaced as an inline banner on affected pages.

---

## Server Changes

### `server/services/outlook.js`

**Remove entirely:**
- `@azure/msal-node` import and all MSAL usage
- `getMSGraphConfig()`, `getMsalApp()`, `getMSAuthUrl()`, `handleMSCallback()`
- `acquireTokenSilent` logic

**Keep/simplify:**
- `isMSConnected()` — checks if `ms-token.json` exists and has a non-empty token
- `getMSAccessToken()` — reads `ms-token.json`, returns `{ token, savedAt }`. Throws `MS_TOKEN_EXPIRED` error if token is older than 60 minutes.

**Token file shape** (`ms-token.json`):
```json
{ "token": "eyJ0eXAiOiJKV1Qi...", "savedAt": "2026-04-27T14:32:00.000Z" }
```

**Error codes:**
- `MS_NOT_CONNECTED` — file missing or token empty
- `MS_TOKEN_EXPIRED` — token older than 60 minutes

Both `fetchUnreadOutlookEmails` and `getMSEvents` (in `calendar.js`) catch these error codes and return `[]` with a structured error payload rather than throwing.

### New routes in `server/routes/settings.js` (or inline in existing auth route)

**`POST /api/settings/ms-token`**
Body: `{ token: string }`
Writes to `ms-token.json`. Returns `{ ok: true, savedAt }`.

**`GET /api/settings/ms-token/status`**
Returns:
```json
{ "set": true, "ageMinutes": 23, "expired": false }
```

### `server/routes/auth.js`

Remove Microsoft OAuth callback route (`/api/auth/microsoft/callback`) and auth URL route. These are no longer needed.

---

## Client Changes

### `SettingsPage.jsx` — Accounts tab, Microsoft section

```
MICROSOFT (OFFICE)
Calendar and email data — paste a bearer token from Graph Explorer. Lasts ~1 hour.

[eyJ0eXAiOiJKV1Qi………bXVl    ] [clear]
● token set · 23 min ago               Get token from Graph Explorer →
```

- Input: `type="password"` masked field, shows last 8 chars of stored token as placeholder when set
- `clear` button removes the token
- Status line: `● token set · N min ago` (green accent) / `⚠ expires soon` (warn, >50min) / `✕ not set` (textGhost)
- `Get token from Graph Explorer →` opens `https://developer.microsoft.com/en-us/graph/graph-explorer` in a new tab
- Saving the token calls `POST /api/settings/ms-token`

### Calendar and Email pages — expiry banner

When a Graph call returns an `MS_TOKEN_EXPIRED` or `MS_NOT_CONNECTED` error, a dismissible amber banner renders at the top of the page:

```
⚠  Microsoft token expired — office calendar unavailable    [Get new token →]  ✕
```

- `Get new token →` opens Graph Explorer in a new tab
- `✕` dismisses for the session
- Page continues rendering Google-only data below the banner

---

## What Does Not Change

- `fetchUnreadOutlookEmails` and `getMSEvents` function signatures — unchanged
- All route files for calendar and email — unchanged
- Google OAuth flow — completely untouched
- `ms-token.json` filename — kept (different shape, same location)

---

## Success Criteria

1. Pasting a valid token in Settings enables office calendar + email immediately
2. Status line shows correct age and expiry warning
3. Expired token shows amber banner on Calendar and Email pages
4. Google-only data still renders correctly when MS token is missing
5. No Azure app registration or MSAL dependency in the codebase
