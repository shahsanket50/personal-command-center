import { Router } from 'express';
import { getPeople, getPersonById } from '../services/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try { res.json(await getPeople()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try { res.json(await getPersonById(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
