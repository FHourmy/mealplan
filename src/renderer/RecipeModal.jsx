import React, { useEffect } from 'react';

export default function RecipeModal({ recipe, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!recipe) return null;

  // Normalize legacy string ingredients
  const ingredients = (recipe.ingredients || []).map(ing =>
    typeof ing === 'string' ? { name: ing, quantity: '' } : ing
  );

  return (
    <div className="picker-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="recipe-modal">
        <div className="recipe-modal-header">
          <div className="recipe-modal-title-group">
            {recipe.recipe_number && <span className="recipe-modal-num">#{recipe.recipe_number}</span>}
            <h2 className="recipe-modal-title">{recipe.name}</h2>
          </div>
          <button className="picker-close" onClick={onClose}>✕</button>
        </div>

        <div className="recipe-modal-body">
          {recipe.section && (
            <div className="recipe-modal-row">
              <span className="recipe-modal-label">Section</span>
              <span className="recipe-modal-value">{recipe.section}</span>
            </div>
          )}

          {recipe.tags?.length > 0 && (
            <div className="recipe-modal-row">
              <span className="recipe-modal-label">Tags</span>
              <span className="recipe-modal-value recipe-modal-tags">
                {recipe.tags.map(t => <span key={t} className="tag-badge">{t}</span>)}
              </span>
            </div>
          )}

          {recipe.recipe_link && (
            <div className="recipe-modal-row">
              <span className="recipe-modal-label">Link</span>
              <a className="recipe-modal-link" href={recipe.recipe_link} target="_blank" rel="noreferrer">
                {recipe.recipe_link} ↗
              </a>
            </div>
          )}

          {ingredients.length > 0 && (
            <div className="recipe-modal-ingredients">
              <span className="recipe-modal-label">Ingredients</span>
              <ul className="recipe-modal-ing-list">
                {ingredients.map((ing, i) => (
                  <li key={i} className="recipe-modal-ing-item">
                    {ing.quantity && <span className="ing-qty">{ing.quantity}</span>}
                    <span className="ing-name">{ing.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!ingredients.length && !recipe.recipe_link && !recipe.tags?.length && (
            <p className="recipe-modal-empty">No additional details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
