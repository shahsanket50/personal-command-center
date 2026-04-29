// Microsoft Graph service — bearer token auth (no Azure AD app registration required)
// User obtains token from Graph Explorer and pastes into Settings.
// Token stored in ms-token.json: { token: string, savedAt: ISO string }

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MS_TOKEN_PATH = path.resolve(__dirname, '../../ms-token.json');

export async function saveMSToken(token) {
  await writeFile(MS_TOKEN_PATH, JSON.stringify({ token, savedAt: new Date().toISOString() }, null, 2));
}

export async function getMSTokenStatus() {
  try {
    const raw = await readFile(MS_TOKEN_PATH, 'utf8');
    const { token, savedAt } = JSON.parse(raw);
    if (!token) return { set: false, ageMinutes: 0, expired: true };
    const ageMinutes = Math.floor((Date.now() - new Date(savedAt).getTime()) / 60000);
    return { set: true, ageMinutes, expired: ageMinutes >= 60 };
  } catch {
    return { set: false, ageMinutes: 0, expired: true };
  }
}

export async function isMSConnected() {
  const { set } = await getMSTokenStatus();
  return set;
}

export async function getMSAccessToken() {
  let cached;
  try {
    const raw = await readFile(MS_TOKEN_PATH, 'utf8');
    cached = JSON.parse(raw);
  } catch {
    throw new Error('MS_NOT_CONNECTED');
  }

  if (!cached.token) throw new Error('MS_NOT_CONNECTED');

  const ageMinutes = Math.floor((Date.now() - new Date(cached.savedAt).getTime()) / 60000);
  if (ageMinutes >= 60) throw new Error('MS_TOKEN_EXPIRED');

  return cached.token;
}

export async function fetchUnreadOutlookEmails({ maxResults = 30 } = {}) {
  const accessToken = await getMSAccessToken();

  const url =
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages` +
    `?$filter=isRead%20eq%20false` +
    `&$select=subject,from,receivedDateTime,bodyPreview` +
    `&$orderby=receivedDateTime%20desc` +
    `&$top=${maxResults}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (res.status === 401) throw new Error('MS_TOKEN_EXPIRED');
  if (!res.ok) throw new Error(`Microsoft Graph mail fetch failed (${res.status})`);

  const data = await res.json();
  return (data.value || []).map(msg => ({
    id: msg.id,
    subject: msg.subject || '(no subject)',
    from: msg.from?.emailAddress?.address || 'unknown',
    date: msg.receivedDateTime || '',
    snippet: msg.bodyPreview || '',
    account: 'office',
    source: 'Outlook',
  }));
}
