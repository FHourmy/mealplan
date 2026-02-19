import React, { useState, useEffect, useCallback, useRef } from 'react';
import RecipePicker from './RecipePicker';
import RecipeEditor from './RecipeEditor';
import PlannerView  from './PlannerView';
import { useRecipes, savePlan, savePlanToFile, deletePlanFile, listPlanFiles, readPlan } from './useRecipes';

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
  const m = filename.match(/^MP_(\d{4})-(\d{2})-(\d{2})(?:_(\d+))?\.json$/);
  if (!m) return filename;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const label = d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  return m[4] ? `${label} (${m[4]})` : label;
}

export default function App() {
  const [page,    setPage]    = useState('planner');
  const [plannerView, setPlannerView] = useState('current');
  const [editingFile, setEditingFile] = useState(null);

  const [currentPlan, setCurrentPlan] = useState(null);
  const [archivedPlan, setArchivedPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [picker, setPicker] = useState(null);
  
  const [pickerFilters, setPickerFilters] = useState(defaultFilters());

  const [planFiles, setPlanFiles] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Refs to hold save timers so we can clear them
  const currentPlanSaveTimer = useRef(null);
  const archivedPlanSaveTimer = useRef(null);

  const { recipes, loading, error, sourceFile, reload } = useRecipes();

  const refreshPlanFiles = useCallback(async () => {
    const files = await listPlanFiles();
    setPlanFiles(files);
    return files;
  }, []);

  const loadCurrentPlan = useCallback(async () => {
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
          setCurrentPlan(normalized);
        } else {
          setCurrentPlan(defaultPlan());
        }
      } else {
        setCurrentPlan(defaultPlan());
      }
    } catch {
      setCurrentPlan(defaultPlan());
    } finally {
      setPlanLoading(false);
    }
  }, [refreshPlanFiles]);

  useEffect(() => {
    loadCurrentPlan();
  }, [loadCurrentPlan]);

  // Auto-save current plan - clear timer on cleanup
  useEffect(() => {
    if (!currentPlan || plannerView !== 'current') {
      // Clear any pending save when leaving current view
      if (currentPlanSaveTimer.current) {
        clearTimeout(currentPlanSaveTimer.current);
        currentPlanSaveTimer.current = null;
      }
      return;
    }
    
    currentPlanSaveTimer.current = setTimeout(async () => {
      try { 
        await savePlan(currentPlan); 
        await refreshPlanFiles(); 
      } catch {}
    }, 800);
    
    return () => {
      if (currentPlanSaveTimer.current) {
        clearTimeout(currentPlanSaveTimer.current);
        currentPlanSaveTimer.current = null;
      }
    };
  }, [currentPlan, plannerView, refreshPlanFiles]);

  // Auto-save archived plan when editing - clear timer on cleanup
  useEffect(() => {
    if (!archivedPlan || !editingFile || plannerView === 'current') {
      // Clear any pending save when leaving archived view
      if (archivedPlanSaveTimer.current) {
        clearTimeout(archivedPlanSaveTimer.current);
        archivedPlanSaveTimer.current = null;
      }
      return;
    }
    
    archivedPlanSaveTimer.current = setTimeout(async () => {
      try { 
        await savePlanToFile(editingFile, archivedPlan); 
        await refreshPlanFiles(); 
      } catch {}
    }, 800);
    
    return () => {
      if (archivedPlanSaveTimer.current) {
        clearTimeout(archivedPlanSaveTimer.current);
        archivedPlanSaveTimer.current = null;
      }
    };
  }, [archivedPlan, editingFile, plannerView, refreshPlanFiles]);

  // Load archived plan when switching to it
  useEffect(() => {
    if (plannerView === 'current') { 
      setArchivedPlan(null);
      setEditingFile(null);
      return; 
    }
    
    setArchiveLoading(true);
    setEditingFile(null);
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
    
    if (plannerView === 'current') {
      setCurrentPlan(prev => ({ ...prev, [picker.day]: { ...prev[picker.day], [picker.meal]: recipe } }));
    } else {
      setArchivedPlan(prev => ({ ...prev, [picker.day]: { ...prev[picker.day], [picker.meal]: recipe } }));
    }
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
    
    const updatePlanRecipes = (plan) => {
      if (!plan) return plan;
      const next = {...plan};
      DAYS.forEach(day => {
        MEALS.forEach(meal => {
          const current = plan[day]?.[meal];
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
    };
    
    setCurrentPlan(updatePlanRecipes);
    if (archivedPlan) {
      setArchivedPlan(updatePlanRecipes);
    }
  }, [reload, archivedPlan]);

  const fillPlan = useCallback(() => {
    if (!recipes) return;
    
    const allRecipes = [
      ...(recipes.winter_recipes||[]).map(r=>({...r,_season:'winter'})),
      ...(recipes.summer_recipes||[]).map(r=>({...r,_season:'summer'}))
    ];
    
    const fillLogic = (prev) => {
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
    };

    if (plannerView === 'current') {
      setCurrentPlan(fillLogic);
    } else {
      setArchivedPlan(fillLogic);
    }
  }, [recipes, pickerFilters, plannerView]);

  const deletePlan = useCallback(async () => {
    let fileToDelete;
    
    if (plannerView === 'current') {
      const files = await listPlanFiles();
      if (files.length === 0) {
        alert('No plan file to delete');
        return;
      }
      fileToDelete = files[0];
    } else {
      fileToDelete = plannerView;
    }
    
    if (!window.confirm(`Delete plan "${formatPlanLabel(fileToDelete)}"? This cannot be undone.`)) return;
    
    try {
      await deletePlanFile(fileToDelete);
      const files = await refreshPlanFiles();
      
      setPlannerView('current');
      await loadCurrentPlan();
      
    } catch (err) {
      alert('Failed to delete plan: ' + err.message);
    }
  }, [plannerView, refreshPlanFiles, loadCurrentPlan]);

  const createNewPlan = useCallback(async () => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const baseFilename = `MP_${yyyy}-${mm}-${dd}`;
      
      const files = await listPlanFiles();
      
      const pattern = new RegExp(`^MP_${yyyy}-${mm}-${dd}(?:_(\\d+))?\\.json$`);
      const existing = files.filter(f => pattern.test(f));
      
      let filename;
      if (existing.length === 0) {
        filename = `${baseFilename}.json`;
      } else {
        const counts = existing.map(f => {
          const m = f.match(pattern);
          return m && m[1] ? parseInt(m[1]) : 0;
        });
        const maxCount = Math.max(...counts);
        filename = `${baseFilename}_${maxCount + 1}.json`;
      }
      
      await savePlanToFile(filename, defaultPlan());
      await refreshPlanFiles();
      
      setPlannerView('current');
      setCurrentPlan(defaultPlan());
      setPickerFilters(defaultFilters());
      await loadCurrentPlan();
      
    } catch (err) {
      console.error('Failed to create new plan:', err);
      alert('Failed to create new plan: ' + err.message);
    }
  }, [refreshPlanFiles, loadCurrentPlan]);

  const enableEditingArchived = useCallback(() => {
    if (plannerView === 'current' || !archivedPlan) return;
    setEditingFile(plannerView);
  }, [plannerView, archivedPlan]);

  const isEditingArchived = plannerView !== 'current' && editingFile === plannerView;
  const isReadonly = plannerView !== 'current' && !isEditingArchived;
  
  const activePlan = plannerView === 'current' ? currentPlan : archivedPlan;
  const setActivePlan = plannerView === 'current' ? setCurrentPlan : setArchivedPlan;

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

            <button className="plan-new-btn" onClick={createNewPlan} title="Create new plan">
              + New Plan
            </button>

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
                <span className="plan-sidebar-sub">{editingFile === file ? 'editing' : 'saved'}</span>
              </button>
            ))}
          </nav>

          {archiveLoading
            ? <div className="app-status">Loading plan…</div>
            : <PlannerView
                plan={activePlan || defaultPlan()}
                setPlan={isReadonly ? null : setActivePlan}
                filters={pickerFilters}
                setFilters={setPickerFilters}
                readonly={isReadonly}
                recipes={recipes}
                openPicker={openPicker}
                fillPlan={fillPlan}
                deletePlan={deletePlan}
                onEnableEditing={isReadonly ? enableEditingArchived : null}
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
