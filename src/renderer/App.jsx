import React, { useState, useEffect, useCallback } from 'react';
import RecipePicker from './RecipePicker';
import RecipeEditor from './RecipeEditor';
import PlannerView  from './PlannerView';
import { useRecipes, savePlan, listPlanFiles, readPlan } from './useRecipes';

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MEALS = ['Breakfast','Lunch','Dinner'];

const defaultPlan = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = MEALS.reduce((m, meal) => { m[meal] = null; return m; }, {});
    return acc;
  }, {});

// "MP_2026-02-17.json" → "Feb 17, 2026"
function formatPlanLabel(filename) {
  const m = filename.match(/^MP_(\d{4})-(\d{2})-(\d{2})\.json$/);
  if (!m) return filename;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

export default function App() {
  const [page,    setPage]    = useState('planner'); // 'planner' | 'editor'
  // plannerView: 'current' | filename (MP_YYYY-MM-DD.json)
  const [plannerView, setPlannerView] = useState('current');

  const [plan,    setPlan]    = useState(defaultPlan());
  const [picker,  setPicker]  = useState(null);

  // Archived plan files list
  const [planFiles,      setPlanFiles]      = useState([]);
  const [archivedPlan,   setArchivedPlan]   = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const { recipes, loading, error, sourceFile, reload } = useRecipes();

  // Load plan file list on mount
  const refreshPlanFiles = useCallback(async () => {
    const files = await listPlanFiles();
    setPlanFiles(files);
  }, []);

  useEffect(() => { refreshPlanFiles(); }, [refreshPlanFiles]);

  // Auto-save plan on every change (debounced 800ms)
  useEffect(() => {
    const t = setTimeout(async () => {
      try { await savePlan(plan); refreshPlanFiles(); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [plan]);

  // Load an archived plan when switching to it
  useEffect(() => {
    if (plannerView === 'current') { setArchivedPlan(null); return; }
    setArchiveLoading(true);
    readPlan(plannerView)
      .then(data => setArchivedPlan(data))
      .finally(() => setArchiveLoading(false));
  }, [plannerView]);

  const openPicker  = (day, meal) => setPicker({ day, meal });
  const closePicker = ()           => setPicker(null);

  const handleSelectRecipe = (recipe) => {
    if (!picker) return;
    setPlan(prev => ({ ...prev, [picker.day]: { ...prev[picker.day], [picker.meal]: recipe } }));
    closePicker();
  };

  const isReadonly = plannerView !== 'current';
  const activePlan = isReadonly ? (archivedPlan || defaultPlan()) : plan;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">🥗 MealPlan</span>
          <span className="subtitle">{sourceFile ? `recipes: ${sourceFile}` : 'Your weekly food planner'}</span>
        </div>
        <nav className="header-nav">
          <button className={`nav-btn ${page === 'planner' ? 'active' : ''}`} onClick={() => setPage('planner')}>
            📅 Planner
          </button>
          <button className={`nav-btn ${page === 'editor' ? 'active' : ''}`} onClick={() => setPage('editor')}>
            ✏️ Edit Recipes
          </button>
        </nav>
      </header>

      {loading && <div className="app-status">Loading recipes…</div>}
      {error   && <div className="app-status error">Error: {error}</div>}

      {!loading && page === 'planner' && (
        <div className="app-layout-outer">
          {/* ── Plan history sidebar ── */}
          <nav className="plan-sidebar">
            <div className="plan-sidebar-title">Plans</div>

            <button
              className={`plan-sidebar-item ${plannerView === 'current' ? 'active' : ''}`}
              onClick={() => setPlannerView('current')}
            >
              <span className="plan-sidebar-label">Current</span>
              <span className="plan-sidebar-sub">editing</span>
            </button>

            {planFiles.map(file => (
              <button
                key={file}
                className={`plan-sidebar-item ${plannerView === file ? 'active' : ''}`}
                onClick={() => setPlannerView(file)}
              >
                <span className="plan-sidebar-label">{formatPlanLabel(file)}</span>
                <span className="plan-sidebar-sub">saved</span>
              </button>
            ))}
          </nav>

          {/* ── Planner content ── */}
          {archiveLoading
            ? <div className="app-status">Loading plan…</div>
            : <PlannerView
                plan={activePlan}
                setPlan={setPlan}
                readonly={isReadonly}
                recipes={recipes}
                openPicker={openPicker}
              />
          }
        </div>
      )}

      {!loading && page === 'editor' && (
        <RecipeEditor recipes={recipes} sourceFile={sourceFile} onSaved={reload} />
      )}

      {picker && recipes && (
        <RecipePicker recipes={recipes} onSelect={handleSelectRecipe} onClose={closePicker} />
      )}
    </div>
  );
}
