import express from 'express';
import { getMergedEvents, getGoogleEvents, getMSEvents, isGoogleConnected } from '../services/calendar.js';
import { isMSConnected, getMSAccessToken } from '../services/outlook.js';
import { getTravelEntries } from '../services/db.js';

const router = express.Router();

// GET /api/calendar/status — which accounts are connected
router.get('/status', async (_req, res) => {
  const [googleConnected, msConnected] = await Promise.all([
    isGoogleConnected().catch(() => false),
    isMSConnected().catch(() => false),
  ]);
  res.json({ google: googleConnected, microsoft: msConnected });
});

// GET /api/calendar/events?date=YYYY-MM-DD
router.get('/events', async (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  try {
    let msError = false;
    // Check MS token status before merging — getMSEvents swallows errors silently
    await getMSAccessToken().catch(e => {
      if (e.message === 'MS_TOKEN_EXPIRED' || e.message === 'MS_NOT_CONNECTED') {
        msError = true;
      } else {
        throw e;
      }
    });

    const [googleEvents, msEvents] = await Promise.all([
      getGoogleEvents(dateStr).catch(() => []),
      msError ? [] : getMSEvents(dateStr).catch(() => []),
    ]);

    const events = [...googleEvents, ...msEvents];
    events.sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return new Date(a.start) - new Date(b.start);
    });

    res.json({ events, msError });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/calendar/travel — Notion travel entries for OOO flags
router.get('/travel', async (_req, res) => {
  try {
    const entries = await getTravelEntries();
    res.json(entries);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
