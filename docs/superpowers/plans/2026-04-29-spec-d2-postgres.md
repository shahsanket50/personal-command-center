# Spec D2 — Postgres Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Notion as the data layer with PostgreSQL. All `notion.js` functions are rewritten against Postgres with identical signatures. Notion SDK dependency is removed. A migration script creates the schema; an import script seeds from existing Notion data.

**Architecture:** New `server/services/db.js` exposes the same function names as `notion.js` — only the import path changes across route files. Six tables mirror the six Notion databases. Messages in conversations are stored as JSON in the `content` column. `docker-compose.yml` gains a `postgres` container.

**Tech Stack:** `pg` (node-postgres), PostgreSQL 16, existing Express server, Docker Compose (from D1)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/package.json` | Modify | Add `pg` dependency |
| `server/services/db.js` | Create | pg pool + all data access functions |
| `server/services/notion.js` | Delete (after migration verified) | Replaced by db.js |
| `scripts/migrate.js` | Create | CREATE TABLE IF NOT EXISTS for all 6 tables |
| `scripts/import-from-notion.js` | Create | One-time Notion → Postgres data import |
| `server/routes/brief.js` | Modify | Import from `../services/db.js` |
| `server/routes/claude.js` | Modify | Import from `../services/db.js` |
| `server/routes/tasks.js` | Modify | Import from `../services/db.js` |
| `server/routes/notes.js` | Modify | Import from `../services/db.js` |
| `server/routes/slack.js` | Modify | Import from `../services/db.js` |
| `server/routes/email.js` | Modify | Import from `../services/db.js` |
| `server/routes/people.js` | Modify | Import from `../services/db.js` |
| `server/routes/settings.js` | Modify | Remove Notion test connection |
| `docker-compose.yml` | Modify | Add postgres service |
| `.env.example` | Modify | Remove NOTION_* vars, add DATABASE_URL |

---

## Task 1: Install pg and create db.js skeleton

**Files:**
- Modify: `server/package.json`
- Create: `server/services/db.js`

- [ ] **Step 1: Install pg**

```bash
cd server && npm install pg
```

Expected: `pg` added to `server/package.json` dependencies.

- [ ] **Step 2: Create server/services/db.js with pool**

```js
import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
```

- [ ] **Step 3: Verify pool connects**

```bash
# Start a local postgres (via docker or local install)
docker run -d --name cc-pg -e POSTGRES_DB=command_center -e POSTGRES_USER=cc -e POSTGRES_PASSWORD=cc -p 5432:5432 postgres:16-alpine

# Test connection
DATABASE_URL=postgres://cc:cc@localhost:5432/command_center node -e "
import('./server/services/db.js').then(async m => {
  const res = await m.query('SELECT 1 AS ok');
  console.log('connected:', res.rows[0]);
}).catch(console.error);
"
```

Expected: `connected: { ok: 1 }`

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/package-lock.json server/services/db.js
git commit -m "feat(postgres): add pg dependency and db.js connection pool"
```

---

## Task 2: Create migration script

**Files:**
- Create: `scripts/migrate.js`

- [ ] **Step 1: Create scripts/migrate.js**

