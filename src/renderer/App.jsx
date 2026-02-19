import React, { useState, useEffect, useCallback } from 'react';
import RecipePicker from './RecipePicker';
import RecipeEditor from './RecipeEditor';
import PlannerView  from './PlannerView';
import { useRecipes, savePlan, listPlanFiles, readPlan } from './useRecipes';

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MEALS = ['Lunch','Dinner'];

const defaultPlan = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = MEALS.reduce((m, meal) => { m[meal] = null; return m; }, {});
    return acc;
  }, {});

const defaultFilters = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = MEALS.reduce((m, meal) => { 
      m[meal] = { season: 'winter', sections: [], tags: [], search: '' }; 
      return m; 
    }, {});
    return acc;
  }, {});

function formatPlanLabel(filename) {
  const m = filename.match(/^MP_(\d{4})-(\d{2})-(\d{2})\.json$/);
  if (!m) return filename;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

export default function App() {
  const [page,    setPage]    = useState('planner');
  const [plannerView, setPlannerView] = useState('current');

  const [plan,        setPlan]        = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [picker,      setPicker]      = useState(null);
  
  const [pickerFilters, setPickerFilters] = useState(defaultFilters());

  const [planFiles,      setPlanFiles]      = useState([]);
  const [archivedPlan,   setArchivedPlan]   = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const { recipes, loading, error, sourceFile, reload } = useRecipes();

  const refreshPlanFiles = useCallback(async () => {
    const files = await listPlanFiles();
    setPlanFiles(files);
    return files;
  }, []);

  useEffect(() => {
    const loadCurrentPlan = async () => {
      setPlanLoading(true);
      try {
        const files = await refreshPlanFiles();
        if (files.length > 0) {
          const data = await readPlan(files[0]);
          if (data) {
            const normalized = defaultPlan();
            DAYS.forEach(day => {
              if (data[day]) {
                MEALS.forEach(meal => {
                  if (data[day][meal]) {
                    normalized[day][meal] = data[day][meal];
                  }
                });
              }
            });
            setPlan(normalized);
          } else {
            setPlan(defaultPlan());
          }
        } else {
          setPlan(defaultPlan());
        }
      } catch {
        setPlan(defaultPlan());
      } finally {
        setPlanLoading(false);
      }
    };
    loadCurrentPlan();
  }, [refreshPlanFiles]);

  useEffect(() => {
    if (!plan || plannerView !== 'current') return;
    const t = setTimeout(async () => {
      try { await savePlan(plan); refreshPlanFiles(); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [plan, plannerView, refreshPlanFiles]);

  useEffect(() => {
    if (plannerView === 'current') { 
      setArchivedPlan(null); 
      return; 
    }
    setArchiveLoading(true);
    readPlan(plannerView)
      .then(data => {
        if (data) {
          const normalized = defaultPlan();
          DAYS.forEach(day => {
            if (data[day]) {
              MEALS.forEach(meal => {
                if (data[day][meal]) {
                  normalized[day][meal] = data[day][meal];
                }
              });
            }
          });
          setArchivedPlan(normalized);
        } else {
          setArchivedPlan(defaultPlan());
        }
      })
      .catch(() => setArchivedPlan(defaultPlan()))
      .finally(() => setArchiveLoading(false));
  }, [plannerView]);

  const openPicker  = (day, meal) => setPicker({ day, meal });
  const closePicker = ()           => setPicker(null);

  const handleSelectRecipe = (recipe) => {
    if (!picker) return;
    setPlan(prev => ({ ...prev, [picker.day]: { ...prev[picker.day], [picker.meal]: recipe } }));
    closePicker();
  };

  const handlePickerFiltersChange = useCallback((filters) => {
    if (!picker) return;
    setPickerFilters(prev => ({
      ...prev,
      [picker.day]: { ...prev[picker.day], [picker.meal]: filters }
    }));
  }, [picker]);

  const handleRecipesSaved = useCallback((updatedRecipes) => {
    reload();
    setPlan(prev => {
      if (!prev) return prev;
      const next = {...prev};
      DAYS.forEach(day => {
        MEALS.forEach(meal => {
          const current = prev[day]?.[meal];
          if (!current) return;
          const allUpdated = [
            ...(updatedRecipes.winter_recipes||[]).map(r=>({...r,_season:'winter'})),
            ...(updatedRecipes.summer_recipes||[]).map(r=>({...r,_season:'summer'}))
          ];
          const match = allUpdated.find(r => r.name === current.name);
          if (match) {
            next[day][meal] = match;
          }
        });
      });
      return next;
    });
  }, [reload]);

  const fillPlan = useCallback(() => {
    if (!recipes || !plan) return;
    
    const allRecipes = [
      ...(recipes.winter_recipes||[]).map(r=>({...r,_season:'winter'})),
      ...(recipes.summer_recipes||[]).map(r=>({...r,_season:'summer'}))
    ];
    
    setPlan(prev => {
      const next = {...prev};
      DAYS.forEach(day => {
        MEALS.forEach(meal => {
          if (next[day][meal]) return;
          
          const filter = pickerFilters[day][meal];
          if (!filter.sections || filter.sections.length === 0) return;
          
          const candidates = allRecipes.filter(r => {
            if (!filter.sections.includes(r.section)) return false;
            if (filter.tags.length && !filter.tags.some(t => (r.tags||[]).includes(t))) return false;
            if (filter.search && !r.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
            return true;
          });
          
          if (candidates.length > 0) {
            const random = candidates[Math.floor(Math.random() * candidates.length)];
            next[day][meal] = random;
          }
        });
      });
      return next;
    });
  }, [recipes, plan, pickerFilters]);

  const resetPlan = useCallback(() => {
    if (!window.confirm('Reset the entire plan? This will clear all selected recipes and filters.')) return;
    setPlan(defaultPlan());
    setPickerFilters(defaultFilters());
  }, []);

  const isReadonly = plannerView !== 'current';
  const activePlan = isReadonly ? (archivedPlan || defaultPlan()) : (plan || defaultPlan());

  const currentPickerFilter = picker ? pickerFilters[picker.day]?.[picker.meal] : null;

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

      {(loading || planLoading) && <div className="app-status">Loading…</div>}
      {error && <div className="app-status error">Error: {error}</div>}

      {!loading && !planLoading && page === 'planner' && (
        <div className="app-layout-outer">
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

          {archiveLoading
            ? <div className="app-status">Loading plan…</div>
            : <PlannerView
                plan={activePlan}
                setPlan={setPlan}
                filters={pickerFilters}
                setFilters={setPickerFilters}
                readonly={isReadonly}
                recipes={recipes}
                openPicker={openPicker}
                fillPlan={fillPlan}
                resetPlan={resetPlan}
              />
          }
        </div>
      )}

      {!loading && page === 'editor' && (
        <RecipeEditor recipes={recipes} sourceFile={sourceFile} onSaved={handleRecipesSaved} />
      )}

      {picker && recipes && (
        <RecipePicker 
          recipes={recipes} 
          onSelect={handleSelectRecipe} 
          onClose={closePicker}
          initialFilters={currentPickerFilter}
          onFiltersChange={handlePickerFiltersChange}
        />
      )}
    </div>
  );
}
