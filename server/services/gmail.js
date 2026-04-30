import { google } from 'googleapis';
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = resolve(__dirname, '../../google-credentials.json');
const GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';

// Returns an authenticated OAuth2 client, or null if not connected.
// Mirrors the pattern in calendar.js — callers should treat null as "not connected".
async function getGmailAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  let tokens;
  try {
    const raw = await readFile(TOKEN_PATH, 'utf8');
    tokens = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!tokens?.access_token && !tokens?.refresh_token) return null; // stub file — not connected

  const auth = new google.auth.OAuth2(clientId, clientSecret, GOOGLE_REDIRECT_URI);
  auth.setCredentials(tokens);

  auth.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2)).catch(() => {});
  });

  return auth;
}

export async function fetchUnreadGmailEmails({ maxResults = 30 } = {}) {
  const auth = await getGmailAuth();
  if (!auth) return [];

  const gmail = google.gmail({ version: 'v1', auth });

  let listRes;
  try {
    listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults,
    });
  } catch (err) {
    if (err.status === 403 || err.message?.includes('insufficient authentication scopes')) {
      console.warn('[gmail] Token lacks gmail.readonly scope — re-authorize Google in Settings');
      return [];
    }
    throw err;
  }

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