```js
import { query } from '../server/services/db.js';

async function migrate() {
  console.log('Running migrations…');

  await query(`
    CREATE TABLE IF NOT EXISTS daily_briefings (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date       DATE NOT NULL,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_briefings_date_type ON daily_briefings (date, type)`);

  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'Todo',
      due_date   DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS people (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      role       TEXT,
      team       TEXT,
      last_1on1  DATE,
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS action_items (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      source     TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS habits_goals (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      type       TEXT,
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS travel_bookings (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      start_date DATE,
      end_date   DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log('Migrations complete.');
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run migration**

```bash
DATABASE_URL=postgres://cc:cc@localhost:5432/command_center node scripts/migrate.js
```

Expected:
```
Running migrations…
Migrations complete.
```

- [ ] **Step 3: Verify tables exist**

```bash
docker exec cc-pg psql -U cc -d command_center -c "\dt"
```

Expected: 6 tables listed: `daily_briefings`, `tasks`, `people`, `action_items`, `habits_goals`, `travel_bookings`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate.js
git commit -m "feat(postgres): add migration script with 6-table schema"
```

---

## Task 3: Implement daily_briefings functions in db.js

**Files:**
- Modify: `server/services/db.js`

**Context:** These replace `saveBriefing`, `getLatestBriefingForDate`, `listBriefings`, `getBriefingById`, `saveSlackDigest`, `getLatestSlackDigestForDate`, `saveEmailDigest`, `getLatestEmailDigestForDate` from notion.js. All use the `daily_briefings` table with a `type` column to differentiate.

- [ ] **Step 1: Append briefing functions to db.js**

```js
// ─── Daily Briefings ─────────────────────────────────────────────────────────

export async function saveBriefing(dateStr, content) {
  await query(
    `INSERT INTO daily_briefings (date, type, title, content)
     VALUES ($1, 'morning_brief', $2, $3)`,
    [dateStr, `Morning Brief · ${dateStr}`, content]
  );
}

export async function getLatestBriefingForDate(dateStr) {
  const { rows } = await query(
    `SELECT id, content, created_at FROM daily_briefings
     WHERE date = $1 AND type = 'morning_brief'
     ORDER BY created_at DESC LIMIT 1`,
    [dateStr]
  );
  if (!rows.length) return null;
  return { id: rows[0].id, content: rows[0].content, createdAt: rows[0].created_at };
}

export async function listBriefings() {
  const { rows } = await query(
    `SELECT id, date, title FROM daily_briefings
     WHERE type = 'morning_brief'
     ORDER BY date DESC, created_at DESC
     LIMIT 30`
  );
  return rows.map(r => ({ id: r.id, date: r.date.toISOString().slice(0, 10), title: r.title }));
}

export async function getBriefingById(id) {
  const { rows } = await query(
    `SELECT id, content, created_at FROM daily_briefings WHERE id = $1`,
    [id]
  );
  if (!rows.length) return null;
  return { id: rows[0].id, content: rows[0].content, createdAt: rows[0].created_at };
}

export async function saveSlackDigest(dateStr, content) {
  await query(
    `INSERT INTO daily_briefings (date, type, title, content)
     VALUES ($1, 'slack_digest', $2, $3)`,
    [dateStr, `Slack Digest · ${dateStr}`, content]
  );
}

export async function getLatestSlackDigestForDate(dateStr) {
  const { rows } = await query(
    `SELECT id, content FROM daily_briefings
     WHERE date = $1 AND type = 'slack_digest'
     ORDER BY created_at DESC LIMIT 1`,
    [dateStr]
  );
  return rows[0]?.content ?? null;
}

export async function saveEmailDigest(dateStr, content) {
  await query(
    `INSERT INTO daily_briefings (date, type, title, content)
     VALUES ($1, 'email_digest', $2, $3)`,
    [dateStr, `Email Digest · ${dateStr}`, content]
  );
}

export async function getLatestEmailDigestForDate(dateStr) {
  const { rows } = await query(
    `SELECT id, content FROM daily_briefings
     WHERE date = $1 AND type = 'email_digest'
     ORDER BY created_at DESC LIMIT 1`,
    [dateStr]
  );
  return rows[0]?.content ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/db.js
git commit -m "feat(postgres): implement daily_briefings functions in db.js"
```

---

## Task 4: Implement conversations functions in db.js

**Files:**
- Modify: `server/services/db.js`

**Context:** Conversations (Claude CLI sessions) are stored in `daily_briefings` with `type = 'claude_cli'`. The `content` column stores `JSON.stringify(messages)` where messages is `[{ role, content }]`.

- [ ] **Step 1: Append conversation functions to db.js**

```js
// ─── Claude Conversations ────────────────────────────────────────────────────

export async function saveConversation(title, messages) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  await query(
    `INSERT INTO daily_briefings (date, type, title, content)
     VALUES ($1, 'claude_cli', $2, $3)`,
    [dateStr, title, JSON.stringify(messages)]
  );
}

export async function listConversations() {
  const { rows } = await query(
    `SELECT id, title, date, created_at FROM daily_briefings
     WHERE type = 'claude_cli'
     ORDER BY created_at DESC
     LIMIT 50`
  );
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    date: r.date.toISOString().slice(0, 10),
  }));
}

export async function getConversationById(id) {
  const { rows } = await query(
    `SELECT id, title, content FROM daily_briefings WHERE id = $1`,
    [id]
  );
  if (!rows.length) return null;
  let messages = [];
  try { messages = JSON.parse(rows[0].content); } catch { messages = []; }
  return { id: rows[0].id, title: rows[0].title, messages };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/db.js
git commit -m "feat(postgres): implement conversation functions in db.js"
```

---

## Task 5: Implement tasks, daily notes, and action items in db.js

**Files:**
- Modify: `server/services/db.js`

- [ ] **Step 1: Append tasks functions**

```js
// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasks() {
  const { rows } = await query(
    `SELECT id, name, status, due_date FROM tasks ORDER BY created_at DESC`
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    dueDate: r.due_date ? r.due_date.toISOString().slice(0, 10) : null,
  }));
}

export async function getOverdueTasks() {
  const { rows } = await query(
    `SELECT id, name, status, due_date FROM tasks
     WHERE status != 'Done' AND due_date < CURRENT_DATE
     ORDER BY due_date ASC`
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    dueDate: r.due_date.toISOString().slice(0, 10),
  }));
}

export async function getDueTodayTasks(dateStr) {
  const { rows } = await query(
    `SELECT id, name, status, due_date FROM tasks
     WHERE status != 'Done' AND due_date = $1
     ORDER BY created_at ASC`,
    [dateStr]
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    dueDate: r.due_date.toISOString().slice(0, 10),
  }));
}

export async function createTask(title, dueDate) {
  const { rows } = await query(
    `INSERT INTO tasks (name, due_date) VALUES ($1, $2) RETURNING id`,
    [title, dueDate || null]
  );
  return rows[0].id;
}

export async function updateTask(taskId, updates) {
  const fields = [];
  const values = [];
  let i = 1;
  if (updates.status !== undefined) { fields.push(`status = $${i++}`); values.push(updates.status); }
  if (updates.dueDate !== undefined) { fields.push(`due_date = $${i++}`); values.push(updates.dueDate); }
  if (!fields.length) return;
  values.push(taskId);
  await query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i}`, values);
}

