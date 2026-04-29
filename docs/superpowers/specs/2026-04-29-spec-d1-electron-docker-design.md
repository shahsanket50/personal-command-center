# Spec D1 — Electron Menubar App + Docker Compose Design

## Overview

Package the app as a macOS menubar app (Electron) and provide a `docker-compose up` path for friends to run everything locally with one command. Notion remains the data layer — no data changes in this spec.

---

## Electron Menubar App

### Structure

New `electron/` folder at repo root:
```
electron/
  main.js          — main process: tray, BrowserWindow, server lifecycle
  preload.js       — minimal preload (contextBridge if needed)
  assets/
    tray-icon.png  — 16×16 or 22×22 template icon (macOS menu bar)
```

### Behaviour

- On app launch: start Express server as a child process (`node server/index.js`)
- Create a `Tray` with the icon — sits in the macOS menu bar
- Click tray icon → toggle BrowserWindow visibility (show/hide)
- BrowserWindow: frameless, 1200×800, loads `http://localhost:3001` (Express serves the built client)
- In development: loads `http://localhost:5173` (Vite dev server)
- Window hides (not closes) when focus is lost — standard menubar pattern
- Tray right-click menu: `Show / Hide`, `Quit`
- Server child process is killed when Electron quits

### Express serves the client in production

In production (packaged app), Express adds a static file route serving the built Vite output from `client/dist/`. No separate client process needed.

```js
// server/index.js addition (prod only)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
}
```

### Packaging

`electron-builder` config in `package.json` (root level):
```json
{
  "build": {
    "appId": "com.sanket.personal-command-center",
    "mac": { "target": "dmg", "category": "public.app-category.productivity" },
    "files": ["electron/**", "server/**", "client/dist/**", "node_modules/**"],
    "extraResources": [".env.example"]
  }
}
```

Build command: `npm run build:electron` — runs `vite build` then `electron-builder`.

---

## Docker Compose

### Files

**`Dockerfile`** (server):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --production
COPY server/ ./server/
EXPOSE 3001
CMD ["node", "server/index.js"]
```

**`Dockerfile.client`** (client — builds static files, serves via nginx):
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`nginx.conf`**:
```nginx
server {
  listen 80;
  location /api { proxy_pass http://server:3001; }
  location / { try_files $uri /index.html; }
}
```

**`docker-compose.yml`**:
```yaml
services:
  server:
    build: { context: ., dockerfile: Dockerfile }
    env_file: .env
    ports: ["3001:3001"]
    volumes: ["./ms-token.json:/app/ms-token.json", "./google-credentials.json:/app/google-credentials.json"]
  client:
    build: { context: ., dockerfile: Dockerfile.client }
    ports: ["5173:80"]
    depends_on: [server]
```

**`.env.example`** gains: no new vars (Notion + API keys already there).

### Friend setup flow

```bash
git clone <repo>
cp .env.example .env
# fill in API keys in .env
docker-compose up
# open http://localhost:5173
```

---

## Root `package.json`

New root-level `package.json` to orchestrate dev + build:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "build": "npm run build --prefix client",
    "build:electron": "npm run build && electron-builder",
    "electron:dev": "NODE_ENV=development electron electron/main.js"
  }
}
```

---

## What Does Not Change

- All server routes, services, Notion integration — untouched
- All client React code — untouched
- `.env` structure — untouched (same vars, same file)
- Google OAuth flow — untouched

---

## Success Criteria

1. `npm run electron:dev` launches the menubar tray app in development
2. Tray icon click shows/hides the app window
3. `docker-compose up` starts server + client, app is accessible at `localhost:5173`
4. `npm run build:electron` produces a `.dmg` installable on macOS
5. All existing features work identically in both Electron and Docker modes
