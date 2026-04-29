# Spec B — Brief History + Claude Chat History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent history sidebars to BriefPage (browse past morning briefs) and ClaudePage (browse and continue past Claude sessions), backed by two new route groups that query Notion.

**Architecture:** Four new Notion helper functions in `notion.js` (list + get by ID for briefs and conversations). Two new route groups added to existing brief and claude route files. Both MC pages gain a 140–150px left sidebar that lists past entries; clicking loads content into the main panel. Claude sessions load as a continuable messages array.

**Tech Stack:** Express (existing), Notion SDK (existing), React (existing), `useTheme()` hook (existing pattern)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/services/notion.js` | Modify | Add `listBriefings`, `getBriefingById`, `listConversations`, `getConversationById` |
| `server/routes/brief.js` | Modify | Add `GET /api/brief/history` and `GET /api/brief/:id` |
| `server/routes/claude.js` | Modify | Add `GET /api/claude/sessions` and `GET /api/claude/sessions/:id` |
| `client/src/mission-control/pages/BriefPage.jsx` | Modify | Add left history sidebar |
| `client/src/mission-control/pages/ClaudePage.jsx` | Modify | Add left sessions sidebar, load/continue sessions |

---

## Task 1: Add brief history helpers to notion.js

**Files:**
- Modify: `server/services/notion.js`

**Context:** `NOTION_DB_DAILY_BRIEFINGS` stores morning briefs with titles like `Morning Brief · 2026-04-27`. `reconstructBriefMarkdown` already exists at line ~343 and converts Notion blocks back to markdown. `getLatestBriefingForDate` at line 282 shows the query pattern.

- [ ] **Step 1: Add `listBriefings` after `getLatestBriefingForDate`**

Append after the closing `}` of `getLatestBriefingForDate` (around line 310):

```js
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
```

- [ ] **Step 2: Smoke-test from terminal**

```bash
cd /path/to/repo
node -e "
import('./server/services/notion.js').then(async m => {
  const list = await m.listBriefings();
  console.log('briefs:', list.length, list[0]);
}).catch(console.error);
"
```

Expected: array of `{ id, date, title }` objects. Length ≥ 0 (0 is OK if no briefs saved yet).

- [ ] **Step 3: Commit**

```bash
git add server/services/notion.js
git commit -m "feat(history): add listBriefings and getBriefingById to notion.js"
```

---

## Task 2: Add conversation history helpers to notion.js

**Files:**
- Modify: `server/services/notion.js`

**Context:** `saveConversation` at line 49 saves Claude sessions with title `Claude CLI · YYYY-MM-DD HH:MM`. It serialises messages as `heading_3` blocks (`▸ You` / `◆ Claude`) followed by `paragraph` and `code` blocks. `getConversationById` must reverse this.

- [ ] **Step 1: Add `listConversations` and `getConversationById` after `saveConversation`**

Append after the closing `}` of `saveConversation` (around line 68):

```js
export async function listConversations() {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_DB_DAILY_BRIEFINGS;
  if (!dbId) return [];

  try {
    const { results } = await notion.databases.query({
      database_id: dbId,
      filter: { property: 'title', title: { starts_with: 'Claude CLI · ' } },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 50,
    });

    return results.map((page) => {
      const title = page.properties.title?.title?.map((t) => t.plain_text).join('') ?? '';
      // title format: "Claude CLI · 2026-04-26 14:32"
      const datePart = title.replace('Claude CLI · ', '');
      return { id: page.id, title, date: datePart.slice(0, 10) };
    });
  } catch {
    return [];
  }
}

