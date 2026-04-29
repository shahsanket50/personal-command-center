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

export async function runMigrations() {
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
}

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
     LIMIT 100`
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
