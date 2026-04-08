import express from 'express';
import {
  getDailyNote,
  saveDailyNote,
  getTasks,
  getOverdueTasks,
  createTask,
  updateTask,
} from '../services/notion.js';

const router = express.Router();

// GET /api/notes/today — fetch or create today's daily note
router.get('/today', async (_req, res) => {
  const dateStr = new Date().toISOString().split('T')[0];
  try {
    const note = await getDailyNote(dateStr);
    res.json(note);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/notes/today — save daily note content
router.put('/today', async (req, res) => {
  const { id, content } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    await saveDailyNote(id, content ?? '');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/notes/tasks/overdue — must be before /tasks/:id to avoid route conflict
router.get('/tasks/overdue', async (_req, res) => {
  try {
    const tasks = await getOverdueTasks();
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/notes/tasks
router.get('/tasks', async (_req, res) => {
  try {
    const tasks = await getTasks();
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notes/tasks
router.post('/tasks', async (req, res) => {
  const { title, dueDate } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const task = await createTask(title.trim(), dueDate ?? null);
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/notes/tasks/:id
router.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const task = await updateTask(id, updates);
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
