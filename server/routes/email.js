import { Router } from 'express';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchUnreadGmailEmails } from '../services/gmail.js';
import { fetchUnreadOutlookEmails } from '../services/outlook.js';
import { generateEmailDigest } from '../services/claude.js';
import {
  saveEmailDigest,
  getLatestEmailDigestForDate,
  saveActionItems,
} from '../services/notion.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

router.get('/status', (_req, res) => {
  res.json({
    gmail: existsSync(resolve(__dirname, '../../google-credentials.json')),
    outlook: existsSync(resolve(__dirname, '../../ms-token.json')),
  });
});

router.get('/digest', async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const digest = await getLatestEmailDigestForDate(today);
    res.json(digest ?? null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/digest/generate', async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const today = new Date().toISOString().split('T')[0];

    const [gmailEmails, outlookEmails] = await Promise.all([
      fetchUnreadGmailEmails({ maxResults: 25 }).catch(e => {
        console.error('[email] Gmail fetch failed:', e.message);
        return [];
      }),
      fetchUnreadOutlookEmails({ maxResults: 25 }).catch(e => {
        console.error('[email] Outlook fetch failed:', e.message);
        return [];
      }),
    ]);

    let fullContent = '';
    for await (const text of generateEmailDigest({ date: today, gmailEmails, outlookEmails })) {
      fullContent += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    const actionLines = fullContent
      .split('\n')
      .filter(l => l.trim().startsWith('- [ ]'))
      .map(l => ({ text: l.replace(/^-\s\[\s\]\s*/, '').trim(), source: 'Email', sourceDetail: '' }));

    try { await saveEmailDigest(today, fullContent); } catch (e) { console.error('[email] Notion digest save failed:', e.message); }
    try { if (actionLines.length) await saveActionItems(actionLines); } catch (e) { console.error('[email] Notion action items save failed:', e.message); }

    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
