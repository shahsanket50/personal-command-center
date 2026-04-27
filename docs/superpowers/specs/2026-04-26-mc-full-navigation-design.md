# Mission Control — Full Navigation & Module Pages Design

**Date:** 2026-04-26
**Status:** Approved

---

## Goal

Restore feature parity between the old 9-module sidebar app and the new Mission Control interface by adding:
1. A three-row top bar with both MC pivot navigation and module deep-links
2. MC-native full-page views for every module, dark-themed with `T` tokens
3. Task interactivity (toggle/delete) directly in the Today TaskList panel
4. Panel click-throughs from Today pivot to full module pages
5. `/ask` palette command navigates to `/claude` with prompt pre-filled

Old modules in `client/src/modules/` are left in place but no longer routed.
**Backlog (tracked here):** Once all MC pages are stable and verified, remove `client/src/modules/` entirely to clean up dead code.

---

## Navigation Architecture

### Three-Row TopBar

Replaces `client/src/mission-control/components/TopBar.jsx`.

```
┌──────────────────────────────────────────────────────────────────┐
│ MISSION CONTROL            ● gcal  ● ms  ● slack       [⌘K]      │  Row 1 — 28px, bg0
├──────────────────────────────────────────────────────────────────┤
│ Today g t  │  Triage g i  [8]  │  People g p                     │  Row 2 — 30px, bg1
├──────────────────────────────────────────────────────────────────┤
│ Notes · Calendar · Claude · Brief · Slack · Email · Life & Goals  │  Row 3 — 26px, bg2
│                                                    │  Settings ⟶  │
└──────────────────────────────────────────────────────────────────┘
```

- **Row 1**: `MISSION CONTROL` wordmark (accent green) left · connection status dots (gcal, ms, slack — green if connected, `textGhost` if not) + `⌘K` button right
- **Row 2**: Pivot tabs with keyboard hints. Active pivot = accent underline (`borderBottom: 2px solid T.accent`). Background `T.bg1`.
- **Row 3**: Module link tabs. Active route = accent underline. Settings pinned right with `borderLeft: 1px solid T.border`. Background `T.bg2`.

Active state detection: use `useLocation()` from react-router-dom. Row 2 active when path is `/`, `/triage`, `/people`. Row 3 active when path matches module route.

### Routes

Added to `client/src/App.jsx`:

```
/           → Today pivot (unchanged)
/triage     → Triage pivot (unchanged)
/people     → People pivot (unchanged)
/notes      → NotesPage
/calendar   → CalendarPage
/claude     → ClaudePage
/brief      → BriefPage
/slack      → SlackPage
/email      → EmailPage
/goals      → GoalsPage
/settings   → SettingsPage
```

### Panel Click-throughs (Today pivot)

Each panel header gains a `view all →` link (styled `T.textDim`, navigates on click):
- `schedule_today` header → `/calendar`
- `action_queue` header → `/notes`
- `morning_brief` header → `/brief`
- `triage` snapshot panel → `/triage` pivot
- `people` cadence panel → `/people` pivot

Clicking the **title text** of a task row in TaskList navigates to `/notes` (checkbox click = toggle, not navigate).
Clicking a **calendar event row** in Schedule navigates to `/calendar`.

---

## Task Panel Interactivity

`client/src/mission-control/panels/TaskList.jsx` currently read-only. Add inline actions:

- **Toggle complete**: Click checkbox left of task title → PATCH `/api/notes/tasks/:id` `{ status: 'Done' | 'Todo' }`. Optimistic update, revert on error.
- **Delete**: `x` button appears on cursor row (keyboard) or hover (mouse) → PATCH `/api/notes/tasks/:id` `{ status: 'Done' }` (soft delete, matches old module). Remove from local state immediately.
- **No date group**: Add "No Date" group to the Today panel task list (currently filtered out).
- **Done group**: Hidden in the Today panel (panel has limited height). Show/hide Done toggle exists only on `/notes` full page.

---

## MC-Native Module Pages

All new files in `client/src/mission-control/pages/`. All use `T` tokens, `Panel` chrome, inline styles, `JetBrains Mono`. No Tailwind. Old `client/src/modules/` files untouched.

### NotesPage — `/notes`

Two-column layout (`1fr | 1fr`, gap `T.border`):

**Left — Daily Note:**
- Header: `$ daily_note · Mon Apr 26` in Panel chrome
- Full-height `<textarea>` — `background: T.bg1`, `color: T.text`, monospace, `resize: none`
- Autosave: 1.5s debounce on change + on blur. Save status: `saving… / saved / error` in `T.textDim`
- API: GET `/api/notes/today` on mount, PUT `/api/notes/today` on save

**Right — Tasks:**
- Header: Panel chrome `$ tasks [N active] view all →`
- Add form at top: title input + date picker + `+` button → POST `/api/notes/tasks`
- Groups: Overdue (danger) · Today (accent) · Upcoming (textDim) · No Date (textFaint) · Done (collapsed toggle)
- Each row: checkbox (toggle) · title · due date · `×` delete on hover
- API: GET/POST/PATCH `/api/notes/tasks`

### CalendarPage — `/calendar`

