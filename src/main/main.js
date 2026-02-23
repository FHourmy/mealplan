const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    titleBarStyle: 'hiddenInset', backgroundColor: '#0f0f0f', show: false,
  });
  
  if (isDev) { 
    win.loadURL('http://localhost:5173'); 
    win.webContents.openDevTools(); 
  } else { 
    win.loadFile(path.join(__dirname, '../../dist/index.html')); 
  }
  
  win.once('ready-to-show', () => win.show());
  
  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Folder',
          click: () => {
            shell.openPath(getUserDataDir());
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Helpers ──────────────────────────────────────────────────────
function getUserDataDir() {
  if (isDev) {
    // In development, use the project's public folder
    return path.join(__dirname, '../../src/renderer/public');
  }
  
  // In production, use a writable location outside .asar
  // On Windows: C:\Users\<user>\AppData\Roaming\mealplan\data
  // On macOS: ~/Library/Application Support/mealplan/data
  // On Linux: ~/.config/mealplan/data
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getBundledRecipesPath() {
  // In production, the bundled recipes.json is inside .asar (read-only)
  // We need to copy it to userData on first run if it doesn't exist there
  if (isDev) {
    return path.join(__dirname, '../../src/renderer/public/recipes.json');
  }
  return path.join(__dirname, '../../dist/recipes.json');
}

function ensureBundledRecipesInUserData() {
  const userDir = getUserDataDir();
  const userRecipesPath = path.join(userDir, 'recipes.json');
  
  // If recipes.json already exists in userData, we're good
  if (fs.existsSync(userRecipesPath)) {
    return;
  }
  
  // Copy bundled recipes.json to userData on first run
  const bundledPath = getBundledRecipesPath();
  if (fs.existsSync(bundledPath)) {
    try {
      const data = fs.readFileSync(bundledPath, 'utf-8');
      fs.writeFileSync(userRecipesPath, data, 'utf-8');
      console.log('Copied bundled recipes.json to userData');
    } catch (err) {
      console.error('Failed to copy bundled recipes:', err);
    }
  }
}

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
  ensureBundledRecipesInUserData();
  const dir = getUserDataDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^recipes_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
});

ipcMain.handle('read-recipes', (_e, filename) => {
  ensureBundledRecipesInUserData();
  const userPath = path.join(getUserDataDir(), filename);
  return readJsonFile(userPath);
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
  return fs.readdirSync(dir).filter(f => /^MP_\d{4}-\d{2}-\d{2}(?:_\d+)?\.json$/.test(f)).sort().reverse();
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

ipcMain.handle('delete-plan', (_e, filename) => {
  const dir = getUserDataDir();
  const filePath = path.join(dir, filename);
  
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'File not found' };
  }
  
  try {
    fs.unlinkSync(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-user-data-path', () => getUserDataDir());
