import React, { useState, useMemo, useEffect, useRef } from 'react';

const ALL_SECTIONS = '__all__';

export default function RecipePicker({ recipes, onSelect, onClose }) {
  const [season,  setSeason]  = useState('winter');
  const [section, setSection] = useState(ALL_SECTIONS);
  const [search,  setSearch]  = useState('');
  const searchRef             = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const pool = season === 'winter' ? (recipes?.winter_recipes || []) : (recipes?.summer_recipes || []);

  const sections = useMemo(() => [...new Set(pool.map(r => r.section))].sort(), [pool]);
  useEffect(() => { setSection(ALL_SECTIONS); }, [season]);

  const filtered = useMemo(() => pool.filter(r => {
    const matchSec = section === ALL_SECTIONS || r.section === section;
    const matchQ   = !search || r.name.toLowerCase().includes(search.toLowerCase());
    return matchSec && matchQ;
  }), [pool, section, search]);

  return (
    <div className="picker-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="picker-modal">
        <div className="picker-header">
          <h2 className="picker-title">Pick a Recipe</h2>
          <button className="picker-close" onClick={onClose}>✕</button>
        </div>
        <div className="picker-filters">
          <div className="season-toggle">
            <button className={`season-btn ${season === 'winter' ? 'active' : ''}`} onClick={() => setSeason('winter')}>❄️ Winter</button>
            <button className={`season-btn ${season === 'summer' ? 'active' : ''}`} onClick={() => setSeason('summer')}>☀️ Summer</button>
          </div>
          <select className="section-select" value={section} onChange={e => setSection(e.target.value)}>
            <option value={ALL_SECTIONS}>All sections</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input ref={searchRef} className="picker-search" type="text" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="picker-count">{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</div>
        <ul className="picker-list">
          {filtered.length === 0 && <li className="picker-empty">No recipes found</li>}
          {filtered.map((recipe, i) => (
            <li key={i} className="picker-item" onClick={() => { onSelect(recipe); onClose(); }}>
              <div className="picker-item-main">
                {recipe.recipe_number && <span className="picker-num">#{recipe.recipe_number}</span>}
                <span className="picker-name">{recipe.name}</span>
                {recipe.recipe_link && (
                  <a className="picker-link" href={recipe.recipe_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Open recipe">↗</a>
                )}
              </div>
              <div className="picker-item-meta">
                <span className="picker-section">{recipe.section}</span>
                {recipe.ingredients?.length > 0 && <span className="picker-ing-count">{recipe.ingredients.length} ingredients</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
