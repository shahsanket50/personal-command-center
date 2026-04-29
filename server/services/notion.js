import { Client } from '@notionhq/client';

export function getNotionClient() {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error('NOTION_API_KEY is not set');

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

// ─── Daily Notes ─────────────────────────────────────────────────────────────

/**
 * Fetch or create today's daily note page in NOTION_DB_DAILY_BRIEFINGS.
 * Identified by title format "Daily Note · YYYY-MM-DD".
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {{ id: string, content: string }}
 */
export async function getDailyNote(dateStr) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) throw new Error('NOTION_DB_DAILY_BRIEFINGS is not set');

  const pageTitle = `Daily Note · ${dateStr}`;

  const { results } = await notion.databases.query({
    database_id: dbId,
    filter: { property: 'title', title: { equals: pageTitle } },
    page_size: 1,
  });

  if (results.length > 0) {
    const page = results[0];
    const blocks = await notion.blocks.children.list({ block_id: page.id });
    const content = blocks.results
      .filter((b) => b.type === 'paragraph')
      .map((b) => b.paragraph.rich_text.map((t) => t.plain_text).join(''))
      .join('\n\n');
    return { id: page.id, content };
  }

  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      title: { title: [{ type: 'text', text: { content: pageTitle } }] },
    },
  });

  return { id: page.id, content: '' };
}

/**
 * Overwrite a daily note page's paragraph blocks with new content.
 * @param {string} pageId
 * @param {string} content
 */
export async function saveDailyNote(pageId, content) {
  const notion = getNotionClient();

  const { results: existing } = await notion.blocks.children.list({ block_id: pageId });
  for (const block of existing) {
    if (block.type === 'paragraph') {
      await notion.blocks.delete({ block_id: block.id });
    }
  }

  if (!content.trim()) return;

  const paras = content.split(/\n\n+/).filter((p) => p.trim());
  const children = paras.map((p) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: p.trim().slice(0, 2000) } }],
    },
  }));

  await notion.blocks.children.append({
    block_id: pageId,
    children: children.slice(0, 100),
  });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

function mapTask(page) {
  const props = page.properties;
  // Support both "Name" and bare title property
  const titleProp = props.Name ?? props.title ?? Object.values(props).find((p) => p.type === 'title');
  return {
    id: page.id,
    title: titleProp?.title?.[0]?.plain_text ?? '',
    status: props.Status?.status?.name ?? 'Not started',
    dueDate: props['Due Date']?.date?.start ?? null,
  };
}

export async function getTasks() {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_TASKS;
  if (!dbId) throw new Error('NOTION_DB_TASKS is not set');

  const { results } = await notion.databases.query({
    database_id: dbId,
    sorts: [{ property: 'Due Date', direction: 'ascending' }],
  });

  return results.map(mapTask);
}

export async function getOverdueTasks() {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_TASKS;
  if (!dbId) return [];

  const today = new Date().toISOString().split('T')[0];

  const { results } = await notion.databases.query({
    database_id: dbId,
    filter: {
      and: [
        { property: 'Due Date', date: { before: today } },
        { property: 'Status', status: { does_not_equal: 'Done' } },
      ],
    },
  });

  return results.map(mapTask);
}

export async function createTask(title, dueDate) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_TASKS;
  if (!dbId) throw new Error('NOTION_DB_TASKS is not set');

  const properties = {
    Title: { title: [{ type: 'text', text: { content: title } }] },
    Status: { status: { name: 'Not started' } },
  };

  if (dueDate) {
    properties['Due Date'] = { date: { start: dueDate } };
  }

  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties,
  });

  return mapTask(page);
}

export async function updateTask(pageId, updates) {
  const notion = getNotionClient();

  const properties = {};
  if (updates.status !== undefined) {
    properties['Status'] = { status: { name: updates.status } };
  }
  if (updates.title !== undefined) {
    properties['Title'] = { title: [{ type: 'text', text: { content: updates.title } }] };
  }
  if ('dueDate' in updates) {
    properties['Due Date'] = updates.dueDate ? { date: { start: updates.dueDate } } : { date: null };
  }

  const page = await notion.pages.update({ page_id: pageId, properties });
  return mapTask(page);
}

// ─── Morning Brief ────────────────────────────────────────────────────────────