export async function deleteTask(taskId) {
  await query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
}
```

- [ ] **Step 2: Append daily notes functions**

```js
// ─── Daily Notes ─────────────────────────────────────────────────────────────

export async function getDailyNote(dateStr) {
  const { rows } = await query(
    `SELECT id, content FROM daily_briefings WHERE date = $1 AND type = 'daily_note' LIMIT 1`,
    [dateStr]
  );
  if (rows.length) return { id: rows[0].id, content: rows[0].content };

  // Create if not exists
  const insert = await query(
    `INSERT INTO daily_briefings (date, type, title, content)
     VALUES ($1, 'daily_note', $2, '') RETURNING id`,
    [dateStr, `Daily Note · ${dateStr}`]
  );
  return { id: insert.rows[0].id, content: '' };
}

export async function saveDailyNote(noteId, content) {
  await query(`UPDATE daily_briefings SET content = $1 WHERE id = $2`, [content, noteId]);
}
```

- [ ] **Step 3: Append action items and travel functions**

```js
// ─── Action Items ────────────────────────────────────────────────────────────

export async function saveActionItems(items) {
  if (!items.length) return;
  const values = items.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
  const params = items.flatMap(item => [item.text || item.name, item.source || null]);
  await query(`INSERT INTO action_items (name, source) VALUES ${values}`, params);
}

// ─── Travel Bookings ─────────────────────────────────────────────────────────

export async function getTravelEntries() {
  const { rows } = await query(
    `SELECT id, name, start_date, end_date FROM travel_bookings ORDER BY start_date ASC`
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    startDate: r.start_date ? r.start_date.toISOString().slice(0, 10) : null,
    endDate: r.end_date ? r.end_date.toISOString().slice(0, 10) : null,
  }));
}
```

- [ ] **Step 4: Commit**

```bash
git add server/services/db.js
git commit -m "feat(postgres): implement tasks, daily notes, action items, travel in db.js"
```

---

## Task 6: Implement people functions in db.js

**Files:**
- Modify: `server/services/db.js`

- [ ] **Step 1: Append people functions**

```js
// ─── People ──────────────────────────────────────────────────────────────────

export async function getPeople() {
  const { rows } = await query(
    `SELECT id, name, role, team, last_1on1, notes FROM people ORDER BY name ASC`
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    role: r.role ?? '',
    team: r.team ?? '',
    initials: r.name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
    last1on1: r.last_1on1 ? r.last_1on1.toISOString().slice(0, 10) : null,
    notes: r.notes ?? '',
    ooo: false,
  }));
}

