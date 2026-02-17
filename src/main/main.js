const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    show: false,
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Helpers ──────────────────────────────────────────────────────

/**
 * User-writable data directory.
 * Dev:  project/src/renderer/public/   (so Vite serves the files)
 * Prod: C:\Users\<user>\AppData\Roaming\mealplan\   (writable, outside .asar)
 */
function getUserDataDir() {
  if (isDev) {
    return path.join(__dirname, '../../src/renderer/public');
  }
  const dir = path.join(app.getPath('userData'), 'recipes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Where the bundled fallback recipes.json lives (inside the .asar — read-only).
 * Only used as a last-resort fallback when no user files exist yet.
 */
function getBundledRecipesPath() {
  return path.join(__dirname, '../../dist/recipes.json');
}

// ── IPC ──────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// List all dated recipe files in userData, newest first
ipcMain.handle('list-recipe-files', () => {
  const dir = getUserDataDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /^recipes_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
});

// Read a recipe file — checks userData first, then falls back to bundled recipes.json
ipcMain.handle('read-recipes', (_event, filename) => {
  // 1. Try the user-writable directory
  const userPath = path.join(getUserDataDir(), filename);
  if (fs.existsSync(userPath)) {
    try { return JSON.parse(fs.readFileSync(userPath, 'utf-8')); } catch { /* fall through */ }
  }

  // 2. Fallback: bundled recipes.json (first launch, no saved files yet)
  const bundled = getBundledRecipesPath();
  if (fs.existsSync(bundled)) {
    try { return JSON.parse(fs.readFileSync(bundled, 'utf-8')); } catch { /* fall through */ }
  }

  return null;
});

// Save recipes to the user-writable directory
ipcMain.handle('save-recipes', (_event, { filename, data }) => {
  const dir      = getUserDataDir();
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, path: filePath };
});

// Expose userData path to renderer (useful for showing the user where files are)
ipcMain.handle('get-user-data-path', () => getUserDataDir());
