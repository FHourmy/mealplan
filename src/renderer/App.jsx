import React, { useState } from 'react';
import RecipePicker from './RecipePicker';
import RecipeEditor from './RecipeEditor';
import { useRecipes } from './useRecipes';

const DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

const defaultPlan = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = MEALS.reduce((m, meal) => { m[meal] = null; return m; }, {});
    return acc;
  }, {});

export default function App() {
  const [page, setPage]           = useState('planner'); // 'planner' | 'editor'
  const [plan, setPlan]           = useState(defaultPlan());
  const [activeDay, setActiveDay] = useState('Monday');
  const [picker, setPicker]       = useState(null);

  const { recipes, loading, error, sourceFile, reload } = useRecipes();

  const openPicker  = (day, meal) => setPicker({ day, meal });
  const closePicker = ()           => setPicker(null);

  const handleSelectRecipe = (recipe) => {
    if (!picker) return;
    setPlan(prev => ({ ...prev, [picker.day]: { ...prev[picker.day], [picker.meal]: recipe } }));
  };

  const clearMeal = (day, meal) =>
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], [meal]: null } }));

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">🥗 MealPlan</span>
          <span className="subtitle">
            {sourceFile ? `using ${sourceFile}` : 'Your weekly food planner'}
          </span>
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
        <div className="layout">
          <nav className="sidebar">
            {DAYS.map(day => (
              <button key={day} className={`day-btn ${activeDay === day ? 'active' : ''}`} onClick={() => setActiveDay(day)}>
                <span className="day-label">{day.slice(0,3)}</span>
                <span className="day-full">{day}</span>
                <span className="meal-count">{Object.values(plan[day]).filter(Boolean).length}/{MEALS.length}</span>
              </button>
            ))}
          </nav>

          <main className="content">
            <h2 className="day-title">{activeDay}</h2>
            <div className="meals-grid">
              {MEALS.map(meal => {
                const selected = plan[activeDay][meal];
                return (
                  <div key={meal} className={`meal-card ${selected ? 'has-recipe' : ''}`}>
                    <label className="meal-label">{meal}</label>
                    {selected ? (
                      <div className="meal-selected">
                        <div className="meal-selected-info">
                          <span className="meal-selected-name">{selected.name}</span>
                          {selected.recipe_number && <span className="meal-selected-num">#{selected.recipe_number}</span>}
                          <span className="meal-selected-section">{selected.section}</span>
                        </div>
                        <div className="meal-selected-actions">
                          {selected.recipe_link && (
                            <a className="meal-action-link" href={selected.recipe_link} target="_blank" rel="noreferrer" title="Open recipe">↗</a>
                          )}
                          <button className="meal-action-btn" onClick={() => openPicker(activeDay, meal)} title="Change">✎</button>
                          <button className="meal-action-btn meal-action-clear" onClick={() => clearMeal(activeDay, meal)} title="Clear">✕</button>
                        </div>
                      </div>
                    ) : (
                      <button className="meal-pick-btn" onClick={() => openPicker(activeDay, meal)}>+ Pick a recipe</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="overview">
              <h3 className="overview-title">Weekly Overview</h3>
              <div className="overview-grid">
                {DAYS.map(day => (
                  <div key={day} className={`overview-card ${activeDay === day ? 'current' : ''}`} onClick={() => setActiveDay(day)}>
                    <div className="ov-day">{day.slice(0,3)}</div>
                    {MEALS.map(meal => (
                      <div key={meal} className="ov-meal">
                        <span className="ov-meal-type">{meal[0]}</span>
                        <span className="ov-meal-name">{plan[day][meal]?.name || '—'}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </main>
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