export async function getConversationById(pageId) {
  const notion = getNotionClient();
  try {
    const { results: blocks } = await notion.blocks.children.list({ block_id: pageId });
    const messages = [];
    let current = null;

    for (const block of blocks) {
      if (block.type === 'heading_3') {
        if (current) messages.push(current);
        const text = block.heading_3.rich_text.map((r) => r.plain_text).join('');
        const role = text.includes('You') ? 'user' : 'assistant';
        current = { role, content: '' };
      } else if (current) {
        let text = '';
        if (block.type === 'paragraph') {
          text = block.paragraph.rich_text.map((r) => r.plain_text).join('');
        } else if (block.type === 'code') {
          const lang = block.code.language ?? '';
          const code = block.code.rich_text.map((r) => r.plain_text).join('');
          text = `\`\`\`${lang}\n${code}\n\`\`\``;
        }
        if (text) {
          current.content = current.content ? `${current.content}\n\n${text}` : text;
        }
      }
    }
    if (current) messages.push(current);

    return { id: pageId, messages };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Smoke-test from terminal**

```bash
node -e "
import('./server/services/notion.js').then(async m => {
  const sessions = await m.listConversations();
  console.log('sessions:', sessions.length, sessions[0]);
  if (sessions[0]) {
    const s = await m.getConversationById(sessions[0].id);
    console.log('messages:', s?.messages?.length, s?.messages?.[0]);
  }
}).catch(console.error);
"
```

Expected: list of sessions, first session messages array with `{ role, content }` objects.

- [ ] **Step 3: Commit**

```bash
git add server/services/notion.js
git commit -m "feat(history): add listConversations and getConversationById to notion.js"
```

---

## Task 3: Add brief history routes

**Files:**
- Modify: `server/routes/brief.js`

**Context:** Current routes: `GET /today` and `POST /generate`. Add two more. Import `listBriefings` and `getBriefingById` from notion.js.

- [ ] **Step 1: Add imports and two new routes**

At the top of `server/routes/brief.js`, add `listBriefings` and `getBriefingById` to the import:

```js
import {
  getOverdueTasks,
  getDueTodayTasks,
  getTravelEntries,
  saveBriefing,
  getLatestBriefingForDate,
  listBriefings,
  getBriefingById,
} from '../services/notion.js';
```

Before `export default router`, add:

```js
// GET /api/brief/history — list of all past morning briefs
router.get('/history', async (_req, res) => {
  try {
    const list = await listBriefings();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/brief/:id — fetch a specific brief by Notion page ID
router.get('/:id', async (req, res) => {
  try {
    const brief = await getBriefingById(req.params.id);
    if (!brief) return res.status(404).json({ error: 'not found' });
    res.json(brief);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Test endpoints**

Start the server: `cd server && npm run dev`

```bash
curl http://localhost:3001/api/brief/history
# Expected: JSON array (may be empty)

# If array has items, test the /:id route:
curl http://localhost:3001/api/brief/<id-from-above>
# Expected: { id, content, createdAt }
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/brief.js
git commit -m "feat(history): add GET /api/brief/history and GET /api/brief/:id routes"
```

---

## Task 4: Add Claude session routes

**Files:**
- Modify: `server/routes/claude.js`

**Context:** Current routes: `POST /chat` and `POST /save`. Add two more. Import `listConversations` and `getConversationById`.

- [ ] **Step 1: Update import and add routes**

Update the import at top of `server/routes/claude.js`:

```js
import { saveConversation, listConversations, getConversationById } from '../services/notion.js';
```

Before `export default router`, add:

```js
// GET /api/claude/sessions — list all saved Claude CLI sessions
router.get('/sessions', async (_req, res) => {
  try {
    const sessions = await listConversations();
    // Attach exchange count by fetching block count would be expensive;
    // derive from title is not possible. Return without exchangeCount for now —
    // ClaudePage will show date only in the sidebar.
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/claude/sessions/:id — fetch full messages for a session
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await getConversationById(req.params.id);
    if (!session) return res.status(404).json({ error: 'not found' });
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Test endpoints**

```bash
curl http://localhost:3001/api/claude/sessions
# Expected: JSON array of { id, title, date }

# If array has items:
curl http://localhost:3001/api/claude/sessions/<id>
# Expected: { id, messages: [{ role, content }] }
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/claude.js
git commit -m "feat(history): add GET /api/claude/sessions and GET /api/claude/sessions/:id routes"
```

---

## Task 5: Add history sidebar to BriefPage

**Files:**
- Modify: `client/src/mission-control/pages/BriefPage.jsx`

**Context:** Current BriefPage has a single-column layout: Panel with header + scrollable content. Add a 140px left sidebar showing past brief dates. Sidebar fetches from `/api/brief/history` on mount. Clicking a date fetches that brief by ID. Today's date is the default active entry (uses existing `fetchCached` logic).

- [ ] **Step 1: Replace BriefPage.jsx with the full updated version**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

const SECTION_ICONS = { greeting: '☀', meetings: '◫', tasks: '✓', flags: '⚑', travel: '✈' };

function parseSections(text) {
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.replace('## ', '').trim(), body: [] };
    } else if (current) { current.body.push(line); }
  }
  if (current) sections.push(current);
  return sections;
}

function SectionCard({ section }) {
  const T = useTheme();
  const icon = SECTION_ICONS[section.heading.toLowerCase()] ?? '◆';
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: 5, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 14, color: T.textHi, fontWeight: 600 }}>
        <span style={{ color: T.accent }}>{icon}</span>{section.heading}
      </div>
      <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.7 }}>
        {section.body.filter(l => l.trim()).map((line, i) => {
          if (line.startsWith('- ') || line.startsWith('* ')) return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ color: T.textGhost, flexShrink: 0 }}>·</span>
              <span>{line.slice(2)}</span>
            </div>
          );
          return <p key={i} style={{ margin: '2px 0' }}>{line}</p>;
        })}
      </div>
    </div>
  );
}

