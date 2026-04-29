# Spec B — Brief History + Claude Chat History Design

## Overview

Add history browsing to two existing MC pages: BriefPage (past morning briefs) and ClaudePage (past saved Claude sessions). Both use a persistent left sidebar for navigation. Claude sessions load as continuable conversations.

---

## Brief History

### Server

Two new routes added to `server/routes/brief.js`:

**`GET /api/brief/history`**
Queries `NOTION_DB_DAILY_BRIEFINGS` for all pages whose title starts with `Morning Brief ·`. Returns array sorted newest-first:
```json
[{ "id": "notion-page-id", "date": "2026-04-27", "title": "Morning Brief · 2026-04-27" }]
```

**`GET /api/brief/:id`**
Fetches a specific Notion page by ID, reconstructs markdown via existing `reconstructBriefMarkdown`. Returns `{ id, content, createdAt }`.

New Notion helpers added to `server/services/notion.js`:
- `listBriefings()` — queries all `Morning Brief · *` pages, returns `[{ id, date, title }]`
- `getBriefingById(id)` — fetches page + blocks, returns `{ id, content, createdAt }`

### Client — BriefPage

`client/src/mission-control/pages/BriefPage.jsx` gains a persistent left sidebar (140px wide):

```
┌─────────────┬──────────────────────────────┐
│ history     │ morning_brief · Apr 27       │
│─────────────│                              │
│ Apr 27 ◀   │  ☀ Greeting                  │
│ Apr 26      │  Good morning — 3 meetings…  │
│ Apr 25      │                              │
│ Apr 24      │  ◫ Meetings                  │
│             │  · Standup 9:00am            │
└─────────────┴──────────────────────────────┘
```

- On mount: fetch history list + load today's brief (existing `fetchCached` logic)
- Click a date in sidebar → fetch that brief by ID, render in main panel
- Active date highlighted with accent left border
- Sidebar scrollable; history list fetched once on mount

---

## Claude Chat History

### Server

Two new routes added to `server/routes/claude.js`:

**`GET /api/claude/sessions`**
Queries `NOTION_DB_DAILY_BRIEFINGS` for all pages whose title starts with `Claude CLI ·`. Returns:
```json
[{ "id": "notion-page-id", "title": "Claude CLI · 2026-04-26 14:32", "date": "2026-04-26", "exchangeCount": 3 }]
```
Exchange count derived from block count (each exchange = heading_2 + paragraph pair).

**`GET /api/claude/sessions/:id`**
Fetches a specific session by page ID. Reconstructs messages array from Notion blocks:
- `heading_2` block with content `you` → next paragraph = `{ role: 'user', content }`
- `heading_2` block with content `claude` → next paragraph = `{ role: 'assistant', content }`

Returns `{ id, title, messages: [{ role, content }] }`.

New Notion helpers added to `server/services/notion.js`:
- `listConversations()` — queries all `Claude CLI · *` pages, returns `[{ id, title, date, exchangeCount }]`
- `getConversationById(id)` — fetches page + blocks, reconstructs messages array

### Client — ClaudePage

`client/src/mission-control/pages/ClaudePage.jsx` gains a persistent left sidebar (150px wide):

```
┌──────────────┬────────────────────────────────┐
│ sessions     │ $ claude-chat                  │
│──────────────│                                │
│ + new chat   │  you > Summarise Q2 retro      │
│──────────────│                                │
│ Q2 retro…   │  claude > Sure — key themes…   │
│ Apr 26 · 3x │                                │
│──────────────│  you > Can you expand on…     │
│ Draft eng…  │                                │
│ Apr 25 · 7x │ ─────────────────────────────  │
│──────────────│ > continue this conversation… │
│ IDP points  │                                │
│ Apr 24 · 5x │                                │
└──────────────┴────────────────────────────────┘
```

- **`+ new chat`** always starts a fresh empty session
- Clicking a past session: loads its messages into the chat, input stays active
- Banner in header shows `↩ continuing · Q2 retro summary` when a past session is active
- Sending a new message in a loaded session appends to the messages array (in-memory only — user can Save to Notion manually to create a new page)
- Title derived from first user message (truncated to 24 chars)
- Exchange count = `Math.floor(messages.length / 2)`

---

## What Does Not Change

- `saveConversation` in `notion.js` — unchanged, still writes `Claude CLI · YYYY-MM-DD HH:MM` pages
- Existing SSE brief generation flow — unchanged
- Auto-save behaviour — unchanged (user clicks "Save to Notion" manually)

---

## Success Criteria

1. BriefPage sidebar lists all past briefs; clicking one loads it instantly
2. ClaudePage sidebar lists all saved sessions with title + date + exchange count
3. Loading a past Claude session populates the chat and allows continuation
4. "+ new chat" always starts fresh regardless of active session
5. No regressions in brief generation or Claude chat streaming
