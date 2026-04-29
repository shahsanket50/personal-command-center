// One-time import: Notion → Postgres
// Run BEFORE removing notion.js
// Requires both NOTION_TOKEN + NOTION_DB_* vars AND DATABASE_URL in .env

import 'dotenv/config';
import { query } from '../server/services/db.js';

// Import notion functions directly (before notion.js is deleted)
import {
  getTasks,
  getPeople,
  getTravelEntries,
} from '../server/services/notion.js';

// For briefings we query Notion directly
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY });

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
        [t.name ?? t.title, t.status, t.dueDate || null]
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
