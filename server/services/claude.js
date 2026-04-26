import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `You are a personal AI assistant for Sanket, an Engineering Manager.
You help with technical problems, management decisions, writing, analysis, and anything else he needs.
Be direct, precise, and practical. Format code with proper markdown code fences and language identifiers.`;

export function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Streams a chat response, yielding text deltas.
 * @param {Array<{role: string, content: string}>} messages
 * @yields {string} text delta
 */
export async function* streamChat(messages) {
  const client = getAnthropicClient();
  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

/**
 * Generates a structured morning brief, streaming text deltas.
 * @param {{ today: string, overdue: Task[], dueToday: Task[], events: CalEvent[], travel: TravelEntry[] }} context
 * @yields {string} text delta
 */
export async function* generateMorningBrief({ today, overdue, dueToday, events, travel }) {
  const client = getAnthropicClient();

  const dayName = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const dateDisplay = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const taskLines = [
    ...overdue.map((t) => `- [OVERDUE] ${t.title}${t.dueDate ? ` (was due ${t.dueDate})` : ''}`),
    ...dueToday.map((t) => `- [DUE TODAY] ${t.title}`),
  ];

  const eventLines = events.map((e) => {
    const time = e.allDay
      ? 'All day'
      : new Date(e.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `- ${time}: ${e.title} (${e.source})`;
  });

  const travelLines = travel.map(
    (t) => `- ${t.title} (${t.startDate}–${t.endDate ?? t.startDate})`,
  );

  const contextBlock = [
    `Today: ${dayName}, ${dateDisplay}`,
    '',
    'Tasks:',
    taskLines.length ? taskLines.join('\n') : '- None',
    '',
    "Today's meetings:",
    eventLines.length ? eventLines.join('\n') : '- None',
    ...(travelLines.length
      ? ['', 'Personal travel/events (today or tomorrow):', ...travelLines]
      : []),
  ].join('\n');

  const prompt = `You are a personal assistant for Sanket, an Engineering Manager.
Generate a concise morning brief based on this context:

${contextBlock}

Format using these exact markdown sections (include all, even if empty):

## Good morning, Sanket

[One practical sentence about the day ahead — not cheerful, just grounded]

## Meetings today

[Each meeting on its own line with time and account source. If none: "No meetings scheduled."]

## Focus tasks

[Overdue tasks first, clearly flagged. Then tasks due today. If none: "You're clear on tasks today."]

## Personal flags

[Only if travel overlaps today or tomorrow and may affect work hours — flag briefly. If nothing: "Nothing flagged."]

Keep the whole brief under 250 words. Be direct.`;

  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

/**
 * Generates a Slack digest summary, streaming text deltas.
 * @param {{ date: string, channelDigests: Array<{ name: string, type: string, hasMention: boolean, messages: Array<{ user?: string, text?: string }> }> }} context
 * @yields {string} text delta
 */
export async function* generateSlackDigest({ date, channelDigests }) {
  const client = getAnthropicClient();

  const channelSummaries = channelDigests
    .map(ch => {
      const msgs = ch.messages
        .slice(0, 30)
        .map(m => `[${m.user || 'unknown'}]: ${(m.text || '').replace(/<[^>]+>/g, '').trim()}`)
        .join('\n');
      const tag = ch.hasMention ? ' ⚡ (you were mentioned)' : '';
      return `### ${ch.name} [${ch.type}]${tag}\n${msgs || '(no text messages)'}`;
    })
    .join('\n\n---\n\n');

  const prompt = `You are triaging Slack activity for ${date} for an Engineering Manager.

For each channel, write:
## [Channel Name]
**Summary:** 2-3 sentence summary of what was discussed.
**Action items:** bullet list of "- [ ] action" items requiring attention, or "None".
**Signal:** high / medium / low

Then write a final section:
## Channel Insights
- Channels with high signal worth monitoring closely
- Channels that appear low-signal and are candidates for muting
- Any patterns or trends worth noting

Be concise. Flag anything time-sensitive.

---
${channelSummaries}`;

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
