# Spec D1 — Electron Menubar App + Docker Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the app as a macOS menubar tray app (Electron) and provide a `docker-compose up` one-command setup for local use and sharing with friends. Notion remains the data layer — no data changes.

**Architecture:** Root-level `package.json` orchestrates the project. `electron/main.js` creates a tray icon and BrowserWindow; in dev it loads Vite's dev server, in prod it loads Express static files. Docker Compose runs Express + nginx (serving built client) as two containers, env-file mounted. No changes to any server routes, services, or client React code.

**Tech Stack:** Electron 30, electron-builder, Docker + Docker Compose, nginx:alpine

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` (root) | Create | Root orchestrator: dev, build, electron scripts |
| `electron/main.js` | Create | Tray icon, BrowserWindow, server child process |
| `electron/preload.js` | Create | Minimal preload (empty contextBridge) |
| `electron/assets/tray-icon.png` | Create | 22×22 PNG tray icon (placeholder) |
| `server/index.js` | Modify | Add static file serving for production build |
| `Dockerfile` | Create | Server container (Node 20 alpine) |
| `Dockerfile.client` | Create | Client multi-stage build + nginx |
| `nginx.conf` | Create | Proxy `/api` to server, serve SPA |
| `docker-compose.yml` | Create | Server + client services, env_file mount |
| `.env.example` | Modify | Remove Azure AD vars, add `NODE_ENV` note |
| `.dockerignore` | Create | Exclude node_modules, .env, token files |

---

## Task 1: Create root package.json

**Files:**
- Create: `package.json` (repo root)

**Context:** The repo currently has `server/package.json` and `client/package.json` but no root-level orchestrator. The root `package.json` adds convenience scripts and Electron dependencies. It does NOT replace the sub-package.json files.

- [ ] **Step 1: Check if root package.json exists**

```bash
ls package.json 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If it exists, read it first before modifying. If missing, create it:

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "personal-command-center",
  "version": "0.1.0",
  "private": true,
  "main": "electron/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "build": "npm run build --prefix client",
    "electron:dev": "NODE_ENV=development electron .",
    "electron:build": "npm run build && electron-builder",
    "docker:up": "docker-compose up --build",
    "docker:down": "docker-compose down"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "electron": "^30.0.0",
    "electron-builder": "^24.13.3"
  },
  "build": {
    "appId": "com.sanket.personal-command-center",
    "productName": "Command Center",
    "mac": {
      "target": "dmg",
      "category": "public.app-category.productivity"
    },
    "files": [
      "electron/**",
      "server/**",
      "client/dist/**",
      "node_modules/**",
      "!node_modules/.cache",
      "!**/.env"
    ],
    "extraResources": [
      { "from": ".env.example", "to": ".env.example" }
    ]
  }
}
```

- [ ] **Step 3: Install root dependencies**

```bash
npm install
```

Expected: `node_modules/` created at root with electron + concurrently + electron-builder.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add root package.json with electron and dev scripts"
```

---

## Task 2: Create Electron main process

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Create: `electron/assets/tray-icon.png`

- [ ] **Step 1: Create electron/ directory structure**

```bash
mkdir -p electron/assets
```

- [ ] **Step 2: Create a minimal tray icon**

Create a simple 22×22 PNG. The easiest way is to use Node to generate one:

```bash
node -e "
const { createCanvas } = require('canvas');
" 2>/dev/null || echo "canvas not available — copy any 22x22 PNG to electron/assets/tray-icon.png"
```

If canvas is not available, download or create any 22×22 PNG and place it at `electron/assets/tray-icon.png`. A simple gray square works for development. You can replace it with a proper icon later.

**Alternative — create a minimal PNG programmatically:**

```bash
# Create a 1x1 gray pixel PNG as placeholder (will scale in macOS menu bar)
node -e "
const fs = require('fs');
// Minimal valid 1x1 gray PNG (base64)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('electron/assets/tray-icon.png', png);
console.log('tray-icon.png created');
"
```

- [ ] **Step 3: Create electron/main.js**

```js
import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

let tray = null;
let win = null;
let serverProcess = null;

function startServer() {
  if (isDev) return; // dev: server runs separately via `npm run dev`

  const serverPath = join(__dirname, '../server/index.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
  });

  serverProcess.on('error', (err) => console.error('[server]', err));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    frame: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  const url = isDev ? 'http://localhost:5173' : 'http://localhost:3001';
  win.loadURL(url);

  win.on('close', (e) => {
    e.preventDefault();
    win.hide(); // hide instead of close — keep app alive in tray
  });
}

function createTray() {
  const iconPath = join(__dirname, 'assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => {
        if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: 'Open Graph Explorer',
      click: () => shell.openExternal('https://developer.microsoft.com/en-us/graph/graph-explorer'),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip('Command Center');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
  createTray();

  // Small delay in dev to let Vite start
  setTimeout(() => win.show(), isDev ? 2000 : 500);
});

app.on('window-all-closed', (e) => e.preventDefault()); // keep alive in tray

app.on('before-quit', () => {
  app.isQuitting = true;
  serverProcess?.kill();
});
```

