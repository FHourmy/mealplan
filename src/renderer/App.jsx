import React, { useState, useEffect, useCallback, useRef } from 'react';
import RecipePicker from './RecipePicker';
import RecipeEditor from './RecipeEditor';
import PlannerView  from './PlannerView';
import { useRecipes, savePlanToFile, deletePlanFile, listPlanFiles, readPlan } from './useRecipes';

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

function getTodayFilename() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `MP_${yyyy}-${mm}-${dd}.json`;
}

function formatPlanLabel(filename) {
  const m = filename.match(/^MP_(\d{4})-(\d{2})-(\d{2})(?:_(\d+))?\.json$/);
  if (!m) return filename;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const label = d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  return m[4] ? `${label} (${m[4]})` : label;
}

export default function App() {
  const [page, setPage] = useState('planner');
  const [selectedFile, setSelectedFile] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [picker, setPicker] = useState(null);
  
  const [pickerFilters, setPickerFilters] = useState(defaultFilters());
  const [planFiles, setPlanFiles] = useState([]);

  const saveTimer = useRef(null);
  const previousFile = useRef(null);
  const previousPlan = useRef(null);

  const { recipes, loading, error, sourceFile, reload } = useRecipes();

  const refreshPlanFiles = useCallback(async () => {
    const files = await listPlanFiles();
    setPlanFiles(files);
    return files;
  }, []);

  // Save immediately (used when switching files)
  const saveImmediately = useCallback(async (filename, plan) => {
    if (!filename || !plan) return;
    try {
      await savePlanToFile(filename, plan);
      await refreshPlanFiles();
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }, [refreshPlanFiles]);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      setPlanLoading(true);
      try {
        const files = await refreshPlanFiles();
        
        let fileToLoad;
        if (files.length === 0) {
          const todayFile = getTodayFilename();
          await savePlanToFile(todayFile, defaultPlan());
          await refreshPlanFiles();
          fileToLoad = todayFile;
        } else {
          fileToLoad = files[0];
        }
        
        setSelectedFile(fileToLoad);
        previousFile.current = fileToLoad;
        
        const data = await readPlan(fileToLoad);
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
          setActivePlan(normalized);
          previousPlan.current = normalized;
        } else {
          setActivePlan(defaultPlan());
          previousPlan.current = defaultPlan();
        }
      } catch {
        setActivePlan(defaultPlan());
        previousPlan.current = defaultPlan();
      } finally {
        setPlanLoading(false);
      }
    };
    initialize();
  }, [refreshPlanFiles, saveImmediately]);

  // Auto-save with debounce
  useEffect(() => {
    if (!activePlan || !selectedFile) return;
    
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    
    saveTimer.current = setTimeout(async () => {
      try { 
        await savePlanToFile(selectedFile, activePlan); 
        await refreshPlanFiles();
        previousPlan.current = activePlan;
      } catch {}
    }, 800);
    
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [activePlan, selectedFile, refreshPlanFiles]);

  // When selected file changes, save previous file immediately then load new file
  useEffect(() => {
    if (!selectedFile) return;
    
    const handleFileSwitch = async () => {
      // Save previous file immediately if it changed
      if (previousFile.current && previousPlan.current && previousFile.current !== selectedFile) {
        await saveImmediately(previousFile.current, previousPlan.current);
      }
      
      // Load new file
      try {
        const data = await readPlan(selectedFile);
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
          setActivePlan(normalized);
          previousPlan.current = normalized;
        } else {
          setActivePlan(defaultPlan());
          previousPlan.current = defaultPlan();
        }
      } catch {
        setActivePlan(defaultPlan());
        previousPlan.current = defaultPlan();
      }
      
      previousFile.current = selectedFile;
    };
    
    handleFileSwitch();
  }, [selectedFile, saveImmediately]);

  // Track plan changes
  useEffect(() => {
    if (activePlan) {
      previousPlan.current = activePlan;
    }
  }, [activePlan]);

  const openPicker  = (day, meal) => setPicker({ day, meal });
  const closePicker = ()           => setPicker(null);

  const handleSelectRecipe = (recipe) => {
    if (!picker) return;
    setActivePlan(prev => ({ ...prev, [picker.day]: { ...prev[picker.day], [picker.meal]: recipe } }));
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
    
    setActivePlan(prev => {
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
    if (!recipes) return;
    
    const allRecipes = [
      ...(recipes.winter_recipes||[]).map(r=>({...r,_season:'winter'})),
      ...(recipes.summer_recipes||[]).map(r=>({...r,_season:'summer'}))
    ];
    
    setActivePlan(prev => {
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
  }, [recipes, pickerFilters]);

  const deletePlan = useCallback(async () => {
    if (!selectedFile) return;
    
    if (!window.confirm(`Delete plan "${formatPlanLabel(selectedFile)}"? This cannot be undone.`)) return;
    
    try {
      await deletePlanFile(selectedFile);
      const files = await refreshPlanFiles();
      
      if (files.length > 0) {
        setSelectedFile(files[0]);
      } else {
        const todayFile = getTodayFilename();
        await savePlanToFile(todayFile, defaultPlan());
        await refreshPlanFiles();
        setSelectedFile(todayFile);
        setActivePlan(defaultPlan());
      }
    } catch (err) {
      alert('Failed to delete plan: ' + err.message);
    }
  }, [selectedFile, refreshPlanFiles]);

  const createNewPlan = useCallback(async () => {
    // Save current plan immediately before creating new one
    if (selectedFile && activePlan) {
      await saveImmediately(selectedFile, activePlan);
    }
    
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
      
      setSelectedFile(filename);
      setActivePlan(defaultPlan());
      setPickerFilters(defaultFilters());
      
    } catch (err) {
      console.error('Failed to create new plan:', err);
      alert('Failed to create new plan: ' + err.message);
    }
  }, [refreshPlanFiles, selectedFile, activePlan, saveImmediately]);

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

            {planFiles.map((file, index) => (
              <button
                key={file}
                className={`plan-sidebar-item ${selectedFile === file ? 'active' : ''}`}
                onClick={() => setSelectedFile(file)}
              >
                <span className="plan-sidebar-label">{formatPlanLabel(file)}</span>
                <span className="plan-sidebar-sub">{index === 0 ? 'current' : 'saved'}</span>
              </button>
            ))}
          </nav>

          <PlannerView
            plan={activePlan || defaultPlan()}
            setPlan={setActivePlan}
            filters={pickerFilters}
            setFilters={setPickerFilters}
            readonly={false}
            recipes={recipes}
            openPicker={openPicker}
            fillPlan={fillPlan}
            deletePlan={deletePlan}
            onEnableEditing={null}
          />
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
