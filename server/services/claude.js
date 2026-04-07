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
