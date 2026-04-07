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

## Current build status
Phase 1 complete — Claude CLI module built (streaming, history, syntax highlighting, Notion save).
Next: Phase 2 — Notes & Tasks module (daily notes + task DB in Notion).