export async function getPersonById(personId) {
  const { rows } = await query(
    `SELECT id, name, role, team, last_1on1, notes FROM people WHERE id = $1`,
    [personId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    role: r.role ?? '',
    team: r.team ?? '',
    initials: r.name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
    last1on1: r.last_1on1 ? r.last_1on1.toISOString().slice(0, 10) : null,
    notes: r.notes ?? '',
    ooo: false,
  };
}

export async function testConnection() {
  const { rows } = await query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/db.js
git commit -m "feat(postgres): implement people and testConnection in db.js"
```

---

## Task 7: Update all server route imports

**Files:**
- Modify: all files under `server/routes/` that import from `../services/notion.js`

- [ ] **Step 1: Find all route files importing from notion.js**

```bash
grep -rl "from '../services/notion.js'" server/routes/
```

- [ ] **Step 2: Replace import path in every file found**

For each file, change:
```js
import { ... } from '../services/notion.js';
```
to:
```js
import { ... } from '../services/db.js';
```

The imported function names stay identical — only the path changes.

Run this to do it automatically:

```bash
find server/routes -name "*.js" -exec sed -i '' "s|from '../services/notion.js'|from '../services/db.js'|g" {} +
```

- [ ] **Step 3: Also update server/index.js if it imports from notion.js**

```bash
grep "notion" server/index.js && sed -i '' "s|from './services/notion.js'|from './services/db.js'|g" server/index.js
```

- [ ] **Step 4: Verify server starts with no import errors**

```bash
DATABASE_URL=postgres://cc:cc@localhost:5432/command_center cd server && npm run dev
```

Expected: server starts on port 3001, no `Cannot find module` errors.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ server/index.js
git commit -m "feat(postgres): update all route imports from notion.js to db.js"
```

---

## Task 8: Create Notion → Postgres import script

**Files:**
- Create: `scripts/import-from-notion.js`

**Context:** This is a one-time script that reads data from all Notion databases and inserts into Postgres. It uses the OLD notion.js functions directly (before deletion). Run it once after migration setup.

- [ ] **Step 1: Create scripts/import-from-notion.js**

```js
// One-time import: Notion → Postgres
// Run BEFORE removing notion.js
// Requires both NOTION_TOKEN + NOTION_DB_* vars AND DATABASE_URL in .env

import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/services/db.js';

// Import notion functions directly (before notion.js is deleted)
import {
  getTasks,
  getPeople,
  getTravelEntries,
} from '../server/services/notion.js';

// For briefings we query Notion directly
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function importBriefings() {
  console.log('Importing daily_briefings from Notion…');
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) { console.log('  NOTION_DB_DAILY_BRIEFINGS not set — skipping'); return; }

  const { results } = await notion.databases.query({ database_id: dbId, page_size: 100 });

  for (const page of results) {
    const title = page.properties.title?.title?.map(t => t.plain_text).join('') ?? '';
    const date = page.created_time.slice(0, 10);

    let type = 'unknown';
    if (title.startsWith('Morning Brief')) type = 'morning_brief';
    else if (title.startsWith('Slack Digest')) type = 'slack_digest';
    else if (title.startsWith('Email Digest')) type = 'email_digest';
    else if (title.startsWith('Claude CLI')) type = 'claude_cli';
    else if (title.startsWith('Daily Note')) type = 'daily_note';

    const { results: blocks } = await notion.blocks.children.list({ block_id: page.id });
    const content = blocks.map(b => {
      if (b.type === 'paragraph') return b.paragraph.rich_text.map(r => r.plain_text).join('');
      if (b.type === 'heading_2') return '## ' + b.heading_2.rich_text.map(r => r.plain_text).join('');
      if (b.type === 'heading_3') return '### ' + b.heading_3.rich_text.map(r => r.plain_text).join('');
      if (b.type === 'bulleted_list_item') return '- ' + b.bulleted_list_item.rich_text.map(r => r.plain_text).join('');
      return '';
    }).filter(Boolean).join('\n');

    await query(
      `INSERT INTO daily_briefings (date, type, title, content, created_at)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [date, type, title, content, page.created_time]
    );
  }
  console.log(`  Imported ${results.length} briefings`);
}