- Header: `[` prev · date label · `]` next · `t` today — keyboard shortcuts active (no panel cursor conflict on this page)
- Full-height hour grid (06:00–22:00), NowLine pulse
- Event rows: click to expand inline detail (location, attendees count, source badge office/personal)
- OAuth reconnect prompts if `status.google === false` or `status.microsoft === false`
- API: GET `/api/calendar/events?date=`, GET `/api/calendar/status`

### ClaudePage — `/claude`

- Multi-turn streaming conversation — reuses logic from old `claude-cli/index.jsx`
- Prism syntax highlighting on code blocks
- Command history: ↑↓ in input cycles previous prompts
- Ctrl+C aborts in-flight stream
- Header bar: model name · exchange counter · `Save to Notion` button · `Clear` button
- `/ask <text>` from palette: navigate to `/claude?q=<encoded text>` — on mount, if `?q` param present, pre-fill input and auto-submit
- API: POST `/api/claude/chat` (SSE), POST `/api/claude/save`

### BriefPage — `/brief`

- Full-width card grid (same sections as panel)
- Section icons: ☀ greeting · ◫ meetings · ✓ tasks · ⚑ flags
- Generated-at timestamp below header
- Manual `↺ Refresh` button → POST `/api/brief/generate` SSE
- Loading skeleton: 4 pulsing dark cards
- API: GET `/api/brief/today`, POST `/api/brief/generate`

### SlackPage — `/slack`

- Dark port of existing `client/src/modules/slack/index.jsx`
- Cards → dark panels with `background: T.bg2`, `border: 1px solid T.border`
- Channel blacklist management panel restored: toggle per channel, persists to `.env`
- API: GET `/api/slack/channels`, GET `/api/slack/digest`, POST `/api/slack/digest/generate`, POST `/api/slack/blacklist`

### EmailPage — `/email`

- Dark port of existing `client/src/modules/email/index.jsx`
- Office / Personal section headers with source badges
- API: GET `/api/email/digest`, POST `/api/email/digest/generate`

### SettingsPage — `/settings`

- Two tabs: Accounts · Notion (same fields as old settings module)
- Dark inputs: `background: T.bg2`, `border: 1px solid T.border`, `color: T.text`
- Secret fields: show/hide toggle, `● set` indicator in accent
- Notion connection test button
- Save bar at bottom
- API: GET/POST `/api/settings`, GET `/api/notion/test`

### GoalsPage — `/goals`

Stub page — single line in Panel chrome:
```
$ life_goals   coming soon
```
No empty hero, no placeholder content.

---

## Theme Tokens (reference)

All pages use tokens from `client/src/mission-control/theme.js`:

```js
const T = {
  bg0: '#050709', bg1: '#0a0d12', bg2: '#0d1117',
  bg3: '#11161f', bg4: '#161c26',
  border: '#1f2530', borderHi: '#2a3140',
  text: '#e6e8eb', textHi: '#fff',
  textDim: '#9ba3af', textFaint: '#6b7280',
  textGhost: '#374151',
  accent: '#86efac',
  warn: '#d97706', danger: '#dc2626', info: '#5b5bd6',
};
```

Font: `JetBrains Mono` for all content. Sizes: `9.5–11.5px` for dense content, `13–14px` for inputs and headings.

---

## Files Changed / Created

| File | Action |
|------|--------|
| `client/src/mission-control/components/TopBar.jsx` | Modify — replace with three-row implementation |
| `client/src/App.jsx` | Modify — add 8 new routes |
| `client/src/mission-control/panels/TaskList.jsx` | Modify — add toggle/delete + No Date/Done groups |
| `client/src/mission-control/panels/Schedule.jsx` | Modify — add click-through navigation |
| `client/src/mission-control/panels/Brief.jsx` | Modify — add view-all link in header |
| `client/src/mission-control/panels/TriageStream.jsx` | Modify — add view-all link in header |
| `client/src/mission-control/panels/PeoplePanel.jsx` | Modify — add view-all link in header |
| `client/src/mission-control/pages/NotesPage.jsx` | Create |
| `client/src/mission-control/pages/CalendarPage.jsx` | Create |
| `client/src/mission-control/pages/ClaudePage.jsx` | Create |
| `client/src/mission-control/pages/BriefPage.jsx` | Create |
| `client/src/mission-control/pages/SlackPage.jsx` | Create |
| `client/src/mission-control/pages/EmailPage.jsx` | Create |
| `client/src/mission-control/pages/SettingsPage.jsx` | Create |
| `client/src/mission-control/pages/GoalsPage.jsx` | Create |
| `CLAUDE.md` | Modify — add backlog note + update build status |

---

## Acceptance Criteria

- [ ] Navigating to `/` shows Mission Control with three-row top bar
- [ ] Row 3 module link for active route has accent underline
- [ ] Every module route loads without console errors
- [ ] Task toggle in Today panel and `/notes` page hits the API and updates optimistically
- [ ] Task delete removes row immediately, sends PATCH to API
- [ ] `/notes` note autosaves after 1.5s of inactivity
- [ ] `/calendar` responds to `[` / `]` / `t` keyboard shortcuts
- [ ] `/claude` `/ask?q=` param pre-fills and auto-submits
- [ ] `/settings` loads current env values and saves correctly
- [ ] `/goals` shows stub, no console errors
- [ ] All pages dark — no light backgrounds, no Tailwind theme classes
- [ ] Old `client/src/modules/` files untouched (backlog cleanup deferred)
