import 'dotenv/config';
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
