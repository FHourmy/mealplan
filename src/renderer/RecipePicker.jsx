import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const DEFAULT_FILTERS = { season: 'winter', sections: [], tags: [], search: '' };

function Toggle({ label, active, onClick }) {
  return <button className={`filter-chip ${active ? 'active' : ''}`} onClick={onClick}>{label}</button>;
}

export default function RecipePicker({ recipes, onSelect, onClose, initialFilters, onFiltersChange }) {
  const [filters, setFilters] = useState(initialFilters || DEFAULT_FILTERS);
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Report filter changes back to parent - use a ref to avoid infinite loops
  const filtersChangeRef = useRef(onFiltersChange);
  filtersChangeRef.current = onFiltersChange;

  useEffect(() => {
    if (filtersChangeRef.current) {
      filtersChangeRef.current(filters);
    }
  }, [filters]);

  const set = useCallback((key, val) => setFilters(f => ({ ...f, [key]: val })), []);

  const pool = filters.season === 'winter'
    ? (recipes?.winter_recipes || [])
    : (recipes?.summer_recipes || []);

  const allSections = useMemo(() => [...new Set(pool.map(r => r.section).filter(Boolean))].sort(), [pool]);
  const allTags     = useMemo(() => {
    const s = new Set();
    pool.forEach(r => (r.tags || []).forEach(t => s.add(t)));
    return [...s].sort();
  }, [pool]);

  function toggleSection(s) {
    setFilters(f => ({
      ...f,
      sections: f.sections.includes(s) ? f.sections.filter(x => x !== s) : [...f.sections, s],
    }));
  }
  function toggleTag(t) {
    setFilters(f => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
    }));
  }
  function resetFilters() { setFilters(DEFAULT_FILTERS); }

  const filtered = useMemo(() => pool.filter(r => {
    if (filters.sections.length && !filters.sections.includes(r.section)) return false;
    if (filters.tags.length && !filters.tags.some(t => (r.tags || []).includes(t))) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchIngredients = (r.ingredients||[]).some(ing => {
        const name = (typeof ing === 'string' ? ing : ing.name||'').toLowerCase();
        return name.includes(q);
      });
      if (!matchName && !matchIngredients) return false;
    }
    return true;
  }), [pool, filters]);

  function pickRandom() {
    if (!filtered.length) return;
    const r = filtered[Math.floor(Math.random() * filtered.length)];
    onSelect(r);
    onClose();
  }

  const hasActiveFilters = filters.sections.length || filters.tags.length || filters.search;

  const normalizeIngredients = (ings) => {
    if (!ings) return [];
    return ings.map(ing => typeof ing === 'string' ? { name: ing, quantity: '' } : ing);
  };

  return (
    <div className="picker-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="picker-modal">
        <div className="picker-header">
          <h2 className="picker-title">Pick a Recipe</h2>
          <div className="picker-header-actions">
            {hasActiveFilters && (
              <button className="picker-reset-btn" onClick={resetFilters} title="Reset all filters">↺ Reset</button>
            )}
            <button className="picker-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="picker-filters">
          <div className="filter-row">
            <span className="filter-row-label">Season</span>
            <div className="chip-group">
              <Toggle label="❄️ Winter" active={filters.season === 'winter'} onClick={() => set('season', 'winter')} />
              <Toggle label="☀️ Summer" active={filters.season === 'summer'} onClick={() => set('season', 'summer')} />
            </div>
          </div>

          {allSections.length > 0 && (
            <div className="filter-row filter-row-wrap">
              <span className="filter-row-label">Sections</span>
              <div className="chip-group chip-group-wrap">
                {allSections.map(s => (
                  <Toggle key={s} label={s} active={filters.sections.includes(s)} onClick={() => toggleSection(s)} />
                ))}
              </div>
            </div>
          )}

          {allTags.length > 0 && (
            <div className="filter-row filter-row-wrap">
              <span className="filter-row-label">Tags</span>
              <div className="chip-group chip-group-wrap">
                {allTags.map(t => (
                  <Toggle key={t} label={t} active={filters.tags.includes(t)} onClick={() => toggleTag(t)} />
                ))}
              </div>
            </div>
          )}

          <input
            ref={searchRef}
            className="picker-search"
            type="text"
            placeholder="Search name or ingredients…"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
          />
        </div>

        <div className="picker-toolbar">
          <span className="picker-count">{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</span>
          <button className="picker-random-btn" onClick={pickRandom} disabled={!filtered.length} title="Pick a random recipe">
            🎲 Random
          </button>
        </div>

        <ul className="picker-list">
          {filtered.length === 0 && <li className="picker-empty">No recipes match these filters</li>}
          {filtered.map((recipe, i) => {
            const ingredients = normalizeIngredients(recipe.ingredients);
            return (
              <li key={i} className="picker-item" onClick={() => { onSelect(recipe); onClose(); }}>
                <div className="picker-item-main">
                  {recipe.recipe_number && <span className="picker-num">#{recipe.recipe_number}</span>}
                  <span className="picker-name">{recipe.name}</span>
                  {recipe.recipe_link && (
                    <a className="picker-link" href={recipe.recipe_link} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()} title="Open recipe">↗</a>
                  )}
                </div>
                <div className="picker-item-meta">
                  <span className="picker-section">{recipe.section}</span>
                  {ingredients.length > 0 && (
                    <span className="picker-ing-count">{ingredients.length} ingredients</span>
                  )}
                  {recipe.tags?.length > 0 && (
                    <span className="picker-tags-inline">
                      {recipe.tags.map(t => <span key={t} className="tag-badge">{t}</span>)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
