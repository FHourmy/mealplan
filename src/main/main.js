const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    titleBarStyle: 'hiddenInset', backgroundColor: '#0f0f0f', show: false,
  });
  if (isDev) { win.loadURL('http://localhost:5173'); win.webContents.openDevTools(); }
  else        { win.loadFile(path.join(__dirname, '../../dist/index.html')); }
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Helpers ──────────────────────────────────────────────────────
function getUserDataDir() {
  if (isDev) return path.join(__dirname, '../../src/renderer/public');
  const dir = path.join(app.getPath('userData'), 'recipes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getBundledRecipesPath() { return path.join(__dirname, '../../dist/recipes.json'); }

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}
function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── IPC ──────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// ── Recipes ──────────────────────────────────────────────────────
ipcMain.handle('list-recipe-files', () => {
  const dir = getUserDataDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^recipes_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
});

ipcMain.handle('read-recipes', (_e, filename) => {
  const data = readJsonFile(path.join(getUserDataDir(), filename));
  if (data) return data;
  return readJsonFile(getBundledRecipesPath());
});

ipcMain.handle('save-recipes', (_e, { filename, data }) => {
  const dir = getUserDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  writeJsonFile(path.join(dir, filename), data);
  return { ok: true };
});

// ── Meal Plans ───────────────────────────────────────────────────
ipcMain.handle('list-plan-files', () => {
  const dir = getUserDataDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^MP_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
});

ipcMain.handle('read-plan', (_e, filename) => {
  return readJsonFile(path.join(getUserDataDir(), filename));
});

ipcMain.handle('save-plan', (_e, { filename, data }) => {
  const dir = getUserDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  writeJsonFile(path.join(dir, filename), data);
  return { ok: true };
});

ipcMain.handle('get-user-data-path', () => getUserDataDir());