function HistorySidebar({ history, activeId, onSelect }) {
  const T = useTheme();
  return (
    <div style={{ width: 140, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: T.textGhost, padding: '8px 10px 6px', letterSpacing: '.08em' }}>history</div>
      {history.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          style={{
            background: activeId === item.id ? T.bg2 : 'transparent',
            borderLeft: `2px solid ${activeId === item.id ? T.accent : 'transparent'}`,
            border: 'none',
            borderLeft: `2px solid ${activeId === item.id ? T.accent : 'transparent'}`,
            color: activeId === item.id ? T.textHi : T.textDim,
            cursor: 'pointer',
            fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
            fontSize: 11,
            padding: '6px 10px',
            textAlign: 'left',
            width: '100%',
          }}
        >
          {item.date}
        </button>
      ))}
      {history.length === 0 && (
        <div style={{ fontSize: 11, color: T.textGhost, padding: '6px 10px' }}>no history</div>
      )}
    </div>
  );
}

export function BriefPage() {
  const T = useTheme();
  const [sections, setSections] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    fetchCached();
    return () => abortRef.current?.abort();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch(`${API}/brief/history`);
      if (res.ok) setHistory(await res.json());
    } catch { /* non-fatal */ }
  }

  async function fetchCached() {
    try {
      const res = await fetch(`${API}/brief/today`);
      if (res.status === 404 || !res.ok) return;
      const data = await res.json();
      if (data?.content) {
        setSections(parseSections(data.content));
        setActiveId(data.id ?? null);
        setGeneratedAt(new Date().toLocaleTimeString());
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadBrief(item) {
    setActiveId(item.id);
    setSections([]);
    setError(null);
    try {
      const res = await fetch(`${API}/brief/${item.id}`);
      if (!res.ok) throw new Error('failed to load');
      const data = await res.json();
      if (data?.content) setSections(parseSections(data.content));
    } catch (e) {
      setError(e.message);
    }
  }

  async function generate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true); setError(null); setSections([]);
    try {
      const res = await fetch(`${API}/brief/generate`, { method: 'POST', signal: controller.signal });
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = ''; let buf = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const p = line.slice(5).trim(); if (p === '[DONE]') break;
          try { const { text } = JSON.parse(p); if (text) { acc += text; setSections(parseSections(acc)); } } catch { /* skip */ }
        }
      }
      setGeneratedAt(new Date().toLocaleTimeString());
      fetchHistory(); // refresh sidebar after generating new brief
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally { setIsGenerating(false); }
  }

  const skeleton = Array.from({ length: 4 }, (_, i) => (
    <div key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, height: 100, animation: 'mc-skeleton-pulse 1.5s ease-in-out infinite' }} />
  ));

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <style>{`@keyframes mc-skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <Panel
        title="morning_brief"
        right={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11.5 }}>
            {generatedAt && <span style={{ color: T.textFaint }}>generated {generatedAt}</span>}
            <button onClick={generate} disabled={isGenerating} style={{ background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', opacity: isGenerating ? 0.5 : 1 }}>
              {isGenerating ? 'generating…' : '↺ refresh'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <HistorySidebar history={history} activeId={activeId} onSelect={loadBrief} />
          <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
            {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {isGenerating && sections.length === 0 ? skeleton : sections.map((s) => <SectionCard key={s.heading} section={s} />)}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Start dev servers. Navigate to `/brief`. Verify:
- Sidebar shows list of past brief dates (or "no history" if none saved)
- Clicking a date loads that brief in the main panel
- Active date highlighted with accent border
- Refresh button still works and adds new entry to sidebar

- [ ] **Step 3: Commit**

```bash
git add client/src/mission-control/pages/BriefPage.jsx
git commit -m "feat(history): add history sidebar to BriefPage"
```

---

## Task 6: Add session sidebar to ClaudePage

**Files:**
- Modify: `client/src/mission-control/pages/ClaudePage.jsx`

**Context:** Current ClaudePage has a header bar + message list + input. Add a 150px left sidebar. Sidebar lists sessions with title (truncated to 22 chars) + date. "+ new chat" at top always starts fresh. Loading a session populates `messages` state. Input stays active. Header shows "↩ continuing · {title}" banner when a session is loaded.

- [ ] **Step 1: Add session sidebar state and sidebar component to ClaudePage.jsx**

Add these state vars inside `ClaudePage()` (after existing state):

```jsx
const [sessions, setSessions] = useState([]);
const [activeSessionTitle, setActiveSessionTitle] = useState(null);
```

Add this `useEffect` alongside existing ones:

```jsx
useEffect(() => {
  fetch(`${API}/claude/sessions`)
    .then(r => r.ok ? r.json() : [])
    .then(setSessions)
    .catch(() => {});
}, []);
```

Add the `SessionSidebar` component above `ClaudePage`:

```jsx
function SessionSidebar({ sessions, onNew, onLoad }) {
  const T = useTheme();
  return (
    <div style={{ width: 150, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <button
        onClick={onNew}
        style={{ background: T.bg2, border: 'none', borderBottom: `1px solid ${T.border}`, color: T.accent, cursor: 'pointer', fontSize: 11, padding: '8px 10px', textAlign: 'left', fontFamily: 'inherit' }}
      >
        + new chat
      </button>
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => onLoad(s)}
          style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${T.bg2}`, color: T.textDim, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: '6px 10px', textAlign: 'left', width: '100%' }}
        >
          <div style={{ color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.title.replace('Claude CLI · ', '').slice(0, 22)}
          </div>
          <div style={{ color: T.textGhost, fontSize: 10, marginTop: 2 }}>{s.date}</div>
        </button>
      ))}
      {sessions.length === 0 && (
        <div style={{ fontSize: 11, color: T.textGhost, padding: '8px 10px' }}>no sessions</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire new chat and load session handlers**

Add `handleNewChat` and `handleLoadSession` inside `ClaudePage()` before the return:

```jsx
function handleNewChat() {
  abortRef.current?.abort();
  setMessages([]);
  setInput('');
  setIsStreaming(false);
  setActiveSessionTitle(null);
  setSaveStatus('');
}

async function handleLoadSession(session) {
  abortRef.current?.abort();
  setMessages([]);
  setInput('');
  setIsStreaming(false);
  setSaveStatus('');
  setActiveSessionTitle(session.title.replace('Claude CLI · ', '').slice(0, 30));
  try {
    const res = await fetch(`${API}/claude/sessions/${session.id}`);
    if (!res.ok) throw new Error('failed to load');
    const data = await res.json();
    if (data?.messages) setMessages(data.messages);
  } catch (e) {
    setActiveSessionTitle(null);
  }
}
```

- [ ] **Step 3: Update the return JSX**

Replace the outer `<div style={{ flex: 1, display: 'flex', ...` wrapper to add the sidebar. Change the outer layout div and add `SessionSidebar`:

```jsx
return (
  <div style={{ flex: 1, display: 'flex', overflow: 'hidden', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
    <SessionSidebar sessions={sessions} onNew={handleNewChat} onLoad={handleLoadSession} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* existing header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, fontSize: 12.5 }}>
        <span style={{ color: T.accent }}>$ claude-chat</span>
        {activeSessionTitle
          ? <span style={{ color: T.info, fontSize: 11.5 }}>↩ continuing · {activeSessionTitle}</span>
          : <span style={{ color: T.textGhost }}>claude-sonnet-4-5</span>
        }
        <span style={{ color: T.textFaint }}>{exchangeCount} exchanges</span>
        <div style={{ flex: 1 }} />
        {saveStatus && <span style={{ color: saveStatus === 'error' ? T.danger : T.textDim, fontSize: 12 }}>{saveStatus}</span>}
        <button onClick={handleSave} style={hdrBtn}>Save to Notion</button>
        <button onClick={handleNewChat} style={hdrBtn}>Clear</button>
      </div>

      {/* existing messages area */}
      <div style={{ flex: 1, overflowY: 'auto', background: T.bg0 }}>
        {messages.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: T.textGhost, fontSize: 14 }}>
            $ ask anything — ↑↓ history · Ctrl+C abort
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} isStreaming={isStreaming && i === messages.length - 1 && m.role === 'assistant'} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* existing input bar */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: T.bg1, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ color: T.accent, fontSize: 15, alignSelf: 'center' }}>{'>'}</span>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="ask something… (Enter to send, Shift+Enter newline)"
          style={{ flex: 1, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 14.5, padding: '6px 10px', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={isStreaming || !input.trim()}
          style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 4, color: T.accent, cursor: 'pointer', fontSize: 13, padding: '0 12px', alignSelf: 'stretch', opacity: (isStreaming || !input.trim()) ? 0.4 : 1 }}
        >
          {isStreaming ? '…' : '⏎'}
        </button>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 4: Verify in browser**

Navigate to `/claude`. Verify:
- Left sidebar shows saved sessions (or "no sessions")
- "+ new chat" clears the chat
- Clicking a past session loads its messages (scrolls to bottom)
- Header shows "↩ continuing · {title}" when a session is loaded
- Input is active after loading — you can continue the conversation
- Sending a message in a loaded session appends correctly
- "Save to Notion" still works (saves current messages as a new page)

- [ ] **Step 5: Commit**

```bash
git add client/src/mission-control/pages/ClaudePage.jsx
git commit -m "feat(history): add session sidebar to ClaudePage with load and continue"
```

---

## Task 7: End-to-end verification + CLAUDE.md

- [ ] **Step 1: Full flow test**

1. Open `/brief` — sidebar shows history, click a past date, brief loads
2. Click ↺ refresh — generates new brief, sidebar refreshes
3. Open `/claude` — sidebar shows past sessions
4. Click a session — messages load, header shows "↩ continuing"
5. Type a message and send — conversation continues, Claude responds

- [ ] **Step 2: Update CLAUDE.md**

In the `## Current build status` section, change:
```
Next: Phase 7 — People & 1:1s deep dive (talking points, activity merge, claude prep streaming).
```
To:
```
Spec B complete — Brief history sidebar (browse past briefs by date) and Claude session history (load + continue past sessions) added to MC pages.
Next: Spec C — Microsoft bearer token.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: update CLAUDE.md — Spec B complete"
```
