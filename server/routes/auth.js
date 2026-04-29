import express from 'express';
import { getGoogleAuthUrl, handleGoogleCallback } from '../services/calendar.js';

const router = express.Router();

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get('/google', (_req, res) => {
  try {
    const url = getGoogleAuthUrl();
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`Google OAuth not configured: ${e.message}`);
  }
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect('http://localhost:5173/calendar?auth=google_error');
  }
  try {
    await handleGoogleCallback(String(code));
    res.redirect('http://localhost:5173/calendar?auth=google_ok');
  } catch {
    res.redirect('http://localhost:5173/calendar?auth=google_error');
  }
});

// Microsoft auth is now bearer-token based (no OAuth callback needed).
// Token is saved via POST /api/settings/ms-token.

export default router;