async function importTasks() {
  console.log('Importing tasks from Notion…');
  try {
    const tasks = await getTasks();
    for (const t of tasks) {
      await query(
        `INSERT INTO tasks (name, status, due_date) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [t.name, t.status, t.dueDate || null]
      );
    }
    console.log(`  Imported ${tasks.length} tasks`);
  } catch (e) { console.log('  Tasks import failed:', e.message); }
}

async function importPeople() {
  console.log('Importing people from Notion…');
  try {
    const people = await getPeople();
    for (const p of people) {
      await query(
        `INSERT INTO people (name, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [p.name, p.role || null]
      );
    }
    console.log(`  Imported ${people.length} people`);
  } catch (e) { console.log('  People import failed:', e.message); }
}

async function importTravel() {
  console.log('Importing travel bookings from Notion…');
  try {
    const entries = await getTravelEntries();
    for (const t of entries) {
      await query(
        `INSERT INTO travel_bookings (name, start_date, end_date) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [t.name, t.startDate || null, t.endDate || null]
      );
    }
    console.log(`  Imported ${entries.length} travel entries`);
  } catch (e) { console.log('  Travel import failed:', e.message); }
}

async function main() {
  console.log('Starting Notion → Postgres import…\n');
  await importBriefings();
  await importTasks();
  await importPeople();
  await importTravel();
  console.log('\nImport complete.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the import (with both Notion and Postgres vars set)**

```bash
DATABASE_URL=postgres://cc:cc@localhost:5432/command_center node scripts/import-from-notion.js
```

Expected:
```
Starting Notion → Postgres import…

Importing daily_briefings from Notion…
  Imported N briefings
Importing tasks from Notion…
  Imported N tasks
Importing people from Notion…
  Imported N people
Importing travel bookings from Notion…
  Imported N travel entries

Import complete.
```

- [ ] **Step 3: Verify row counts**

```bash
docker exec cc-pg psql -U cc -d command_center -c "
SELECT 'daily_briefings' AS tbl, COUNT(*) FROM daily_briefings
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'people', COUNT(*) FROM people
UNION ALL SELECT 'travel_bookings', COUNT(*) FROM travel_bookings;
"
```

Expected: counts match what was in Notion.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-from-notion.js
git commit -m "feat(postgres): add one-time Notion → Postgres import script"
```

---

## Task 9: Update docker-compose.yml with postgres

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Add postgres service to docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: command_center
      POSTGRES_USER: cc
      POSTGRES_PASSWORD: cc
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  server:
    build:
      context: .
      dockerfile: Dockerfile
    env_file: .env
    environment:
      DATABASE_URL: postgres://cc:cc@postgres:5432/command_center
    depends_on:
      - postgres
    ports:
      - "3001:3001"
    volumes:
      - ./ms-token.json:/app/ms-token.json
      - ./google-credentials.json:/app/google-credentials.json
    restart: unless-stopped

  client:
    build:
      context: .
      dockerfile: Dockerfile.client
    ports:
      - "5173:80"
    depends_on:
      - server
    restart: unless-stopped

volumes:
  pgdata:
```

- [ ] **Step 2: Update .env.example**

Remove all `NOTION_*` lines. Add:
```
# Database
DATABASE_URL=postgres://cc:cc@localhost:5432/command_center
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(postgres): add postgres service to docker-compose, remove Notion env vars"
```

---

## Task 10: Remove notion.js and Notion SDK dependency

**After verifying all features work with Postgres:**

- [ ] **Step 1: Remove notion.js**

```bash
rm server/services/notion.js
```

- [ ] **Step 2: Remove @notionhq/client from server/package.json**

```bash
cd server && npm uninstall @notionhq/client
```

- [ ] **Step 3: Verify no remaining notion imports**

```bash
grep -r "notion" server/routes/ server/services/ --include="*.js"
```

Expected: no results (or only comments).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(postgres): remove notion.js and @notionhq/client — Postgres migration complete"
```

---

## Task 11: End-to-end verification + CLAUDE.md

- [ ] **Step 1: Full docker-compose test**

```bash
docker-compose up --build
```

Test each feature:
- `/brief` — morning brief generates and saves to Postgres
- `/claude` — chat works, sessions save, history sidebar loads past sessions
- `/tasks` (Notes page) — task CRUD works
- `/calendar` — calendar events load (Google; MS with token)
- `/slack` — Slack digest generates and saves
- `/email` — email digest generates and saves
- `/settings` — Notion test removed, MS token field works

- [ ] **Step 2: Verify data persists across restart**

```bash
docker-compose down
docker-compose up
# Navigate to /brief — should see previously generated briefs in history sidebar
```

- [ ] **Step 3: Update CLAUDE.md build status**

Change `Next: Spec D2 — Postgres full migration (replace Notion).` to:
```
Spec D2 complete — Notion replaced by PostgreSQL; all 6 data stores migrated; docker-compose up includes postgres container; one-time Notion import script provided.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: update CLAUDE.md — Spec D2 complete, Postgres migration done"
```
