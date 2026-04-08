import express from 'express';
import { getGoogleAuthUrl, handleGoogleCallback } from '../services/calendar.js';
import { getMSAuthUrl, handleMSCallback } from '../services/outlook.js';

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

// ─── Microsoft OAuth ──────────────────────────────────────────────────────────

router.get('/microsoft', async (_req, res) => {
  try {
    const url = await getMSAuthUrl();
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`Microsoft OAuth not configured: ${e.message}`);
  }
});

router.get('/microsoft/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect('http://localhost:5173/calendar?auth=ms_error');
  }
  try {
    await handleMSCallback(String(code));
    res.redirect('http://localhost:5173/calendar?auth=ms_ok');
  } catch {
    res.redirect('http://localhost:5173/calendar?auth=ms_error');
  }
});

export default router;
