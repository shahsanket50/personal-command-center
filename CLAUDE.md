# Personal Command Center

## What this project is
A local Electron app — personal OS for Sanket (Engineering Manager).
Integrates Claude API, Notion, Slack, Outlook/Microsoft 365 (office), Gmail (personal), Outlook Calendar (office), Google Calendar (personal) into one interface.
Notion is the single source of truth — every write goes to Notion first.

## Tech stack
- Frontend: React + Vite, Tailwind CSS, shadcn/ui
- Backend: Node.js + Express (server/ folder)
- AI: Claude API via Anthropic SDK (claude-sonnet-4-5 model)
- Data: Notion API — no local DB, no SQLite
- Packaging: Electron (Phase 7)

## Modules (build order)
0. Settings — accounts, OAuth, Notion config, theme prefs
1. Claude CLI — dark theme, streaming, conversation logs → Notion
2. Notes & Tasks — daily notes + task DB in Notion, due dates, overdue reminders on open
3. Calendar — Microsoft Graph (office Outlook Calendar) + Google Calendar (personal) merged view
4. Morning Brief — generated on app open + manual trigger, written to Notion
5. Slack digest — unread triage, action items → Notion
6. Email triage — Outlook/Microsoft 365 (office) + Gmail (personal), action items → Notion
7. People & 1:1s — per-person notes, feedback, IDP, talking points via Claude
8. Life & goals — habits, books, travel, bookings; cross-refs calendar for OOO flags

## Email & Calendar accounts
- Office: Microsoft 365 — Outlook email + Outlook Calendar via Microsoft Graph API
- Personal: Google — Gmail + Google Calendar via Google APIs
- Always label email/calendar action items with their source account (office vs personal)

## APIs by integration
- Office email + calendar: Microsoft Graph API (`@microsoft/microsoft-graph-client`) with Azure AD OAuth2 (MSAL)
- Personal email: Gmail API (`googleapis`)
- Personal calendar: Google Calendar API (`googleapis`)
- Shared Google OAuth creds cover Gmail + Google Calendar
- Slack: Slack Web API (`@slack/web-api`)
- Notion: Notion SDK (`@notionhq/client`)
- AI: Anthropic SDK (`@anthropic-ai/sdk`)

## Notion databases (all under root page)
- Daily Briefings, Tasks, People, Action Items, Habits & Goals, Travel & Bookings
Database IDs stored in .env after first-run setup.

## Themes
Auto-switches per module — no user override:
- dark: Claude CLI (always, no override)
- clean: Calendar, Notes & Tasks, Settings, People
- cards: Slack, Email, Life & Goals, Morning Brief

`getThemeForModule(module)` in themes/index.js encodes this mapping.
Theme is derived purely from the active route — no global override state.

## Key conventions
- Never store secrets in code — always process.env.*
- .env is gitignored — .env.example is the committed template
- ms-token.json and google-credentials.json are gitignored (OAuth token storage)
- All Notion writes are async with error handling — API rate limit is 3 req/s
- Office account = Microsoft 365 (MS_ACCOUNT_OFFICE); Personal account = Gmail (GMAIL_ACCOUNT_PERSONAL)
- Life & goals data is private — never include in work briefings or Slack context

## Folder structure
client/src/modules/ — one folder per module
client/src/components/ — shared UI
client/src/themes/ — theme configs
server/routes/ — Express routes
server/services/ — notion.js, claude.js, outlook.js, gmail.js, calendar.js, slack.js

## Working conventions
- **Plan first, implement second.** Before writing any code, present a clear plan:
  what files will be created/modified, what the approach is, any tradeoffs or risks.
  Wait for confirmation before implementing.
- **Update CLAUDE.md after every completed phase.** When a phase is done, update
  "Current build status" and commit the file with message: `chore: update CLAUDE.md — phase X complete`
- **Update CLAUDE.md mid-phase if anything architectural changes** — new dependency
  added, folder structure changes, a convention changes. Keep it as the live source
  of truth, not just an end-of-phase update.

## Notion conventions
- Before writing to any Notion database, always inspect actual property names
  and types first using the Notion API (GET /databases/:id)
- Never assume property names match what the code expects — always verify
- When a property mismatch is found, prefer fixing the code to match Notion
  (safer, preserves existing data) over migrating Notion properties (destructive)
- If a schema migration is needed, write a script in scripts/ and wait for
  confirmation before running it
- Keep scripts/inspect-notion-dbs.js in the repo — re-run it any time a
  database schema question comes up

## Current build status
Phase 1 complete — Claude CLI module built (streaming, history, syntax highlighting, Notion save).
Phase 2 complete — Notes & Tasks module (daily notes, task CRUD, overdue banner on app open).
Phase 3 complete — Calendar module (Google Calendar + Microsoft Graph OAuth, merged day view, OOO flags).
Phase 4 complete — Morning Brief (Claude-generated daily summary, SSE streaming, written to Notion, cards theme).
Phase 5 complete — Slack Digest (all joined channels/DMs, Claude triage, channel blacklist, action items → Notion, cards theme).
Phase 6 complete — Email Triage (Gmail + Outlook unread, Claude dual-account summary, action items → Notion, cards theme).
Mission Control revamp complete — 3-pivot keyboard-first terminal interface replacing the 9-module sidebar:
  Today pivot: schedule_today (calendar events + now-line), action_queue (ranked tasks), morning_brief (SSE), triage snapshot, people cadence.
  Triage pivot: unified stream (Slack DMs/mentions, email reply/fyi, cal invites), lane filter chips, focus detail pane, urgent ambient sidebar.
  People pivot: team roster from Notion PEOPLE DB + person detail with cadence status and claude prep.
  Command palette (⌘K): /task, /note, /brief, /today, /triage, /people working end-to-end.
  Keyboard: j/k cursor, Tab pane, g+t/i/p pivot, ? help overlay, ⌘K palette.
  New routes: GET /api/triage/items (Slack+Email+Cal classify), GET /api/people (Notion People DB).
