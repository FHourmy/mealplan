# 🥗 MealPlan — Electron + React App

A desktop meal planning app built with **Electron** and **React** (Vite).

## Project Structure

```
mealplan/
├── src/
│   ├── main/
│   │   ├── main.js        # Electron main process
│   │   └── preload.js     # Secure IPC bridge
│   └── renderer/
│       ├── index.html     # HTML entry point
│       ├── main.jsx       # React entry point
│       ├── App.jsx        # Root App component
│       └── index.css      # Global styles
├── vite.config.js         # Vite bundler config
├── package.json
└── .gitignore
```

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run in development
```bash
npm run dev
```
This starts the Vite dev server (port 5173) and Electron simultaneously.

### 3. Build for production
```bash
npm run build
```
Output goes to `dist-electron/`.

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Electron** | Desktop shell |
| **React 18** | UI framework |
| **Vite** | Fast bundler/dev server |
| **concurrently** | Run Vite + Electron in parallel |
| **wait-on** | Wait for Vite before launching Electron |
| **electron-builder** | Package & distribute the app |

## Adding IPC Communication

To communicate between the renderer (React) and main (Node.js) process:

**1. Add a handler in `src/main/main.js`:**
```js
ipcMain.handle('my-action', async (event, data) => {
  return { result: 'done' };
});
```

**2. Expose it in `src/main/preload.js`:**
```js
contextBridge.exposeInMainWorld('electronAPI', {
  myAction: (data) => ipcRenderer.invoke('my-action', data),
});
```

**3. Call it from React:**
```jsx
const result = await window.electronAPI.myAction({ foo: 'bar' });
```
