import { useState, useEffect, useCallback } from 'react';

export function useRecipes() {
  const [recipes,    setRecipes]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [sourceFile, setSourceFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (!window.electronAPI?.readRecipes) throw new Error('electronAPI not available — run inside Electron.');
      const files    = await window.electronAPI.listRecipeFiles();
      const filename = files.length > 0 ? files[0] : 'recipes.json';
      const data     = await window.electronAPI.readRecipes(filename);
      if (!data) throw new Error(`File "${filename}" not found. Copy recipes.json to src/renderer/public/.`);
      setRecipes(data); setSourceFile(filename);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { recipes, loading, error, sourceFile, reload: load };
}

function todayFilename(prefix) {
  const now  = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  return `${prefix}${yyyy}-${mm}-${dd}.json`;
}

export async function saveRecipes(data) {
  const filename = todayFilename('recipes_');
  if (!window.electronAPI?.saveRecipes) throw new Error('Electron IPC not available.');
  const result = await window.electronAPI.saveRecipes(filename, data);
  if (!result.ok) throw new Error('Save failed');
  return { ok: true, filename };
}

export async function savePlan(data) {
  const filename = todayFilename('MP_');
  if (!window.electronAPI?.savePlan) throw new Error('Electron IPC not available.');
  const result = await window.electronAPI.savePlan(filename, data);
  if (!result.ok) throw new Error('Save failed');
  return { ok: true, filename };
}

export async function listPlanFiles() {
  if (!window.electronAPI?.listPlanFiles) return [];
  return window.electronAPI.listPlanFiles();
}

export async function readPlan(filename) {
  if (!window.electronAPI?.readPlan) return null;
  return window.electronAPI.readPlan(filename);
}
