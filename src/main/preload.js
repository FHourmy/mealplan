const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion:   ()               => ipcRenderer.invoke('get-app-version'),
  listRecipeFiles: ()               => ipcRenderer.invoke('list-recipe-files'),
  readRecipes:     (filename)       => ipcRenderer.invoke('read-recipes', filename),
  saveRecipes:     (filename, data) => ipcRenderer.invoke('save-recipes', { filename, data }),
  listPlanFiles:   ()               => ipcRenderer.invoke('list-plan-files'),
  readPlan:        (filename)       => ipcRenderer.invoke('read-plan', filename),
  savePlan:        (filename, data) => ipcRenderer.invoke('save-plan', { filename, data }),
  getUserDataPath: ()               => ipcRenderer.invoke('get-user-data-path'),
});
