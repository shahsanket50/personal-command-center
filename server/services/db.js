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