/**
 * Fetch tasks due exactly on dateStr (not done).
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
export async function getDueTodayTasks(dateStr) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_TASKS;
  if (!dbId) return [];

  try {
    const { results } = await notion.databases.query({
      database_id: dbId,
      filter: {
        and: [
          { property: 'Due Date', date: { equals: dateStr } },
          { property: 'Status', select: { does_not_equal: 'Done' } },
        ],
      },
    });
    return results.map(mapTask);
  } catch {
    return [];
  }
}

/**
 * Save a morning brief (markdown string) to the Daily Briefings DB as Notion blocks.
 * Title format: "Morning Brief · YYYY-MM-DD"
 */
export async function saveBriefing(dateStr, content) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) throw new Error('NOTION_DB_DAILY_BRIEFINGS is not set');

  const blocks = briefMarkdownToBlocks(content);

  await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: `Morning Brief · ${dateStr}` } }],
      },
    },
    children: blocks.slice(0, 100),
  });
}

/**
 * Fetch the most recent morning brief for a given date from Notion.
 * Returns null if none exists.
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
export async function getLatestBriefingForDate(dateStr) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) return null;

  try {
    const { results } = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: 'title',
        title: { starts_with: `Morning Brief · ${dateStr}` },
      },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 1,
    });

    if (!results.length) return null;

    const page = results[0];
    const { results: blocks } = await notion.blocks.children.list({ block_id: page.id });
    const content = reconstructBriefMarkdown(blocks);

    return { id: page.id, content, createdAt: page.created_time };
  } catch {
    return null;
  }
}

export async function listBriefings() {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) return [];

  try {
    const { results } = await notion.databases.query({
      database_id: dbId,
      filter: { property: 'title', title: { starts_with: 'Morning Brief · ' } },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 30,
    });

    return results.map((page) => {
      const title = page.properties.title?.title?.map((t) => t.plain_text).join('') ?? '';
      const date = title.replace('Morning Brief · ', '');
      return { id: page.id, date, title };
    });
  } catch {
    return [];
  }
}

export async function getBriefingById(pageId) {
  const notion = getNotionClient();
  try {
    const [page, { results: blocks }] = await Promise.all([
      notion.pages.retrieve({ page_id: pageId }),
      notion.blocks.children.list({ block_id: pageId }),
    ]);
    const content = reconstructBriefMarkdown(blocks);
    return { id: page.id, content, createdAt: page.created_time };
  } catch {
    return null;
  }
}

function briefMarkdownToBlocks(content) {
  const blocks = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: line.slice(3).trim() } }],
        },
      });
    } else if (line.startsWith('- ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: line.slice(2).trim().slice(0, 2000) } }],
        },
      });
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: line.trim().slice(0, 2000) } }],
        },
      });
    }
  }
  return blocks;
}

function reconstructBriefMarkdown(blocks) {
  const lines = [];
  for (const block of blocks) {
    const text = (t) => block[t]?.rich_text?.map((r) => r.plain_text).join('') ?? '';
    if (block.type === 'heading_2') {
      if (lines.length > 0) lines.push('');
      lines.push('## ' + text('heading_2'));
    } else if (block.type === 'bulleted_list_item') {
      lines.push('- ' + text('bulleted_list_item'));
    } else if (block.type === 'paragraph') {
      const t = text('paragraph');
      if (t) lines.push(t);
    }
  }
  return lines.join('\n');
}

// ─── Travel Bookings (for Calendar OOO flags) ─────────────────────────────────

/**
 * Fetch travel entries from Notion for Calendar OOO flagging.
 * Returns [] gracefully if DB is not configured or accessible.
 */
export async function getTravelEntries() {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_TRAVEL_BOOKINGS;
  if (!dbId) return [];

  try {
    const { results } = await notion.databases.query({
      database_id: dbId,
      sorts: [{ property: 'Start Date', direction: 'ascending' }],
    });

    return results.map((page) => {
      const props = page.properties;
      const titleProp = props.Name ?? props.title ?? Object.values(props).find((p) => p.type === 'title');
      return {
        id: page.id,
        title: titleProp?.title?.[0]?.plain_text ?? '',
        startDate: props['Start Date']?.date?.start ?? null,
        endDate: props['End Date']?.date?.start ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ─── Slack Digest ─────────────────────────────────────────────────────────────

/**
 * Save a Slack digest (markdown string) to the Daily Briefings DB as Notion blocks.
 * Title format: "Slack Digest · YYYY-MM-DD"
 */
export async function saveSlackDigest(date, markdownContent) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) throw new Error('NOTION_DB_DAILY_BRIEFINGS not set');

  const title = `Slack Digest · ${date}`;
  const blocks = briefMarkdownToBlocks(markdownContent);

  await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      title: { title: [{ text: { content: title } }] },
    },
    children: blocks.slice(0, 100),
  });
}

