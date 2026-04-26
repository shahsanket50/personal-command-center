import { Router } from 'express';
import { fetchDigestData, getAuthInfo } from '../services/slack.js';
import { fetchUnreadGmailEmails } from '../services/gmail.js';
import { fetchUnreadOutlookEmails } from '../services/outlook.js';
import { getMergedEvents } from '../services/calendar.js';

const router = Router();

function classifySlack(msg, botUserId) {
  if (msg.channelType === 'im' || msg.channelType === 'mpim') return 'dm';
  if (msg.text?.includes(`<@${botUserId}>`)) return 'mention';
  return 'broadcast';
}

function classifyEmail(email) {
  const from = (email.from ?? '').toLowerCase();
  if (/noreply|no-reply|notifications?@|digest|newsletter/i.test(from)) return 'fyi';
  return 'reply';
}

function ageLabel(dateInput) {
  if (!dateInput) return '';
  const ms = Date.now() - new Date(dateInput).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// GET /api/triage/items
router.get('/items', async (_req, res) => {
  const items = [];

  // Slack
  await (async () => {
    try {
      const { user_id: botUserId } = await getAuthInfo();
      const channels = await fetchDigestData(botUserId);
      for (const ch of channels) {
        for (const msg of ch.messages.slice(0, 10)) {
          const lane = classifySlack({ ...msg, channelType: ch.type }, botUserId);
          const urgentKeywords = /urgent|eod|asap/i.test(msg.text ?? '');
          const mentionsYou = msg.text?.includes(`<@${botUserId}>`);
          items.push({
            id: `slack-${msg.ts}`,
            kind: 'slack',
            lane,
            from: msg.user ?? 'unknown',
            channel: ch.name,
            preview: (msg.text ?? '').replace(/<[^>]+>/g, '').slice(0, 120),
            age: ageLabel(msg.ts ? new Date(parseFloat(msg.ts) * 1000) : null),
            urgent: urgentKeywords || mentionsYou,
          });
        }
      }
    } catch (e) {
      console.error('[triage] Slack error:', e.message);
    }
  })();

  // Email
  await (async () => {
    try {
      const [gmail, outlook] = await Promise.all([
        fetchUnreadGmailEmails({ maxResults: 20 }).catch(() => []),
        fetchUnreadOutlookEmails({ maxResults: 20 }).catch(() => []),
      ]);
      for (const email of [...gmail, ...outlook]) {
        items.push({
          id: `email-${email.id}`,
          kind: 'email',
          lane: classifyEmail(email),
          from: email.from,
          subject: email.subject,
          preview: email.snippet,
          age: ageLabel(email.date),
          urgent: /urgent|eod|asap/i.test((email.subject ?? '') + (email.snippet ?? '')),
          account: email.account,
        });
      }
    } catch (e) {
      console.error('[triage] Email error:', e.message);
    }
  })();

  // Calendar invites (pending RSVPs)
  await (async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const events = await getMergedEvents(today);
      for (const ev of events) {
        const status = ev.selfResponseStatus ?? ev.responseStatus;
        if (status === 'needsAction' || status === 'notResponded') {
          items.push({
            id: `cal-${ev.id}`,
            kind: 'cal',
            lane: 'invite',
            from: 'Calendar',
            subject: ev.summary ?? '(no title)',
            preview: `${ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''} · ${ev.attendeeCount ?? 0} attendees`,
            age: '',
            urgent: false,
          });
        }
      }
    } catch (e) {
      console.error('[triage] Calendar error:', e.message);
    }
  })();

  res.json(items);
});

export default router;
