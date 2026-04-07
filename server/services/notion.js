import { Client } from '@notionhq/client';

export function getNotionClient() {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error('NOTION_API_KEY is not set');

  // Debug: confirm key is loaded and looks correct (first 12 chars only)
  console.log(`[notion] using key: ${key.slice(0, 12)}… (len=${key.length})`);

  return new Client({ auth: key });
}

export async function testConnection() {
  const notion = getNotionClient();

  // Step 1: verify the token is accepted by Notion at all
  let botName;
  try {
    const me = await notion.users.me();
    botName = me.name;
  } catch (e) {
    throw new Error(
      `Token rejected by Notion — ${e.message}. ` +
      `Check the integration is still active at notion.so/profile/integrations.`
    );
  }

  // Step 2: verify the root page is accessible (integration must be connected to it)
  const pageId = process.env.NOTION_ROOT_PAGE_ID;
  if (!pageId) {
    return { bot: botName, page: null, warning: 'NOTION_ROOT_PAGE_ID not set — add it to .env' };
  }

  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    return { bot: botName, page: { id: page.id, url: page.url } };
  } catch (e) {
    // object_not_found / unauthorized here means the page exists but hasn't been
    // shared with this integration. Open the page in Notion → Share → invite the integration.
    throw new Error(
      `Token OK (bot="${botName}") but root page is not accessible — ` +
      `open the page in Notion, click Share, and connect the "${botName}" integration.`
    );
  }
}

/**
 * Saves a Claude CLI conversation session to the Daily Briefings Notion DB.
 * @param {string} title - Page title (e.g. "Claude CLI · 2026-04-07 14:30")
 * @param {Array<{role: string, content: string}>} messages
 */
export async function saveConversation(title, messages) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) throw new Error('NOTION_DB_DAILY_BRIEFINGS is not set');

  const children = buildBlocks(messages);

  await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: title } }],
      },
    },
    // Notion allows max 100 children per create call
    children: children.slice(0, 100),
  });
}

// ─── Notion block builders ────────────────────────────────────────────────────

const NOTION_LANG_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', sh: 'shell', bash: 'shell', zsh: 'shell',
  yml: 'yaml', md: 'markdown', Dockerfile: 'docker', '': 'plain text',
};

function mapLang(lang) {
  return NOTION_LANG_MAP[lang] ?? lang ?? 'plain text';
}

function parseCodeFences(text) {
  const parts = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1], content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return parts;
}

function buildBlocks(messages) {
  const blocks = [];

  for (const msg of messages) {
    // Speaker label
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'text',
            text: { content: msg.role === 'user' ? '▸ You' : '◆ Claude' },
          },
        ],
        color: msg.role === 'user' ? 'green' : 'blue',
      },
    });

    const parts = parseCodeFences(msg.content);

    for (const part of parts) {
      if (part.type === 'code') {
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [
              { type: 'text', text: { content: part.content.slice(0, 2000) } },
            ],
            language: mapLang(part.language),
          },
        });
      } else {
        // Split on double newlines into separate paragraphs
        const paras = part.content.split(/\n\n+/).filter((p) => p.trim());
        for (const para of paras) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: para.trim().slice(0, 2000) } },
              ],
            },
          });
        }
      }
    }

    blocks.push({ object: 'block', type: 'divider', divider: {} });
  }

  return blocks;
}
