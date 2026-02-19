import React, { useState, useMemo, useEffect } from 'react';
import { saveRecipes } from './useRecipes';

const EMPTY_RECIPE = () => ({
  recipe_number:'', name:'', section:'', 
  ingredients:[{name:'',quantity:''}], 
  recipe_link:'', tags:[''], _season:'winter'
});

export default function RecipeEditor({ recipes, sourceFile, onSaved }) {
  const allRecipes = useMemo(() => [
    ...(recipes?.winter_recipes||[]).map(r=>({...r,_season:'winter'})),
    ...(recipes?.summer_recipes||[]).map(r=>({...r,_season:'summer'})),
  ], [recipes]);
  const allSections = useMemo(()=>[...new Set(allRecipes.map(r=>r.section).filter(Boolean))].sort(),[allRecipes]);
  const allTags     = useMemo(()=>{const s=new Set();allRecipes.forEach(r=>(r.tags||[]).forEach(t=>s.add(t)));return [...s].sort();},[allRecipes]);

  const [filterSeason,setFilterSeason]=useState('all');
  const [filterSection,setFilterSection]=useState('');
  const [filterTags,setFilterTags]=useState([]);
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(null);
  const [errors,setErrors]=useState({});
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');
  const [localList,setLocalList]=useState(null);

  useEffect(()=>{ 
    if(recipes&&!localList) {
      const normalize = r => ({
        ...r,
        ingredients: (r.ingredients||[]).map(ing => 
          typeof ing === 'string' ? {name:ing,quantity:''} : {...ing, quantity:ing.quantity||''}
        )
      });
      setLocalList({
        winter_recipes:recipes.winter_recipes.map(normalize),
        summer_recipes:recipes.summer_recipes.map(normalize)
      }); 
    }
  },[recipes, localList]);

  const workingList = localList||{winter_recipes:[],summer_recipes:[]};
  const flatList = useMemo(()=>[
    ...workingList.winter_recipes.map((r,i)=>({...r,_season:'winter',_idx:i})),
    ...workingList.summer_recipes.map((r,i)=>({...r,_season:'summer',_idx:i})),
  ],[workingList]);

  const filtered = useMemo(()=>flatList.filter(r=>{
    if(filterSeason!=='all'&&r._season!==filterSeason) return false;
    if(filterSection&&r.section!==filterSection) return false;
    if(filterTags.length&&!filterTags.some(t=>(r.tags||[]).includes(t))) return false;
    if(search) {
      const q = search.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchIngredients = (r.ingredients||[]).some(ing => {
        const name = (typeof ing === 'string' ? ing : ing.name||'').toLowerCase();
        return name.includes(q);
      });
      if(!matchName && !matchIngredients) return false;
    }
    return true;
  }),[flatList,filterSeason,filterSection,filterTags,search]);

  function openNew(){ setForm(EMPTY_RECIPE()); setEditing('new'); setErrors({}); }
  function openEdit(r){ 
    setForm({
      recipe_number:r.recipe_number??'',
      name:r.name,
      section:r.section||'',
      ingredients:(r.ingredients?.length?r.ingredients:[{name:'',quantity:''}]).map(ing=>({
        name:ing.name||'',
        quantity:ing.quantity||''
      })),
      recipe_link:r.recipe_link||'',
      tags:r.tags?.length?[...r.tags]:[''],
      _season:r._season,
      _idx:r._idx
    }); 
    setEditing(`${r._season}-${r._idx}`); 
    setErrors({}); 
  }
  function closeEditor(){ setEditing(null); setForm(null); setErrors({}); }
  function setField(k,v){ setForm(f=>({...f,[k]:v})); }

  function setIngredient(i,field,v){ 
    setForm(f=>{
      const a=[...f.ingredients];
      a[i]={...a[i],[field]:v};
      return{...f,ingredients:a};
    }); 
  }
  function addIngredient(){ setForm(f=>({...f,ingredients:[...f.ingredients,{name:'',quantity:''}]})); }
  function removeIngredient(i){ 
    setForm(f=>{
      const a=f.ingredients.filter((_,idx)=>idx!==i);
      return{...f,ingredients:a.length?a:[{name:'',quantity:''}]};
    }); 
  }

  function setTag(i,v){ setForm(f=>{const a=[...f.tags];a[i]=v;return{...f,tags:a};}); }
  function addTag(){ setForm(f=>({...f,tags:[...f.tags,'']})); }
  function removeTag(i){ setForm(f=>{const a=f.tags.filter((_,idx)=>idx!==i);return{...f,tags:a.length?a:['']};}); }

  function applyEdit(){
    const e={};
    if(!form.name.trim()) e.name='Name is required';
    if(Object.keys(e).length){setErrors(e);return;}
    
    const cleaned={
      name:form.name.trim(),
      section:form.section.trim(),
      ingredients:form.ingredients
        .filter(ing=>ing.name && ing.name.trim())
        .map(ing=>({
          name:ing.name.trim(),
          ...(ing.quantity && ing.quantity.trim() && {quantity:ing.quantity.trim()})
        })),
      tags:form.tags.map(s=>s.trim()).filter(Boolean)
    };
    if(form.recipe_number!==''&&form.recipe_number!==null) cleaned.recipe_number=Number(form.recipe_number);
    if(form.recipe_link.trim()) cleaned.recipe_link=form.recipe_link.trim();
    
    setLocalList(prev=>{
      const next={winter_recipes:[...prev.winter_recipes],summer_recipes:[...prev.summer_recipes]};
      const key=`${form._season}_recipes`;
      if(editing==='new'){ next[key]=[...next[key],cleaned]; }
      else{ const arr=[...next[key]]; arr[form._idx]=cleaned; next[key]=arr; }
      return next;
    });
    closeEditor();
  }

  function deleteRecipe(r){
    if(!window.confirm(`Delete "${r.name}"?`)) return;
    setLocalList(prev=>{
      const next={winter_recipes:[...prev.winter_recipes],summer_recipes:[...prev.summer_recipes]};
      next[`${r._season}_recipes`]=next[`${r._season}_recipes`].filter((_,i)=>i!==r._idx);
      return next;
    });
  }

  async function handleSave(){
    setSaving(true);setSaveMsg('');
    try{ 
      const{filename}=await saveRecipes(workingList); 
      setSaveMsg(`✓ Saved as ${filename}`); 
      if(onSaved) onSaved(workingList);
    }
    catch(err){ setSaveMsg(`✗ ${err.message}`); }
    finally{ setSaving(false); }
  }

  if(!localList) return <div className="editor-loading">Loading recipes…</div>;

  return (
    <div className="editor-layout">
      <div className="editor-panel">
        <div className="editor-panel-header">
          <h2 className="editor-title">Recipes</h2>
          <button className="editor-new-btn" onClick={openNew}>+ New</button>
        </div>
        <div className="editor-filters">
          <div className="season-toggle">
            {['all','winter','summer'].map(s=>(
              <button key={s} className={`season-btn ${filterSeason===s?'active':''}`} onClick={()=>setFilterSeason(s)}>
                {s==='all'?'🌍 All':s==='winter'?'❄️ Winter':'☀️ Summer'}
              </button>
            ))}
          </div>
          <select className="section-select" value={filterSection} onChange={e=>setFilterSection(e.target.value)}>
            <option value="">All sections</option>
            {allSections.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          {allTags.length>0&&(
            <div className="chip-group chip-group-wrap">
              {allTags.map(t=>(
                <button key={t} className={`filter-chip small ${filterTags.includes(t)?'active':''}`} 
                  onClick={()=>setFilterTags(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <input className="picker-search" placeholder="Search name or ingredients…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="editor-count">{filtered.length} recipe{filtered.length!==1?'s':''}</div>
        <ul className="editor-list">
          {filtered.map(r=>(
            <li key={`${r._season}-${r._idx}`} className="editor-item" onClick={()=>openEdit(r)}>
              <div className="editor-item-info">
                {r.recipe_number&&<span className="picker-num">#{r.recipe_number}</span>}
                <span className="editor-item-name">{r.name}</span>
                <span className={`editor-season-tag ${r._season}`}>{r._season==='winter'?'❄️':'☀️'}</span>
              </div>
              <div className="editor-item-section">{r.section}</div>
              {r.tags?.length>0&&<div className="editor-item-tags">{r.tags.map(t=><span key={t} className="tag-badge">{t}</span>)}</div>}
              <div className="editor-item-actions">
                <button className="editor-btn-delete" onClick={(e)=>{e.stopPropagation();deleteRecipe(r);}}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="editor-save-bar">
          {saveMsg&&<span className="editor-save-msg">{saveMsg}</span>}
          <button className="editor-save-btn" onClick={handleSave} disabled={saving}>{saving?'Saving…':'💾 Save to file'}</button>
        </div>
      </div>

      {form&&(
        <div className="editor-form-panel">
          <div className="editor-form-header">
            <h3 className="editor-form-title">{editing==='new'?'New Recipe':'Edit Recipe'}</h3>
            <button className="picker-close" onClick={closeEditor}>✕</button>
          </div>
          {editing==='new'&&(
            <div className="form-group">
              <label className="form-label">Season</label>
              <div className="season-toggle">
                <button className={`season-btn ${form._season==='winter'?'active':''}`} onClick={()=>setField('_season','winter')}>❄️ Winter</button>
                <button className={`season-btn ${form._season==='summer'?'active':''}`} onClick={()=>setField('_season','summer')}>☀️ Summer</button>
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Name <span className="form-required">*</span></label>
            <input className={`form-input ${errors.name?'form-input-error':''}`} value={form.name} onChange={e=>setField('name',e.target.value)} placeholder="e.g. Pumpkin Pasta"/>
            {errors.name&&<span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Recipe number <span className="form-optional">optional</span></label>
            <input className="form-input" type="number" value={form.recipe_number} onChange={e=>setField('recipe_number',e.target.value)} placeholder="e.g. 9" min="1"/>
          </div>
          <div className="form-group">
            <label className="form-label">Section <span className="form-optional">optional</span></label>
            <input className="form-input" list="section-options" value={form.section} onChange={e=>setField('section',e.target.value)} placeholder="Type or pick a section…"/>
            <datalist id="section-options">{allSections.map(s=><option key={s} value={s}/>)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Recipe link <span className="form-optional">optional</span></label>
            <input className="form-input" type="url" value={form.recipe_link} onChange={e=>setField('recipe_link',e.target.value)} placeholder="https://…"/>
          </div>
          <div className="form-group">
            <label className="form-label">Tags <span className="form-optional">optional</span></label>
            <div className="ingredients-list">
              {form.tags.map((tag,i)=>(
                <div key={i} className="ingredient-row">
                  <input className="form-input ingredient-input" value={tag} onChange={e=>setTag(i,e.target.value)} placeholder={`Tag ${i+1}`} list="tags-datalist"/>
                  <button className="ing-remove-btn" onClick={()=>removeTag(i)} title="Remove">✕</button>
                </div>
              ))}
              <datalist id="tags-datalist">{allTags.map(t=><option key={t} value={t}/>)}</datalist>
              <button className="ing-add-btn" onClick={addTag}>+ Add tag</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Ingredients <span className="form-optional">optional</span></label>
            <div className="ingredients-list">
              {form.ingredients.map((ing,i)=>(
                <div key={i} className="ingredient-row-with-qty">
                  <input 
                    className="form-input ingredient-qty-input" 
                    value={ing.quantity||''} 
                    onChange={e=>setIngredient(i,'quantity',e.target.value)} 
                    placeholder="Qty"
                  />
                  <input 
                    className="form-input ingredient-input" 
                    value={ing.name||''} 
                    onChange={e=>setIngredient(i,'name',e.target.value)} 
                    placeholder={`Ingredient ${i+1}`}
                  />
                  <button className="ing-remove-btn" onClick={()=>removeIngredient(i)} title="Remove">✕</button>
                </div>
              ))}
              <button className="ing-add-btn" onClick={addIngredient}>+ Add ingredient</button>
            </div>
          </div>
          <div className="form-actions">
            <button className="form-cancel-btn" onClick={closeEditor}>Cancel</button>
            <button className="form-apply-btn" onClick={applyEdit}>{editing==='new'?'Add recipe':'Apply changes'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