- [ ] **Step 4: Create electron/preload.js**

```js
// Minimal preload — no contextBridge exposure needed currently
```

- [ ] **Step 5: Test Electron in dev mode**

```bash
# Terminal 1: start server + client
npm run dev

# Terminal 2: after Vite is ready (~3s), launch Electron
npm run electron:dev
```

Expected: tray icon appears in macOS menu bar, clicking it shows the app window loading `localhost:5173`.

- [ ] **Step 6: Commit**

```bash
git add electron/ package.json
git commit -m "feat(electron): add tray menubar app with BrowserWindow"
```

---

## Task 3: Add static file serving to server for production

**Files:**
- Modify: `server/index.js`

**Context:** In production (packaged Electron app), Express serves the built client files. The client build output goes to `client/dist/`. This route must be added AFTER all API routes so it doesn't intercept API requests.

- [ ] **Step 1: Add static middleware to server/index.js**

Read `server/index.js` first to find where to insert. Add at the bottom, after all `app.use('/api/...')` lines, before `app.listen`:

```js
// Production: serve built client files
if (process.env.NODE_ENV === 'production') {
  const clientDist = new URL('../client/dist', import.meta.url).pathname;
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(new URL('../client/dist/index.html', import.meta.url).pathname);
  });
}
```

- [ ] **Step 2: Verify dev mode unaffected**

```bash
cd server && npm run dev
curl http://localhost:3001/api/brief/today
# Expected: 200 (or 500 if Notion not configured) — API routes still work
```

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat(electron): add production static file serving to server"
```

---

## Task 4: Create Docker files

**Files:**
- Create: `Dockerfile`
- Create: `Dockerfile.client`
- Create: `nginx.conf`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile (server)**

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Copy server source
COPY server/ ./server/

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
```

- [ ] **Step 2: Create Dockerfile.client**

```dockerfile
# Stage 1: build the React app
FROM node:20-alpine AS build
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# Stage 2: serve via nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Create nginx.conf**

```nginx
server {
    listen 80;
    server_name localhost;

    # Proxy API requests to the server container
    location /api/ {
        proxy_pass http://server:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        # SSE support
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }

    # Serve React SPA — all other routes
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Create .dockerignore**

```
node_modules
*/node_modules
.env
ms-token.json
google-credentials.json
client/dist
.git
*.md
.superpowers
docs
electron
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile Dockerfile.client nginx.conf .dockerignore
git commit -m "feat(docker): add server and client Dockerfiles with nginx"
```

---

## Task 5: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  server:
    build:
      context: .
      dockerfile: Dockerfile
    env_file: .env
    ports:
      - "3001:3001"
    volumes:
      # Mount token files so OAuth state persists across container restarts
      - ./ms-token.json:/app/ms-token.json
      - ./google-credentials.json:/app/google-credentials.json
    restart: unless-stopped

  client:
    build:
      context: .
      dockerfile: Dockerfile.client
    ports:
      - "5173:80"
    depends_on:
      - server
    restart: unless-stopped
```

- [ ] **Step 2: Update .env.example**

Remove the Azure AD vars (`MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID`) since they are no longer needed (Spec C removed them). The file should just have the remaining vars.

Read `.env.example` first, then remove those three lines.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(docker): add docker-compose.yml for one-command local setup"
```

---

## Task 6: Test Docker Compose

- [ ] **Step 1: Build and start**

```bash
# Copy .env.example to .env if not already done
cp .env.example .env
# Fill in real API keys in .env

docker-compose up --build
```

Expected output:
```
[+] Building ...
[+] Running 2/2
 ✔ Container server  Started
 ✔ Container client  Started
```

- [ ] **Step 2: Verify**

```bash
# Server health
curl http://localhost:3001/api/settings/ms-token/status
# Expected: { set: false, ageMinutes: 0, expired: true }

# Client loads
open http://localhost:5173
# Expected: app loads in browser
```

- [ ] **Step 3: Stop containers**

```bash
docker-compose down
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(docker): docker-compose verified and working"
```

---

## Task 7: End-to-end verification + CLAUDE.md

- [ ] **Step 1: Test Electron dev flow**

```bash
npm run dev &        # starts server + client
sleep 5
npm run electron:dev # launches tray app
```

Verify:
- Tray icon appears in menu bar
- Click shows app window at localhost:5173
- Click again hides it
- Right-click context menu shows Show/Hide, Open Graph Explorer, Quit
- Quit kills the app cleanly

- [ ] **Step 2: Test Docker flow**

```bash
docker-compose up --build
# navigate to http://localhost:5173
# verify app loads and API calls work
docker-compose down
```

- [ ] **Step 3: Update CLAUDE.md build status**

Change `Next: Spec D1 — Electron menubar app + Docker Compose.` to:
```
Spec D1 complete — Electron menubar tray app; docker-compose up one-command setup for local sharing and AWS-ready server container.
Next: Spec D2 — Postgres full migration (replace Notion).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: update CLAUDE.md — Spec D1 complete"
```
