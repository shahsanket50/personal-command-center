# Personal Command Center

A local-first personal OS for an Engineering Manager. Pulls together Claude AI, Slack, Microsoft 365 (office), Google (personal calendar + Gmail), and a Postgres database into a single terminal-styled interface.

## What it does

- **Morning Brief** — Claude-generated daily summary: overdue tasks, today's meetings, travel flags
- **Claude CLI** — streaming chat with session history you can browse and continue
- **Notes & Tasks** — daily note + task CRUD with overdue banner
- **Calendar** — merged office (Outlook) + personal (Google Calendar) day view
- **Slack Digest** — Claude triage of all joined channels/DMs, action item extraction, channel blacklist
- **Email Triage** — unread Gmail + Outlook summarised with action items
- **People** — team roster with 1:1 cadence status
- **Settings** — API keys, OAuth, theme picker, MS bearer token

All data lives in **PostgreSQL**. History, notes, tasks, digests, and conversations persist locally and survive restarts. Migrations run automatically on server startup.

---

## Ways to run

### 1. Electron menubar app — daily driver (macOS)

Runs as a tray icon in the macOS menu bar. One command starts Postgres, the Express API, the Vite dev server, and the Electron window.

**One-time setup:**
```bash
# Create the Postgres container (once — data persists across restarts)
docker run -d --name cc-pg \
  -e POSTGRES_DB=command_center \
  -e POSTGRES_USER=cc \
  -e POSTGRES_PASSWORD=cc \
  -p 5432:5432 postgres:16-alpine

cp .env.example .env
# edit .env with your API keys

npm install
npm install --prefix server
npm install --prefix client
```

**Every day:**
```bash
npm start
```

This starts the Postgres container, Express API, Vite dev server, and Electron window — in the right order. The tray icon appears in the macOS menu bar; click it to show/hide the window.

To stop: right-click the tray icon → Quit (Postgres keeps running in the background — `docker stop cc-pg` to stop it too).

---

### 2. Browser (hot reload)

No Electron, just the web UI at `http://localhost:5173`.

**One-time setup:**
```bash
docker run -d --name cc-pg \
  -e POSTGRES_DB=command_center \
  -e POSTGRES_USER=cc \
  -e POSTGRES_PASSWORD=cc \
  -p 5432:5432 postgres:16-alpine

cp .env.example .env
# edit .env

npm install
npm install --prefix server
npm install --prefix client
```

**Run:**
```bash
docker start cc-pg   # resume Postgres (skips if already running)
npm run dev
# Server: http://localhost:3001
# Client: http://localhost:5173
```

---

### 3. Docker Compose (self-contained / sharing)

One command starts everything — Postgres, Express API, and the React frontend served via nginx. No Node install required on the host.

```bash
cp .env.example .env
# edit .env with your API keys

docker-compose up --build
# App at http://localhost:5173
# API at http://localhost:3001
```

To stop:
```bash
docker-compose down
```

Data persists in a Docker named volume (`pgdata`) across restarts.

---

## First-time setup

### 1. API keys

Copy `.env.example` to `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Already set for the Docker Postgres above |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 |
| `SLACK_BOT_TOKEN` | api.slack.com → your app → OAuth Tokens |

### 2. Database

Tables are created automatically when the server starts. To run migrations manually (e.g. before first start):

```bash
node scripts/migrate.js
```

### 3. Google OAuth (calendar + Gmail)

1. Start the server
2. Go to `http://localhost:5173/settings` → Accounts
3. Click "Connect Google" — authorises Calendar + Gmail in one flow
4. Token saved to `google-credentials.json` (gitignored)

### 4. Microsoft 365 (calendar + email)

No app registration required. Uses a short-lived bearer token from Graph Explorer:

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your Microsoft 365 account
3. Copy the **Access token** from the token panel
4. Go to Settings → Accounts → paste token → Save

Token lasts ~60 minutes. The app shows an amber banner on Calendar and Email pages when it expires. Paste a new token to refresh.

### 5. Migrate existing Notion data (optional)

If you have existing data in Notion from before the Postgres migration:

```bash
# Requires both NOTION_API_KEY + NOTION_DB_* vars AND DATABASE_URL in .env
node scripts/import-from-notion.js
```

---

## Environment variables

```
DATABASE_URL=postgres://cc:cc@localhost:5432/command_center

ANTHROPIC_API_KEY=

# Microsoft 365 — bearer token set via Settings UI, stored in ms-token.json
MS_ACCOUNT_OFFICE=your.email@company.com

# Google OAuth — credentials stored in google-credentials.json after auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_ACCOUNT_PERSONAL=your.email@gmail.com

# Slack
SLACK_BOT_TOKEN=
SLACK_BLACKLIST_CHANNELS=   # comma-separated channel IDs to exclude from digest

PORT=3001
```

---

## Project structure

```
server/
  index.js              — Express app, auto-migration on startup, route registration
  routes/               — one file per feature area
  services/
    db.js               — Postgres pool, runMigrations(), all data access functions
    claude.js           — Anthropic SDK streaming generators
    outlook.js          — Microsoft Graph (bearer token auth)
    gmail.js            — Gmail API
    calendar.js         — Google Calendar + MS Graph calendar
    slack.js            — Slack Web API

client/src/
  mission-control/
    pages/              — full-page views (BriefPage, ClaudePage, etc.)
    panels/             — Today/Triage/People panel components
    components/         — shared UI (Panel, etc.)
  ThemeContext.jsx       — 5 themes: dark / light / paper / ocean / forest

scripts/
  migrate.js            — run migrations manually (safe to re-run)
  import-from-notion.js — one-time Notion → Postgres seeder

electron/
  main.js               — tray icon, BrowserWindow, server spawn
  preload.js
  assets/tray-icon.png
```

---

## Keyboard shortcuts (Mission Control)

| Key | Action |
|---|---|
| `j` / `k` | Move cursor up/down |
| `Tab` | Switch pane focus |
| `g t` | Today pivot |
| `g i` | Triage pivot |
| `g p` | People pivot |
| `⌘K` | Command palette |
| `?` | Help overlay |

Command palette commands: `/task`, `/note`, `/brief`, `/today`, `/triage`, `/people`

---

## Tech stack

- **Frontend** — React + Vite, Tailwind CSS, shadcn/ui
- **Backend** — Node.js + Express (ESM)
- **Database** — PostgreSQL 16 via `pg`
- **AI** — Anthropic SDK (`claude-sonnet-4-5`), streaming SSE
- **Desktop** — Electron 30, macOS tray
- **Infra** — Docker Compose, nginx (client container)
