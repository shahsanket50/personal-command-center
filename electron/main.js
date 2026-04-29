import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

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
