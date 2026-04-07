// Slack service — Phase 5
// Will use @slack/web-api and @slack/socket-mode
export function getSlackClient() {
  if (!process.env.SLACK_BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN is not set');
  // Placeholder — install @slack/web-api when building Phase 5
  return null;
}
