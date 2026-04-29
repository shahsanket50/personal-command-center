// All imports must come first in ESM
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import cors from 'cors';
import settingsRoutes from './routes/settings.js';
import notionRoutes from './routes/notion.js';
import claudeRoutes from './routes/claude.js';
import notesRoutes from './routes/notes.js';
import calendarRoutes from './routes/calendar.js';
import authRoutes from './routes/auth.js';
import briefRoutes from './routes/brief.js';
import slackRoutes from './routes/slack.js';
import emailRoutes from './routes/email.js';
import triageRoutes from './routes/triage.js';
import peopleRoutes from './routes/people.js';
import { runMigrations } from './services/db.js';

// Load .env using an explicit path relative to this file, not process.cwd().
// This means `cd server && npm run dev` and `node server/index.js` both work.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
const dotenvResult = dotenv.config({ path: envPath });

// All service modules read process.env lazily (inside functions, not at module init),
// so calling dotenv.config() here — before app.listen() — is correct timing.

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/settings', settingsRoutes);
app.use('/api/notion', notionRoutes);
app.use('/api/claude', claudeRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/brief', briefRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/people', peopleRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Production: serve built client files
if (process.env.NODE_ENV === 'production') {
  const clientDist = new URL('../client/dist', import.meta.url).pathname;
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(new URL('../client/dist/index.html', import.meta.url).pathname);
  });
}

async function start() {
  if (process.env.DATABASE_URL) {
    try {
      await runMigrations();
      console.log('✓ DB migrations complete');
    } catch (e) {
      console.error('✗ DB migration failed:', e.message);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log(`Loading .env from: ${envPath}`);

    if (dotenvResult.error) {
      console.warn(`⚠  .env not found — ${dotenvResult.error.message}`);
      return;
    }

    const loaded = Object.keys(dotenvResult.parsed || {});
    const set = loaded.filter((k) => process.env[k]);
    const empty = loaded.filter((k) => !process.env[k]);

    console.log(`\nEnv vars loaded (${set.length}/${loaded.length} non-empty):`);
    set.forEach((k) => console.log(`  ✓ ${k}`));
    if (empty.length) {
      console.log(`\nPresent but empty:`);
      empty.forEach((k) => console.log(`  ○ ${k}`));
    }

    const critical = ['ANTHROPIC_API_KEY'];
    const missing = critical.filter((k) => !process.env[k]);
    if (missing.length) {
      console.warn(`\n⚠  Missing critical keys: ${missing.join(', ')}`);
    }

    console.log('');
  });
}

start();
