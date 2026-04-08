#!/usr/bin/env node
// Inspect all 6 Notion databases and print exact property names + types.
// Self-contained: uses only Node built-ins (no external packages needed).
// Run from repo root: node scripts/inspect-notion-dbs.js

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Parse .env manually (no dotenv dependency) ───────────────────────────────

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ─── Notion API helper ────────────────────────────────────────────────────────

function notionGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      path,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Invalid JSON (status ${res.statusCode})`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── DB definitions ───────────────────────────────────────────────────────────

const DBS = [
  { name: 'Daily Briefings',   env: 'NOTION_DB_DAILY_BRIEFINGS' },
  { name: 'Tasks',             env: 'NOTION_DB_TASKS' },
  { name: 'People',            env: 'NOTION_DB_PEOPLE' },
  { name: 'Action Items',      env: 'NOTION_DB_ACTION_ITEMS' },
  { name: 'Habits & Goals',    env: 'NOTION_DB_HABITS_GOALS' },
  { name: 'Travel & Bookings', env: 'NOTION_DB_TRAVEL_BOOKINGS' },
];

// ─── Inspect ──────────────────────────────────────────────────────────────────

async function inspect(db) {
  const id = process.env[db.env];
  if (!id) {
    console.log(`\n── ${db.name} (${db.env})\n   ⚠  Not set in .env — skipping`);
    return;
  }

  const result = await notionGet(`/v1/databases/${id}`);

  if (result.object === 'error') {
    console.log(`\n── ${db.name}\n   ✗  ${result.message}`);
    return;
  }

  const title = result.title?.[0]?.plain_text ?? '(untitled)';
  console.log(`\n── ${db.name}  [${title}]`);
  console.log(`   ID: ${id}`);

  const props = Object.entries(result.properties).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, prop] of props) {
    let detail = '';
    if (prop.type === 'select') {
      const opts = prop.select.options.map((o) => o.name).join(', ');
      detail = opts ? `  →  ${opts}` : '';
    } else if (prop.type === 'multi_select') {
      const opts = prop.multi_select.options.map((o) => o.name).join(', ');
      detail = opts ? `  →  ${opts}` : '';
    } else if (prop.type === 'relation') {
      detail = `  →  related to ${prop.relation.database_id.slice(0, 8)}…`;
    } else if (prop.type === 'formula') {
      detail = `  →  ${prop.formula.expression ?? ''}`;
    }
    console.log(`   ${name.padEnd(30)} ${prop.type}${detail}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!process.env.NOTION_API_KEY) {
  console.error('NOTION_API_KEY is not set in .env');
  process.exit(1);
}

console.log('Inspecting Notion databases…');
for (const db of DBS) {
  await inspect(db);
}
console.log('\nDone.');
