# Spec D2 — Postgres Full Migration Design

## Overview

Replace Notion as the data layer with PostgreSQL. All `server/services/notion.js` functions are rewritten against Postgres. Notion SDK dependency is removed. A one-time import script migrates existing Notion data. Docker Compose from D1 gains a `postgres` container.

---

## Database Schema

Six tables, one per Notion database:

```sql
CREATE TABLE daily_briefings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  type        TEXT NOT NULL,  -- 'morning_brief' | 'slack_digest' | 'email_digest' | 'claude_cli' | 'daily_note'
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON daily_briefings (date, type);

CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Todo',  -- 'Todo' | 'In Progress' | 'Done'
  due_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE people (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  role        TEXT,
  team        TEXT,
  last_1on1   DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE action_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  source      TEXT,  -- 'Slack' | 'Email' | 'Manual'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE habits_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE travel_bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## New Files

### `server/services/db.js`

Connection pool using `pg` library:
```js
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const query = (text, params) => pool.query(text, params);
```

### `scripts/migrate.js`

Creates all tables if they don't exist. Safe to re-run (uses `CREATE TABLE IF NOT EXISTS`). Run once on setup or via `docker-compose` entrypoint.

### `scripts/import-from-notion.js`

One-time script that reads all existing Notion data and inserts into Postgres:
- Reads each Notion DB via the existing notion.js helpers
- Inserts rows into the corresponding Postgres tables
- Logs progress and any errors
- Idempotent (uses `ON CONFLICT DO NOTHING`)

---

## Rewritten `server/services/notion.js` → `server/services/db.js`

All existing exported functions keep the same name and return shape. Only the implementation changes.

| Old (Notion)                        | New (Postgres)                              |
|-------------------------------------|---------------------------------------------|
| `saveBriefing(date, content)`       | `INSERT INTO daily_briefings`               |
| `getLatestBriefingForDate(date)`    | `SELECT ... WHERE date=$1 AND type=$2`      |
| `listBriefings()`                   | `SELECT id, date, title FROM daily_briefings ORDER BY date DESC` |
| `getBriefingById(id)`               | `SELECT * FROM daily_briefings WHERE id=$1` |
| `saveConversation(title, messages)` | Serialize messages as `JSON.stringify(messages)` into `content` column, `INSERT INTO daily_briefings` with type=`claude_cli` |
| `listConversations()`               | `SELECT id, title, created_at FROM daily_briefings WHERE type='claude_cli' ORDER BY created_at DESC` |
| `getConversationById(id)`           | `SELECT * FROM daily_briefings WHERE id=$1`, parse `content` via `JSON.parse` to recover messages array |
| `getOverdueTasks()`                 | `SELECT ... WHERE status!='Done' AND due_date < NOW()` |
| `getDueTodayTasks(date)`            | `SELECT ... WHERE status!='Done' AND due_date=$1` |
| `createTask(name, dueDate)`         | `INSERT INTO tasks`                         |
| `updateTaskStatus(id, status)`      | `UPDATE tasks SET status=$1 WHERE id=$2`    |
| `deleteTask(id)`                    | `DELETE FROM tasks WHERE id=$1`             |
| `getPeople()`                       | `SELECT * FROM people ORDER BY name`        |
| `getPersonById(id)`                 | `SELECT * FROM people WHERE id=$1`          |
| `saveActionItems(items)`            | Batch `INSERT INTO action_items`            |
| `getTravelEntries()`                | `SELECT * FROM travel_bookings`             |
| `saveDailyNote(date, content)`      | `INSERT INTO daily_briefings` with type=`daily_note` |
| `getDailyNote(date)`                | `SELECT ... WHERE date=$1 AND type='daily_note'` |

---

## Import changes across server

All files that currently `import { ... } from './notion.js'` switch to `import { ... } from './db.js'`. No other changes to route files, Claude generators, or client code.

Remove `@notionhq/client` from `server/package.json`.

---

## Docker Compose update (from D1)

`docker-compose.yml` gains a `postgres` service:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: command_center
      POSTGRES_USER: cc
      POSTGRES_PASSWORD: cc
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]
  server:
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgres://cc:cc@postgres:5432/command_center
volumes:
  pgdata:
```

For local dev without Docker: `DATABASE_URL=postgres://cc:cc@localhost:5432/command_center` in `.env`.

---

## Environment Variables

Remove all `NOTION_DB_*` vars and `NOTION_TOKEN`.
Add:
```
DATABASE_URL=postgres://cc:cc@localhost:5432/command_center
```

---

## What Does Not Change

- All route files — zero changes
- All client React code — zero changes
- All Claude generator functions — zero changes
- Google/Microsoft auth services — zero changes
- `.env` structure (except Notion vars removed, DATABASE_URL added)

---

## Success Criteria

1. `node scripts/migrate.js` creates all tables successfully
2. `node scripts/import-from-notion.js` imports existing Notion data with no errors
3. All existing features work identically (brief generation, tasks, calendar, Slack, email)
4. `@notionhq/client` is removed from dependencies
5. `docker-compose up` starts postgres + server + client; app is fully functional
