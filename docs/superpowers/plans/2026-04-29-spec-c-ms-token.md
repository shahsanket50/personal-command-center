# Spec C — Microsoft Bearer Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MSAL/Azure AD OAuth flow with a simple bearer token approach — user pastes a token from Graph Explorer into Settings, app uses it for all Microsoft Graph calls, surfaces a banner when the token is expired.

**Architecture:** Strip MSAL from `outlook.js`, store raw token in `ms-token.json`. New `POST /api/settings/ms-token` route saves the token. `getMSAccessToken()` reads the file and checks age (warn >50min, error >60min). Calendar and Email pages show an amber banner when the token is missing or expired, with a direct link to Graph Explorer.

**Tech Stack:** Express (existing), React (existing), `useTheme()` hook (existing)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/services/outlook.js` | Modify | Remove MSAL, simplify to raw token read/write |
| `server/routes/settings.js` | Create | `POST /api/settings/ms-token`, `GET /api/settings/ms-token/status` |
| `server/index.js` | Modify | Register `/api/settings` route |
| `client/src/mission-control/pages/SettingsPage.jsx` | Modify | Add MS token field to Accounts tab |
| `client/src/mission-control/pages/CalendarPage.jsx` | Modify | Add MS token expiry banner |
| `client/src/mission-control/pages/EmailPage.jsx` | Modify | Add MS token expiry banner |

---

## Task 1: Simplify outlook.js — remove MSAL, use raw bearer token

**Files:**
- Modify: `server/services/outlook.js`

**Context:** Current `outlook.js` imports `ConfidentialClientApplication` from `@azure/msal-node` and implements a full OAuth2 PKCE flow. All of that gets removed. The new file stores only the raw token string + `savedAt` timestamp in `ms-token.json`. Error codes `MS_NOT_CONNECTED` and `MS_TOKEN_EXPIRED` are thrown as `Error` objects with those strings as the message so callers can detect them.

- [ ] **Step 1: Replace server/services/outlook.js entirely**

```js
// Microsoft Graph service — bearer token auth (no Azure AD app registration required)
// User obtains token from Graph Explorer and pastes into Settings.
// Token stored in ms-token.json: { token: string, savedAt: ISO string }

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MS_TOKEN_PATH = path.resolve(__dirname, '../../ms-token.json');

export async function saveMSToken(token) {
  await writeFile(MS_TOKEN_PATH, JSON.stringify({ token, savedAt: new Date().toISOString() }, null, 2));
}

export async function getMSTokenStatus() {
  try {
    const raw = await readFile(MS_TOKEN_PATH, 'utf8');
    const { token, savedAt } = JSON.parse(raw);
    if (!token) return { set: false, ageMinutes: 0, expired: true };
    const ageMinutes = Math.floor((Date.now() - new Date(savedAt).getTime()) / 60000);
    return { set: true, ageMinutes, expired: ageMinutes >= 60 };
  } catch {
    return { set: false, ageMinutes: 0, expired: true };
  }
}

export async function isMSConnected() {
  const { set } = await getMSTokenStatus();
  return set;
}

export async function getMSAccessToken() {
  let cached;
  try {
    const raw = await readFile(MS_TOKEN_PATH, 'utf8');
    cached = JSON.parse(raw);
  } catch {
    throw new Error('MS_NOT_CONNECTED');
  }

  if (!cached.token) throw new Error('MS_NOT_CONNECTED');

  const ageMinutes = Math.floor((Date.now() - new Date(cached.savedAt).getTime()) / 60000);
  if (ageMinutes >= 60) throw new Error('MS_TOKEN_EXPIRED');

  return cached.token;
}

