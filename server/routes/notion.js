import { Router } from 'express';
import { testConnection } from '../services/notion.js';

const router = Router();

// GET /api/notion/test
router.get('/test', async (_req, res) => {
  try {
    const result = await testConnection();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
