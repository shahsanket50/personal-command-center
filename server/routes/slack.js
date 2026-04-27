import { Router } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchDigestData, getJoinedChannels, getAuthInfo } from '../services/slack.js';
import { generateSlackDigest } from '../services/claude.js';
import {
  saveSlackDigest,
  getLatestSlackDigestForDate,
  saveActionItems,
} from '../services/notion.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env');

function persistEnvVar(key, value) {
  let content = '';
  try { content = readFileSync(envPath, 'utf8'); } catch { content = ''; }

  const lines = content.split('\n');
  const idx = lines.findIndex(l => l.startsWith(`${key}=`));
  const newLine = `${key}=${value}`;
  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    lines.push(newLine);
  }
  writeFileSync(envPath, lines.join('\n'));
  process.env[key] = value;
}

router.get('/channels', async (_req, res) => {
  try {
    const channels = await getJoinedChannels();
    res.json(channels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/digest', async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const digest = await getLatestSlackDigestForDate(today);
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
    const { user_id: botUserId } = await getAuthInfo();
    const channelDigests = await fetchDigestData(botUserId);

    if (channelDigests.length === 0) {
      res.write(`data: ${JSON.stringify({ text: 'No Slack activity in the last 24 hours.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    let fullContent = '';
    for await (const text of generateSlackDigest({ date: today, channelDigests })) {
      fullContent += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    // Extract action items (lines starting with "- [ ]")
    const actionLines = fullContent
      .split('\n')
      .filter(l => l.trim().startsWith('- [ ]'))
      .map(l => ({ text: l.replace(/^-\s\[\s\]\s*/, '').trim(), source: 'Slack', sourceDetail: '' }));

    try { await saveSlackDigest(today, fullContent); } catch (e) { console.error('[slack] Notion digest save failed:', e.message); }
    try { if (actionLines.length) await saveActionItems(actionLines); } catch (e) { console.error('[slack] Notion action items save failed:', e.message); }

    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

router.post('/blacklist', async (req, res) => {
  try {
    const { channelIds } = req.body;
    if (!Array.isArray(channelIds)) return res.status(400).json({ error: 'channelIds must be an array' });
    persistEnvVar('SLACK_BLACKLIST_CHANNELS', channelIds.join(','));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
