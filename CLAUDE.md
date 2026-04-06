# Personal Command Center
 
## What this project is
A local Electron app — personal OS for Sanket (Engineering Manager).
Integrates Claude API, Notion, Slack, Gmail (×2), Google Calendar into one interface.
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
3. Calendar — Google Calendar OAuth, office + personal merged view
4. Morning Brief — generated on app open + manual trigger, written to Notion
5. Slack digest — unread triage, action items → Notion
6. Email triage — Gmail × 2 (office + personal), action items → Notion
7. People & 1:1s — per-person notes, feedback, IDP, talking points via Claude
8. Life & goals — habits, books, travel, bookings; cross-refs calendar for OOO flags
 
## Notion databases (all under root page)
- Daily Briefings, Tasks, People, Action Items, Habits & Goals, Travel & Bookings
Database IDs stored in .env after first-run setup.
 
## Themes
- dark: CLI module
- clean: Calendar, Notes, Settings, People
- cards: Slack, Email, Life & goals, Morning brief
Auto-switches on module change. User can override globally in Settings.
 
## Key conventions
- Never store secrets in code — always process.env.*
- .env is gitignored — .env.example is the committed template
- google-credentials.json is gitignored
- All Notion writes are async with error handling — API rate limit is 3 req/s
- Two Gmail accounts: GMAIL_ACCOUNT_OFFICE and GMAIL_ACCOUNT_PERSONAL
- Always label email/Slack action items with their source account
- Life & goals data is private — never include in work briefings or Slack context
 
## Folder structure
client/src/modules/ — one folder per module
client/src/components/ — shared UI
client/src/themes/ — theme configs
server/routes/ — Express routes
server/services/ — notion.js, claude.js, slack.js, gmail.js, calendar.js
 
## Current build status
Phase 0 in progress — repo scaffolded, .env.example added.
Next: scaffold client/ and server/ folders, then build Settings module.
