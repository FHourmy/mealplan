import React, { useState, useMemo, useEffect } from 'react';
import { saveRecipes } from './useRecipes';

const EMPTY_RECIPE = () => ({
  recipe_number: '',
  name: '',
  section: '',
  ingredients: [''],
  recipe_link: '',
});

export default function RecipeEditor({ recipes, sourceFile, onSaved }) {
  const allRecipes = useMemo(() => [
    ...( recipes?.winter_recipes || []).map(r => ({ ...r, _season: 'winter' })),
    ...( recipes?.summer_recipes || []).map(r => ({ ...r, _season: 'summer' })),
  ], [recipes]);

  const allSections = useMemo(() => {
    const s = new Set(allRecipes.map(r => r.section).filter(Boolean));
    return [...s].sort();
  }, [allRecipes]);

  // List state
  const [filterSeason,  setFilterSeason]  = useState('all');
  const [filterSection, setFilterSection] = useState('');
  const [search,        setSearch]        = useState('');

  // Editor state
  const [editing,   setEditing]   = useState(null);   // recipe index in allRecipes, or 'new'
  const [form,      setForm]      = useState(null);
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState('');
  const [localList, setLocalList] = useState(null);   // mutated copy

  // initialise localList from props
  useEffect(() => {
    if (recipes && !localList) {
      setLocalList({
        winter_recipes: recipes.winter_recipes.map(r => ({ ...r })),
        summer_recipes: recipes.summer_recipes.map(r => ({ ...r })),
      });
    }
  }, [recipes]);

  const workingList = localList || { winter_recipes: [], summer_recipes: [] };

  const flatList = useMemo(() => [
    ...workingList.winter_recipes.map((r, i) => ({ ...r, _season: 'winter', _idx: i })),
    ...workingList.summer_recipes.map((r, i) => ({ ...r, _season: 'summer',  _idx: i })),
  ], [workingList]);

  const filtered = useMemo(() => flatList.filter(r => {
    if (filterSeason !== 'all' && r._season !== filterSeason) return false;
    if (filterSection && r.section !== filterSection) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [flatList, filterSeason, filterSection, search]);

  // ── Open editor ──────────────────────────────────────────────
  function openNew() {
    setForm({ ...EMPTY_RECIPE(), _season: 'winter' });
    setEditing('new');
    setErrors({});
  }

  function openEdit(r) {
    setForm({
      recipe_number: r.recipe_number ?? '',
      name: r.name,
      section: r.section || '',
      ingredients: r.ingredients?.length ? [...r.ingredients] : [''],
      recipe_link: r.recipe_link || '',
      _season: r._season,
      _idx: r._idx,
    });
    setEditing(`${r._season}-${r._idx}`);
    setErrors({});
  }

  function closeEditor() { setEditing(null); setForm(null); setErrors({}); }

  // ── Form helpers ─────────────────────────────────────────────
  function setField(key, value) { setForm(f => ({ ...f, [key]: value })); }

  function setIngredient(i, value) {
    setForm(f => {
      const ing = [...f.ingredients];
      ing[i] = value;
      return { ...f, ingredients: ing };
    });
  }
  function addIngredient()    { setForm(f => ({ ...f, ingredients: [...f.ingredients, ''] })); }
  function removeIngredient(i) {
    setForm(f => {
      const ing = f.ingredients.filter((_, idx) => idx !== i);
      return { ...f, ingredients: ing.length ? ing : [''] };
    });
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    return e;
  }

  // ── Save form into localList ──────────────────────────────────
  function applyEdit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const cleaned = {
      name: form.name.trim(),
      section: form.section.trim(),
      ingredients: form.ingredients.map(s => s.trim()).filter(Boolean),
    };
    if (form.recipe_number !== '' && form.recipe_number !== null)
      cleaned.recipe_number = Number(form.recipe_number);
    if (form.recipe_link.trim())
      cleaned.recipe_link = form.recipe_link.trim();

    setLocalList(prev => {
      const next = {
        winter_recipes: [...prev.winter_recipes],
        summer_recipes: [...prev.summer_recipes],
      };
      const key = `${form._season}_recipes`;
      if (editing === 'new') {
        next[key] = [...next[key], cleaned];
      } else {
        const arr = [...next[key]];
        arr[form._idx] = cleaned;
        next[key] = arr;
      }
      return next;
    });
    closeEditor();
  }

  // ── Delete ────────────────────────────────────────────────────
  function deleteRecipe(r) {
    if (!window.confirm(`Delete "${r.name}"?`)) return;
    setLocalList(prev => {
      const next = {
        winter_recipes: [...prev.winter_recipes],
        summer_recipes: [...prev.summer_recipes],
      };
      const key = `${r._season}_recipes`;
      next[key] = next[key].filter((_, i) => i !== r._idx);
      return next;
    });
  }

  // ── Persist to disk ───────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      const { filename } = await saveRecipes(workingList);
      setSaveMsg(`✓ Saved as ${filename}`);
      if (onSaved) onSaved();
    } catch (err) {
      setSaveMsg(`✗ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!localList) return <div className="editor-loading">Loading recipes…</div>;

  return (
    <div className="editor-layout">
      {/* ── Left panel: list ── */}
      <div className="editor-panel">
        <div className="editor-panel-header">
          <h2 className="editor-title">Recipes</h2>
          <button className="editor-new-btn" onClick={openNew}>+ New</button>
        </div>

        {/* Filters */}
        <div className="editor-filters">
          <div className="season-toggle">
            {['all','winter','summer'].map(s => (
              <button key={s}
                className={`season-btn ${filterSeason === s ? 'active' : ''}`}
                onClick={() => setFilterSeason(s)}
              >
                {s === 'all' ? '🌍 All' : s === 'winter' ? '❄️ Winter' : '☀️ Summer'}
              </button>
            ))}
          </div>
          <select className="section-select" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
            <option value="">All sections</option>
            {allSections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="picker-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="editor-count">{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</div>

        <ul className="editor-list">
          {filtered.map((r) => (
            <li key={`${r._season}-${r._idx}`} className="editor-item">
              <div className="editor-item-info">
                {r.recipe_number && <span className="picker-num">#{r.recipe_number}</span>}
                <span className="editor-item-name">{r.name}</span>
                <span className={`editor-season-tag ${r._season}`}>{r._season === 'winter' ? '❄️' : '☀️'}</span>
              </div>
              <div className="editor-item-section">{r.section}</div>
              <div className="editor-item-actions">
                <button className="editor-btn-edit" onClick={() => openEdit(r)}>Edit</button>
                <button className="editor-btn-delete" onClick={() => deleteRecipe(r)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>

        {/* Save to file */}
        <div className="editor-save-bar">
          {saveMsg && <span className="editor-save-msg">{saveMsg}</span>}
          <button className="editor-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save to file'}
          </button>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      {form && (
        <div className="editor-form-panel">
          <div className="editor-form-header">
            <h3 className="editor-form-title">{editing === 'new' ? 'New Recipe' : 'Edit Recipe'}</h3>
            <button className="picker-close" onClick={closeEditor}>✕</button>
          </div>

          {/* Season (for new recipes) */}
          {editing === 'new' && (
            <div className="form-group">
              <label className="form-label">Season</label>
              <div className="season-toggle">
                <button className={`season-btn ${form._season === 'winter' ? 'active' : ''}`} onClick={() => setField('_season','winter')}>❄️ Winter</button>
                <button className={`season-btn ${form._season === 'summer' ? 'active' : ''}`} onClick={() => setField('_season','summer')}>☀️ Summer</button>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="form-group">
            <label className="form-label">Name <span className="form-required">*</span></label>
            <input
              className={`form-input ${errors.name ? 'form-input-error' : ''}`}
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="e.g. Pumpkin Pasta"
            />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          {/* Recipe number */}
          <div className="form-group">
            <label className="form-label">Recipe number <span className="form-optional">optional</span></label>
            <input
              className="form-input"
              type="number"
              value={form.recipe_number}
              onChange={e => setField('recipe_number', e.target.value)}
              placeholder="e.g. 9"
              min="1"
            />
          </div>

          {/* Section */}
          <div className="form-group">
            <label className="form-label">Section <span className="form-optional">optional</span></label>
            <input
              className="form-input"
              list="section-options"
              value={form.section}
              onChange={e => setField('section', e.target.value)}
              placeholder="Type or pick a section…"
            />
            <datalist id="section-options">
              {allSections.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Link */}
          <div className="form-group">
            <label className="form-label">Recipe link <span className="form-optional">optional</span></label>
            <input
              className="form-input"
              type="url"
              value={form.recipe_link}
              onChange={e => setField('recipe_link', e.target.value)}
              placeholder="https://…"
            />
          </div>

          {/* Ingredients */}
          <div className="form-group">
            <label className="form-label">Ingredients <span className="form-optional">optional</span></label>
            <div className="ingredients-list">
              {form.ingredients.map((ing, i) => (
                <div key={i} className="ingredient-row">
                  <input
                    className="form-input ingredient-input"
                    value={ing}
                    onChange={e => setIngredient(i, e.target.value)}
                    placeholder={`Ingredient ${i + 1}`}
                  />
                  <button className="ing-remove-btn" onClick={() => removeIngredient(i)} title="Remove">✕</button>
                </div>
              ))}
              <button className="ing-add-btn" onClick={addIngredient}>+ Add ingredient</button>
            </div>
          </div>

          <div className="form-actions">
            <button className="form-cancel-btn" onClick={closeEditor}>Cancel</button>
            <button className="form-apply-btn" onClick={applyEdit}>
              {editing === 'new' ? 'Add recipe' : 'Apply changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
