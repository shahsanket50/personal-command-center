import { Router } from 'express';
import { streamChat } from '../services/claude.js';
import { saveConversation, listConversations, getConversationById } from '../services/db.js';

const router = Router();

/**
 * POST /api/claude/chat
 * Body: { messages: [{role, content}] }
 * Response: SSE stream — `data: {"text":"..."}` chunks, ends with `data: [DONE]`
 */
router.post('/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    for await (const text of streamChat(messages)) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

/**
 * POST /api/claude/save
 * Body: { messages: [{role, content}], title?: string }
 * Saves the conversation to the Notion Daily Briefings DB.
 */
router.post('/save', async (req, res) => {
  const { messages, title } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const pageTitle =
    title ||
    `Claude CLI · ${new Date().toLocaleDateString('en-CA')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  try {
    await saveConversation(pageTitle, messages);
    res.json({ ok: true, title: pageTitle });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/claude/sessions — list all saved Claude CLI sessions
router.get('/sessions', async (_req, res) => {
  try {
    const sessions = await listConversations();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/claude/sessions/:id — fetch full messages for a session
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await getConversationById(req.params.id);
    if (!session) return res.status(404).json({ error: 'not found' });
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