MC Navigation & Module Pages complete — three-row top bar, URL-based pivot routing, 8 MC-native full-page module routes (/notes /calendar /claude /brief /slack /email /settings /goals), task interactivity (toggle/delete) in Today panel TaskList, panel view-all click-throughs.
Font size + theme system complete — 5 named themes (dark/light/paper/ocean/forest), React context via ThemeProvider/useTheme(), Settings Appearance tab with swatch picker, localStorage persistence, +2px font scale across all MC files, accent prop removed from all call sites.
Spec B complete — Brief history sidebar (browse past briefs by date) and Claude session history (load + continue past sessions) added to MC pages.
Spec C complete — Microsoft Graph auth replaced with bearer token flow; Settings token field with Graph Explorer link; expiry banner on Calendar/Email pages.
Spec D1 complete — Electron menubar tray app; docker-compose up one-command setup for local sharing and AWS-ready server container.
Next: Spec D2 — Postgres full migration (replace Notion).

## Backlog (deferred cleanup)
- Remove `client/src/modules/` entirely once all MC pages (`client/src/mission-control/pages/`) are stable and verified. Old modules are no longer routed but kept as reference during the migration.

## Phase 2 & 3 notes
- Daily notes stored in NOTION_DB_DAILY_BRIEFINGS, distinguished by title prefix "Daily Note · YYYY-MM-DD"
- Tasks DB (NOTION_DB_TASKS) expects: Name (title), Status (select: Todo/In Progress/Done), Due Date (date)
- Travel DB (NOTION_DB_TRAVEL_BOOKINGS) expects: Name (title), Start Date (date), End Date (date)
- Google Calendar tokens: google-credentials.json (gitignored), refresh handled via googleapis OAuth2 event
- Microsoft Calendar tokens: ms-token.json (gitignored), refresh via MSAL token cache serialization
- OAuth redirect URIs to register: http://localhost:3001/api/auth/google/callback and http://localhost:3001/api/auth/microsoft/callback
- Server dependencies added: googleapis, @azure/msal-node

## Phase 4 notes
- Brief route: GET /api/brief/today (cached), POST /api/brief/generate (SSE stream)
- Brief generation gathers: overdue tasks, due-today tasks, today's merged calendar events, travel entries
- Travel filtered to entries overlapping today or tomorrow — framed as personal flags only
- Full brief saved to NOTION_DB_DAILY_BRIEFINGS as Notion heading_2 / bulleted_list_item / paragraph blocks
- Title format: "Morning Brief · YYYY-MM-DD"
- Client auto-fetches cached brief on mount; auto-generates if none found for today
- Sections parsed client-side from ## headings; each section rendered as a card (cards theme)
- New Notion helpers: getDueTodayTasks, saveBriefing, getLatestBriefingForDate, briefMarkdownToBlocks, reconstructBriefMarkdown

## Phase 5 notes
- Slack routes: GET /api/slack/channels, GET /api/slack/digest, POST /api/slack/digest/generate (SSE), POST /api/slack/blacklist
- Fetches all joined public/private/MPIM/DM channels; filters blacklisted channels via SLACK_BLACKLIST_CHANNELS env var
- Digest saved to NOTION_DB_DAILY_BRIEFINGS as "Slack Digest · YYYY-MM-DD"; action items ("- [ ]" lines) → NOTION_DB_ACTION_ITEMS (Name only)
- Blacklist persisted to .env on disk via persistEnvVar helper in slack route
- Server dependency added: @slack/web-api
- Google OAuth scope updated to include gmail.readonly (in services/calendar.js)
- Microsoft OAuth scope updated to include Mail.Read (in services/outlook.js); acquireTokenSilent now uses full SCOPES array

## Phase 6 notes
- Email routes: GET /api/email/status, GET /api/email/digest, POST /api/email/digest/generate (SSE)
- Gmail: fetchUnreadGmailEmails in services/gmail.js — reuses google-credentials.json token, mirrors calendar.js refresh pattern
- Outlook: fetchUnreadOutlookEmails in services/outlook.js — raw Graph API fetch (no SDK), Mail.Read scope required
- Re-authorization required for both accounts after scope additions (old tokens lack email scopes)
- Digest saved as "Email Digest · YYYY-MM-DD" in NOTION_DB_DAILY_BRIEFINGS; action items → NOTION_DB_ACTION_ITEMS
- Action Items DB schema: Name (title) only — no Source/Status fields exist in Notion
- New Claude helper: generateMorningBrief (streaming generator, same pattern as streamChat)

## Font size + theme system notes
- Theme tokens: THEMES map in theme.js (dark/light/paper/ocean/forest), each with bg0-bg4, border/borderHi, text/textHi/textDim/textFaint/textGhost, warn/danger/info, accent
- ThemeContext.jsx: ThemeProvider wraps the app in App.jsx; useTheme() hook replaces static `import { T }` across all ~22 MC files
- Context value shape: `{ ...THEMES[themeName], themeName, setTheme }` — themeName and setTheme exposed for the picker
- Persistence: localStorage key `mc-theme`; default is `dark`
- Appearance tab in SettingsPage: THEME_NAMES.map renders swatch buttons (bg0 background + accent circle); active theme shows white ring
- accent prop removed from all MC page/panel call sites — components read T.accent from useTheme() directly
- Font scale: +2px applied to all inline fontSize values in MC files (8→10, 9→11, 10→12, 11→13, etc.)