/**
 * Fetch the most recent Slack digest for a given date from Notion.
 * Returns null if none exists.
 * @param {string} date - 'YYYY-MM-DD'
 */
export async function getLatestSlackDigestForDate(date) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) throw new Error('NOTION_DB_DAILY_BRIEFINGS not set');

  const title = `Slack Digest · ${date}`;
  const response = await notion.databases.query({
    database_id: dbId,
    filter: { property: 'title', title: { equals: title } },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 1,
  });

  if (!response.results.length) return null;

  const page = response.results[0];
  const { results: blocks } = await notion.blocks.children.list({ block_id: page.id });
  return reconstructBriefMarkdown(blocks);
}

/**
 * Save action items to the Action Items DB.
 * Action Items DB schema: only has Name (title) — no Source/Status fields.
 * @param {Array<{ text: string, source: string, sourceDetail: string }>} items
 */
export async function saveActionItems(items) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_ACTION_ITEMS;
  if (!dbId) throw new Error('NOTION_DB_ACTION_ITEMS not set');

  await Promise.all(
    items.map(item =>
      notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          Name: { title: [{ text: { content: item.text } }] },
        },
      })
    )
  );
}

// ─── Email Digest ─────────────────────────────────────────────────────────────

/**
 * Save an email digest (markdown string) to the Daily Briefings DB as Notion blocks.
 * Title format: "Email Digest · YYYY-MM-DD"
 */
export async function saveEmailDigest(date, markdownContent) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) throw new Error('NOTION_DB_DAILY_BRIEFINGS not set');

  const title = `Email Digest · ${date}`;
  const blocks = briefMarkdownToBlocks(markdownContent);

  await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      title: { title: [{ text: { content: title } }] },
    },
    children: blocks.slice(0, 100),
  });
}

/**
 * Fetch the most recent email digest for a given date from Notion.
 * Returns null if none exists.
 * @param {string} date - 'YYYY-MM-DD'
 */
export async function getLatestEmailDigestForDate(date) {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) throw new Error('NOTION_DB_DAILY_BRIEFINGS not set');

  const title = `Email Digest · ${date}`;
  const response = await notion.databases.query({
    database_id: dbId,
    filter: { property: 'title', title: { equals: title } },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 1,
  });

  if (!response.results.length) return null;

  const page = response.results[0];
  const { results: blocks } = await notion.blocks.children.list({ block_id: page.id });
  return reconstructBriefMarkdown(blocks);
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

// ─── People ───────────────────────────────────────────────────────────────────

export async function getPeople() {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_PEOPLE;
  if (!dbId) throw new Error('NOTION_DB_PEOPLE not set');

  const response = await notion.databases.query({
    database_id: dbId,
    sorts: [{ property: 'Name', direction: 'ascending' }],
    page_size: 50,
  });

  return response.results.map((page) => {
    const props = page.properties;
    const name = (props.Name?.title ?? []).map(b => b.plain_text).join('');
    // Role is rich_text in this DB
    const role = (props.Role?.rich_text ?? []).map(b => b.plain_text).join('');
    return {
      id: page.id,
      name,
      role,
      initials: name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
      last1on1: null, // No date property in People DB
      notionUrl: page.url,
      ooo: false,
    };
  });
}

export async function getPersonById(pageId) {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: pageId });
  const props = page.properties;
  const name = (props.Name?.title ?? []).map(b => b.plain_text).join('');
  const role = (props.Role?.rich_text ?? []).map(b => b.plain_text).join('');
  return {
    id: page.id,
    name,
    role,
    initials: name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
    last1on1: null, // No date property in People DB
    notionUrl: page.url,
    ooo: false,
  };
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
