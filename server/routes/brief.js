import { Router } from 'express';
import { getMergedEvents } from '../services/calendar.js';
import {
  getOverdueTasks,
  getDueTodayTasks,
  getTravelEntries,
  saveBriefing,
  getLatestBriefingForDate,
  listBriefings,
  getBriefingById,
} from '../services/db.js';
import { generateMorningBrief } from '../services/claude.js';

const router = Router();

// GET /api/brief/today — returns cached brief for today or null
router.get('/today', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const brief = await getLatestBriefingForDate(today);
    res.json(brief ?? null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/brief/generate — SSE stream; gathers context, generates, saves to Notion
router.post('/generate', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // Three parallel Notion reads (within 3 req/s limit) + one calendar fetch
    const [overdue, dueToday, travel, events] = await Promise.all([
      getOverdueTasks().catch(() => []),
      getDueTodayTasks(today).catch(() => []),
      getTravelEntries().catch(() => []),
      getMergedEvents(today).catch(() => []),
    ]);

    // Filter travel entries that overlap today or tomorrow
    const tomorrow = new Date(`${today}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const relevantTravel = travel.filter((t) => {
      if (!t.startDate) return false;
      const start = t.startDate.slice(0, 10);
      const end = (t.endDate ?? t.startDate).slice(0, 10);
      return start <= tomorrowStr && end >= today;
    });

    let fullContent = '';

    for await (const text of generateMorningBrief({
      today,
      overdue,
      dueToday,
      events,
      travel: relevantTravel,
    })) {
      fullContent += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    // Save to Notion after full generation — non-fatal if it fails
    try {
      await saveBriefing(today, fullContent);
    } catch (notionErr) {
      console.error('[brief] Notion save failed:', notionErr.message);
    }

    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

// GET /api/brief/history — list of all past morning briefs
router.get('/history', async (_req, res) => {
  try {
    const list = await listBriefings();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/brief/:id — fetch a specific brief by Notion page ID
router.get('/:id', async (req, res) => {
  try {
    const brief = await getBriefingById(req.params.id);
    if (!brief) return res.status(404).json({ error: 'not found' });
    res.json(brief);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
