import { useState, useEffect, useCallback } from 'react';

/**
 * Loads the latest recipes file directly via Electron IPC (fs.readFileSync).
 * No fetch() involved — avoids the Vite dev server returning HTML for unknown paths.
 *
 * Priority:
 *   1. Newest recipes_YYYY-MM-DD.json found in the public folder
 *   2. recipes.json in the public folder (the original bundled file)
 */
export function useRecipes() {
  const [recipes,    setRecipes]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [sourceFile, setSourceFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI?.readRecipes) {
        throw new Error(
          'electronAPI is not available. Make sure the app is running inside Electron.'
        );
      }

      // 1. Find the newest dated file
      const files    = await window.electronAPI.listRecipeFiles();
      const filename = files.length > 0 ? files[0] : 'recipes.json';

      // 2. Read it directly from disk via IPC
      const data = await window.electronAPI.readRecipes(filename);

      if (!data) {
        throw new Error(
          `File "${filename}" not found in the public folder. ` +
          `Copy your recipes.json to src/renderer/public/recipes.json`
        );
      }

      setRecipes(data);
      setSourceFile(filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { recipes, loading, error, sourceFile, reload: load };
}

/**
 * Saves recipes to a dated file via Electron IPC.
 */
export async function saveRecipes(data) {
  const now      = new Date();
  const yyyy     = now.getFullYear();
  const mm       = String(now.getMonth() + 1).padStart(2, '0');
  const dd       = String(now.getDate()).padStart(2, '0');
  const filename = `recipes_${yyyy}-${mm}-${dd}.json`;

  if (!window.electronAPI?.saveRecipes) {
    throw new Error('Electron IPC not available — cannot write files.');
  }

  const result = await window.electronAPI.saveRecipes(filename, data);
  if (!result.ok) throw new Error('Save failed');
  return { ok: true, filename };
}
