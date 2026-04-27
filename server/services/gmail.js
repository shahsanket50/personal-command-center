// Gmail service — personal account only (Phase 6)
// Auth: Google OAuth2 via googleapis
// Token stored in google-credentials.json (gitignored)
// Reuses the same token file and OAuth2 client pattern as calendar.js

import { google } from 'googleapis';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = resolve(__dirname, '../../google-credentials.json');
const GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';

async function getGmailAuth() {
  if (!existsSync(TOKEN_PATH)) throw new Error('Google not authorized — run Google OAuth first');

  const raw = await readFile(TOKEN_PATH, 'utf8');
  const tokens = JSON.parse(raw);

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
  auth.setCredentials(tokens);

  // Persist refreshed tokens automatically (mirrors calendar.js pattern)
  auth.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2)).catch(() => {});
  });

  return auth;
}

export async function fetchUnreadGmailEmails({ maxResults = 30 } = {}) {
  const auth = await getGmailAuth();
  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults,
  });

  const messages = listRes.data.messages || [];
  if (!messages.length) return [];

  const details = await Promise.all(
    messages.slice(0, 20).map(m =>
      gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      }).then(r => r.data).catch(() => null)
    )
  );

  return details
    .filter(Boolean)
    .map(msg => {
      const headers = Object.fromEntries(
        (msg.payload?.headers || []).map(h => [h.name, h.value])
      );
      return {
        id: msg.id,
        subject: headers.Subject || '(no subject)',
        from: headers.From || 'unknown',
        date: headers.Date || '',
        snippet: msg.snippet || '',
        account: 'personal',
        source: 'Gmail',
      };
    });
}
