import React, { useState, useMemo } from 'react';
import RecipeModal from './RecipeModal';

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MEALS = ['Lunch','Dinner'];

export default function PlannerView({ plan, setPlan, filters, setFilters, readonly = false, openPicker, fillPlan, deletePlan }) {
  const [activeDay,    setActiveDay]    = useState('Monday');
  const [viewedRecipe, setViewedRecipe] = useState(null);
  const [hoveredIng,   setHoveredIng]   = useState(null);

  const clearMeal = (day, meal) => {
    if (readonly) return;
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], [meal]: null } }));
  };

  const shoppingList = useMemo(() => {
    const map = new Map();
    
    DAYS.forEach(day => {
      MEALS.forEach(meal => {
        const recipe = plan[day]?.[meal];
        if (!recipe) return;
        
        const ingredients = recipe.ingredients || [];
        ingredients.forEach(ing => {
          const ingObj = typeof ing === 'string' ? {name: ing, quantity: ''} : ing;
          if (!ingObj.name) return;
          
          const key = ingObj.name.toLowerCase().trim();
          if (!map.has(key)) {
            map.set(key, {name: ingObj.name.trim(), quantities: []});
          }
          const entry = map.get(key);
          entry.quantities.push({qty: ingObj.quantity?.trim() || '', recipe: recipe.name});
        });
      });
    });
    
    const list = [];
    map.forEach(({name, quantities}) => {
      const allQty = quantities.map(q => q.qty).filter(Boolean).join(' + ');
      const recipes = [...new Set(quantities.map(q => q.recipe))];
      list.push({name, quantity: allQty, recipes});
    });
    
    return list.sort((a,b) => a.name.localeCompare(b.name));
  }, [plan]);

  const copyShoppingList = () => {
    const text = shoppingList.map(item => {
      const qty = item.quantity ? `${item.quantity} ` : '';
      return `${qty}${item.name}`;
    }).join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      alert('Shopping list copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  return (
    <div className="planner-wrap">

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
                      onClick={() => openPicker(activeDay, meal)}
                      title="Change recipe"
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
                      <button className="meal-action-btn" onClick={() => setViewedRecipe(selected)} title="View details">📖</button>
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
          <div className="overview-header">
            <h3 className="overview-title">Weekly Overview</h3>
            <div className="overview-actions">
              <button className="overview-action-btn" onClick={fillPlan} title="Fill all empty meals">
                ↻ Fill
              </button>
              <button className="overview-action-btn overview-delete-btn" onClick={deletePlan} title="Delete this plan">
                🗑 Delete
              </button>
            </div>
          </div>
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
                  const filter = filters?.[day]?.[meal];
                  const hasFilter = filter?.sections && filter.sections.length > 0;
                  
                  return (
                    <div key={meal} className="ov-meal">
                      <span 
                        className="ov-meal-type"
                        onClick={(e) => {
                          if (recipe) {
                            e.stopPropagation();
                            setViewedRecipe(recipe);
                          }
                        }}
                        style={recipe ? {cursor: 'pointer'} : {}}
                      >
                        {meal[0]}
                      </span>
                      <span className="ov-meal-name">
                        {recipe ? recipe.name : hasFilter ? (
                          <span className="ov-filter-hint">{filter.sections.join(', ')}</span>
                        ) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {shoppingList.length > 0 && (
          <div className="shopping-section">
            <div className="shopping-header">
              <h3 className="shopping-title">Shopping List</h3>
              <button className="shopping-copy-btn" onClick={copyShoppingList} title="Copy to clipboard">
                📋 Copy
              </button>
            </div>
            <ul className="shopping-list">
              {shoppingList.map((item, i) => (
                <li
                  key={i}
                  className="shopping-item"
                  onMouseEnter={() => setHoveredIng(item.name)}
                  onMouseLeave={() => setHoveredIng(null)}
                >
                  {item.quantity && <span className="shopping-qty">{item.quantity}</span>}
                  <span className="shopping-name">{item.name}</span>
                  
                  {hoveredIng === item.name && item.recipes.length > 0 && (
                    <div className="shopping-popover">
                      <div className="shopping-popover-title">Used in:</div>
                      {item.recipes.map(r => (
                        <div key={r} className="shopping-popover-recipe">{r}</div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {viewedRecipe && (
        <RecipeModal recipe={viewedRecipe} onClose={() => setViewedRecipe(null)} />
      )}
    </div>
  );
}