export async function fetchUnreadOutlookEmails({ maxResults = 30 } = {}) {
  const accessToken = await getMSAccessToken();

  const url =
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages` +
    `?$filter=isRead%20eq%20false` +
    `&$select=subject,from,receivedDateTime,bodyPreview` +
    `&$orderby=receivedDateTime%20desc` +
    `&$top=${maxResults}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (res.status === 401) throw new Error('MS_TOKEN_EXPIRED');
  if (!res.ok) throw new Error(`Microsoft Graph mail fetch failed (${res.status})`);

  const data = await res.json();
  return (data.value || []).map(msg => ({
    id: msg.id,
    subject: msg.subject || '(no subject)',
    from: msg.from?.emailAddress?.address || 'unknown',
    date: msg.receivedDateTime || '',
    snippet: msg.bodyPreview || '',
    account: 'office',
    source: 'Outlook',
  }));
}
```

- [ ] **Step 2: Update calendar.js to handle new error codes**

In `server/services/calendar.js`, find `getMSEvents` and update the catch block to handle the new error codes:

```js
export async function getMSEvents(dateStr) {
  let accessToken;
  try {
    accessToken = await getMSAccessToken();
  } catch (e) {
    // MS_NOT_CONNECTED or MS_TOKEN_EXPIRED — return empty silently
    return [];
  }
  // ... rest unchanged
```

- [ ] **Step 3: Verify server still starts**

```bash
cd server && npm run dev
# Expected: server starts on port 3001 with no import errors
```

- [ ] **Step 4: Commit**

```bash
git add server/services/outlook.js server/services/calendar.js
git commit -m "feat(ms-token): replace MSAL with raw bearer token in outlook.js"
```

---

## Task 2: Create settings route

**Files:**
- Create: `server/routes/settings.js`

- [ ] **Step 1: Create the file**

```js
import { Router } from 'express';
import { saveMSToken, getMSTokenStatus } from '../services/outlook.js';

const router = Router();

// POST /api/settings/ms-token — save a new bearer token
router.post('/ms-token', async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token is required' });
  }
  try {
    await saveMSToken(token.trim());
    const status = await getMSTokenStatus();
    res.json({ ok: true, ...status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/settings/ms-token — clear the token
router.delete('/ms-token', async (_req, res) => {
  try {
    await saveMSToken('');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings/ms-token/status — check token age and validity
router.get('/ms-token/status', async (_req, res) => {
  try {
    const status = await getMSTokenStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
```

- [ ] **Step 2: Register in server/index.js**

Add after the existing route imports:
```js
import settingsRoutes from './routes/settings.js';
```

Add after the last `app.use('/api/...')` line:
```js
app.use('/api/settings', settingsRoutes);
```

- [ ] **Step 3: Test the endpoints**

```bash
# Save a token
curl -X POST http://localhost:3001/api/settings/ms-token \
  -H "Content-Type: application/json" \
  -d '{"token":"test-token-123"}'
# Expected: { ok: true, set: true, ageMinutes: 0, expired: false }

# Check status
curl http://localhost:3001/api/settings/ms-token/status
# Expected: { set: true, ageMinutes: 0, expired: false }

# Clear token
curl -X DELETE http://localhost:3001/api/settings/ms-token
# Expected: { ok: true }
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/settings.js server/index.js
git commit -m "feat(ms-token): add settings routes for MS bearer token CRUD"
```

---

## Task 3: Update SettingsPage with MS token field

**Files:**
- Modify: `client/src/mission-control/pages/SettingsPage.jsx`

**Context:** SettingsPage has an Accounts tab with sections for different integrations. Find the Microsoft section (look for `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID` fields) and replace it with the new bearer token UI. The token input is type `password`. Status is fetched from `GET /api/settings/ms-token/status` on mount.

- [ ] **Step 1: Add MS token state and fetch to SettingsPage**

Locate the `SettingsPage` function. Add these state variables near the top (after existing `useState` declarations):

```jsx
const [msToken, setMsToken] = useState('');
const [msTokenStatus, setMsTokenStatus] = useState(null); // { set, ageMinutes, expired }
```

Add this `useEffect` alongside existing ones:

```jsx
useEffect(() => {
  fetch(`${API}/settings/ms-token/status`)
    .then(r => r.ok ? r.json() : null)
    .then(setMsTokenStatus)
    .catch(() => {});
}, []);
```

Add save and clear handlers:

```jsx
async function saveMsToken() {
  if (!msToken.trim()) return;
  try {
    const res = await fetch(`${API}/settings/ms-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: msToken.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setMsTokenStatus(data);
      setMsToken('');
    }
  } catch { /* ignore */ }
}

async function clearMsToken() {
  await fetch(`${API}/settings/ms-token`, { method: 'DELETE' });
  setMsTokenStatus({ set: false, ageMinutes: 0, expired: true });
  setMsToken('');
}
```

- [ ] **Step 2: Replace the Microsoft fields in the Accounts tab JSX**

Find the section rendering `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID` secret fields. Replace it with:

```jsx
{/* Microsoft Office */}
<div style={{ marginBottom: 20 }}>
  <div style={{ fontSize: 11, letterSpacing: '.1em', color: T.textGhost, marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
    MICROSOFT (OFFICE)
  </div>
  <div style={{ fontSize: 12, color: T.textDim, marginBottom: 8 }}>
    Calendar and email — paste a bearer token from Graph Explorer. Lasts ~1 hour.
  </div>
  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
    <input
      type="password"
      value={msToken}
      onChange={e => setMsToken(e.target.value)}
      placeholder={msTokenStatus?.set ? '••••••••' : 'paste token here…'}
      style={{ flex: 1, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 3, color: T.text, fontSize: 12, padding: '5px 8px', outline: 'none', fontFamily: 'inherit' }}
      onKeyDown={e => e.key === 'Enter' && saveMsToken()}
    />
    <button onClick={saveMsToken} disabled={!msToken.trim()} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 3, color: T.accent, cursor: 'pointer', fontSize: 12, padding: '4px 10px', opacity: msToken.trim() ? 1 : 0.4 }}>
      save
    </button>
    {msTokenStatus?.set && (
      <button onClick={clearMsToken} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: 'pointer', fontSize: 12, padding: '4px 10px' }}>
        clear
      </button>
    )}
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: 11, color: msTokenStatus?.expired ? T.warn : msTokenStatus?.set ? T.accent : T.textGhost }}>
      {!msTokenStatus?.set
        ? '✕ not set'
        : msTokenStatus.expired
          ? '⚠ expired — paste a new token'
          : msTokenStatus.ageMinutes > 50
            ? `⚠ expires soon · ${msTokenStatus.ageMinutes} min ago`
            : `● set · ${msTokenStatus.ageMinutes} min ago`
      }
    </span>
    <a
      href="https://developer.microsoft.com/en-us/graph/graph-explorer"
      target="_blank"
      rel="noreferrer"
      style={{ fontSize: 11, color: T.accent, textDecoration: 'none' }}
    >
      Get token from Graph Explorer →
    </a>
  </div>
</div>
```

- [ ] **Step 3: Remove MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID from the NOTION/env fields list**

Find wherever these three env vars are rendered as `SecretField` components and remove them. They are no longer needed.

- [ ] **Step 4: Verify in browser**

Navigate to `/settings` → Accounts tab. Verify:
- MS token field renders below Google section
- Pasting and saving a token shows "● set · 0 min ago"
- "Get token from Graph Explorer →" opens Graph Explorer in new tab
- Clear button removes the token, status shows "✕ not set"

- [ ] **Step 5: Commit**

```bash
git add client/src/mission-control/pages/SettingsPage.jsx
git commit -m "feat(ms-token): add bearer token field to SettingsPage Accounts tab"
```

---

## Task 4: Add MS token expiry banner to CalendarPage and EmailPage

**Files:**
- Modify: `client/src/mission-control/pages/CalendarPage.jsx`
- Modify: `client/src/mission-control/pages/EmailPage.jsx`

**Context:** When `GET /api/calendar/events` or `GET /api/email/digest/generate` fails or returns an MS error, show an amber banner at the top. The banner has a "Get new token →" link and a dismiss button.

- [ ] **Step 1: Create a shared MsTokenBanner component inline in CalendarPage.jsx**

Add above the `CalendarPage` function:

```jsx
function MsTokenBanner({ onDismiss }) {
  const T = useTheme();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', background: '#1a0e00',
      border: `1px solid ${T.warn}`, borderRadius: 4, margin: '8px 12px',
      fontSize: 12, flexShrink: 0,
    }}>
      <span style={{ color: T.warn }}>⚠</span>
      <span style={{ color: T.warn, flex: 1 }}>Microsoft token expired — office calendar unavailable</span>
      <a
        href="https://developer.microsoft.com/en-us/graph/graph-explorer"
        target="_blank"
        rel="noreferrer"
        style={{ color: T.accent, textDecoration: 'none', fontSize: 12 }}
      >
        Get new token →
      </a>
      <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', color: T.textGhost, cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✕</button>
    </div>
  );
}
```

- [ ] **Step 2: Add banner state and detection to CalendarPage**

Add state: `const [showMsBanner, setShowMsBanner] = useState(false);`

In the calendar fetch function, detect when MS events fail. Find where `getMergedEvents` (or the client-side `/api/calendar/events`) is called. After the fetch, check the response for an `msError` field:

```jsx
// In the fetch useEffect or function that calls /api/calendar/events:
const data = await res.json();
if (data.msError) setShowMsBanner(true);
// continue rendering with whatever events are returned
```

- [ ] **Step 3: Render banner in CalendarPage JSX**

In the return JSX, add the banner just inside the outer container, before the main content:

```jsx
{showMsBanner && <MsTokenBanner onDismiss={() => setShowMsBanner(false)} />}
```

- [ ] **Step 4: Update calendar route to return msError flag**

In `server/routes/calendar.js` (or wherever calendar events are served), catch the MS error and include it in the response:

```js
// In GET /api/calendar/events (or similar):
let msEvents = [];
let msError = false;
try {
  msEvents = await getMSEvents(dateStr);
} catch (e) {
  if (e.message === 'MS_TOKEN_EXPIRED' || e.message === 'MS_NOT_CONNECTED') {
    msError = true;
  } else {
    throw e;
  }
}
// merge with Google events and return:
res.json({ events: [...googleEvents, ...msEvents], msError });
```

- [ ] **Step 5: Repeat for EmailPage.jsx**

Apply the same `MsTokenBanner` component and `showMsBanner` state pattern to `EmailPage.jsx`. In EmailPage, set `showMsBanner = true` when the email digest response contains `msError: true` or when the generate SSE stream returns `{ error: 'MS_TOKEN_EXPIRED' }`.

- [ ] **Step 6: Verify in browser**

With no MS token set:
- Open `/calendar` — amber banner appears, "office calendar unavailable", rest of calendar shows Google events
- Open `/email` — amber banner appears
- Click "Get new token →" — Graph Explorer opens in new tab
- Click ✕ — banner dismisses

With a valid token set in Settings:
- Banner does not appear
- Office calendar events and email data load normally

- [ ] **Step 7: Commit**

```bash
git add client/src/mission-control/pages/CalendarPage.jsx client/src/mission-control/pages/EmailPage.jsx server/routes/calendar.js
git commit -m "feat(ms-token): add MS token expiry banner to Calendar and Email pages"
```

---

## Task 5: End-to-end verification + CLAUDE.md

- [ ] **Step 1: Full flow test**

1. Settings → Accounts: paste a fake token → status shows "● set · 0 min ago"
2. Settings → clear token → status shows "✕ not set"
3. Calendar page → amber banner appears
4. Get real token from Graph Explorer → paste in Settings → calendar and email load office data
5. Server restarts without losing token (token persists in ms-token.json)

- [ ] **Step 2: Update CLAUDE.md build status**

Change `Next: Spec C — Microsoft bearer token.` to:
```
Spec C complete — Microsoft Graph auth replaced with bearer token flow; Settings token field with Graph Explorer link; expiry banner on Calendar/Email pages.
Next: Spec D1 — Electron menubar app + Docker Compose.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: update CLAUDE.md — Spec C complete"
```
