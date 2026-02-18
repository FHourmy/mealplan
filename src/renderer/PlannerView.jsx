import React, { useState } from 'react';
import RecipeModal from './RecipeModal';

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MEALS = ['Lunch','Dinner'];

export default function PlannerView({ plan, setPlan, readonly = false, openPicker }) {
  const [activeDay,    setActiveDay]    = useState('Monday');
  const [viewedRecipe, setViewedRecipe] = useState(null);

  const clearMeal = (day, meal) => {
    if (readonly) return;
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], [meal]: null } }));
  };

  return (
    <div className="planner-wrap">

      {/* Day tabs */}
      <div className="day-tabs">
        {DAYS.map(day => {
          const filled = Object.values(plan[day] || {}).filter(Boolean).length;
          return (
            <button
              key={day}
              className={`day-tab ${activeDay === day ? 'active' : ''}`}
              onClick={() => setActiveDay(day)}
            >
              <span className="day-tab-label">{day.slice(0,3)}</span>
              {filled > 0 && <span className="day-tab-dot" />}
            </button>
          );
        })}
        {readonly && <span className="readonly-badge">Read only</span>}
      </div>

      <main className="content">
        <h2 className="day-title">{activeDay}</h2>

        <div className="meals-grid">
          {MEALS.map(meal => {
            const selected = plan[activeDay]?.[meal];
            return (
              <div key={meal} className={`meal-card ${selected ? 'has-recipe' : ''}`}>
                <label className="meal-label">{meal}</label>
                {selected ? (
                  <div className="meal-selected">
                    <div
                      className="meal-selected-info meal-selected-clickable"
                      onClick={() => readonly ? setViewedRecipe(selected) : openPicker(activeDay, meal)}
                      title={readonly ? "View recipe details" : "Change recipe"}
                    >
                      <span className="meal-selected-name">{selected.name}</span>
                      {selected.recipe_number && <span className="meal-selected-num">#{selected.recipe_number}</span>}
                      <span className="meal-selected-section">{selected.section}</span>
                      {selected.tags?.length > 0 && (
                        <span className="meal-tags-row">
                          {selected.tags.map(t => <span key={t} className="tag-badge">{t}</span>)}
                        </span>
                      )}
                    </div>
                    <div className="meal-selected-actions">
                      {selected.recipe_link && (
                        <a className="meal-action-link" href={selected.recipe_link} target="_blank" rel="noreferrer" title="Open recipe">↗</a>
                      )}
                      {!readonly && <>
                        <button className="meal-action-btn" onClick={() => setViewedRecipe(selected)} title="View details">📖</button>
                        <button className="meal-action-btn meal-action-clear" onClick={() => clearMeal(activeDay, meal)} title="Clear">✕</button>
                      </>}
                    </div>
                  </div>
                ) : (
                  readonly
                    ? <div className="meal-empty-readonly">—</div>
                    : <button className="meal-pick-btn" onClick={() => openPicker(activeDay, meal)}>+ Pick a recipe</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Weekly overview */}
        <div className="overview">
          <h3 className="overview-title">Weekly Overview</h3>
          <div className="overview-grid">
            {DAYS.map(day => (
              <div
                key={day}
                className={`overview-card ${activeDay === day ? 'current' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                <div className="ov-day">{day.slice(0,3)}</div>
                {MEALS.map(meal => {
                  const recipe = plan[day]?.[meal];
                  return (
                    <div
                      key={meal}
                      className="ov-meal"
                      onClick={(e) => {
                        if (recipe) {
                          e.stopPropagation();
                          setViewedRecipe(recipe);
                        }
                      }}
                    >
                      <span className="ov-meal-type">{meal[0]}</span>
                      <span className={`ov-meal-name ${recipe ? 'ov-meal-clickable' : ''}`}>
                        {recipe?.name || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </main>

      {viewedRecipe && (
        <RecipeModal recipe={viewedRecipe} onClose={() => setViewedRecipe(null)} />
      )}
    </div>
  );
}
