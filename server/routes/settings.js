import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../../.env');

// Keys that are safe to expose to the client (non-secret config)
const PUBLIC_KEYS = [
  'NOTION_ROOT_PAGE_ID',
  'NOTION_DB_DAILY_BRIEFINGS',
  'NOTION_DB_TASKS',
  'NOTION_DB_PEOPLE',
  'NOTION_DB_ACTION_ITEMS',
  'NOTION_DB_HABITS_GOALS',
  'NOTION_DB_TRAVEL_BOOKINGS',
  'MS_ACCOUNT_OFFICE',
  'MS_TENANT_ID',
  'GMAIL_ACCOUNT_PERSONAL',
  'THEME_OVERRIDE',
  'PORT',
];

// All keys that can be written (includes secrets)
const WRITABLE_KEYS = [
  ...PUBLIC_KEYS,
  'ANTHROPIC_API_KEY',
  'NOTION_API_KEY',
  'MS_CLIENT_ID',
  'MS_CLIENT_SECRET',
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8');
  const result = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    // Strip surrounding quotes (' or ")
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      // Strip inline comments (unquoted values only): KEY=value # comment
      const commentIdx = value.indexOf(' #');
      if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    }

    if (key) result[key] = value;
  }
  return result;
}

function writeEnvFile(filePath, values) {
  const existing = parseEnvFile(filePath);
  const merged = { ...existing, ...values };
  const content = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}

// GET /api/settings — returns non-secret config values
router.get('/', (_req, res) => {
  const env = parseEnvFile(ENV_PATH);
  const result = {};
  PUBLIC_KEYS.forEach((k) => {
    result[k] = env[k] ?? '';
  });
  // Return masked indicators for secrets (boolean: is it set?)
  result._secrets = {
    ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
    NOTION_API_KEY: !!env.NOTION_API_KEY,
    MS_CLIENT_ID: !!env.MS_CLIENT_ID,
    MS_CLIENT_SECRET: !!env.MS_CLIENT_SECRET,
    SLACK_BOT_TOKEN: !!env.SLACK_BOT_TOKEN,
    GOOGLE_CLIENT_ID: !!env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!env.GOOGLE_CLIENT_SECRET,
  };
  res.json(result);
});

// POST /api/settings — writes env vars (only allowed keys)
router.post('/', (req, res) => {
  const updates = {};
  for (const key of WRITABLE_KEYS) {
    if (key in req.body && req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }
  try {
    writeEnvFile(ENV_PATH, updates);
    // Reload into process.env
    Object.assign(process.env, updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
