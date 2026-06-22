'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, OWNER_EMAIL } from '@/lib/supabase';
import { getSessionId } from '@/lib/session';

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Salad', 'Snack', 'Dessert', 'Other'];

type Recipe = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  ingredients: string[];
  steps: string[];
  prep_time: string | null;
  servings: string | null;
  image_url: string | null;
  likes_count: number;
  created_at: string;
};

export default function RecipeBox() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [showForm, setShowForm] = useState<null | 'new' | string>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const heroPaused = useRef(false);
  const sessionId = useRef('');

  useEffect(() => {
    sessionId.current = getSessionId();
    loadEverything();

    supabase.auth.getSession().then(({ data }) => {
      setIsOwner(!!data.session && data.session.user.email === OWNER_EMAIL);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsOwner(!!session && session.user.email === OWNER_EMAIL);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const heroList = recipes.slice(0, 5);
    if (heroList.length <= 1) return;
    const t = setInterval(() => {
      if (!heroPaused.current) setHeroIndex(i => (i + 1) % heroList.length);
    }, 4500);
    return () => clearInterval(t);
  }, [recipes]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  const loadEverything = useCallback(async () => {
    setLoading(true);
    const { data: recipeData, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast("Couldn't load recipes — check your connection.");
      setLoading(false);
      return;
    }
    setRecipes(recipeData || []);

    const sid = getSessionId();
    const { data: likeRows } = await supabase.from('likes').select('recipe_id').eq('session_id', sid);
    setLikedIds(new Set((likeRows || []).map(r => r.recipe_id)));

    const { data: saveRows } = await supabase.from('saves').select('recipe_id').eq('session_id', sid);
    setSavedIds(new Set((saveRows || []).map(r => r.recipe_id)));

    setLoading(false);
  }, []);

  async function toggleLike(id: string) {
    const sid = sessionId.current;
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    const alreadyLiked = likedIds.has(id);

    const newLiked = new Set(likedIds);
    if (alreadyLiked) newLiked.delete(id); else newLiked.add(id);
    setLikedIds(newLiked);
    setRecipes(recipes.map(r => r.id === id ? { ...r, likes_count: r.likes_count + (alreadyLiked ? -1 : 1) } : r));

    if (alreadyLiked) {
      await supabase.from('likes').delete().eq('recipe_id', id).eq('session_id', sid);
    } else {
      await supabase.from('likes').insert({ recipe_id: id, session_id: sid });
    }
    await supabase
      .from('recipes')
      .update({ likes_count: alreadyLiked ? recipe.likes_count - 1 : recipe.likes_count + 1 })
      .eq('id', id);
  }

  async function toggleSave(id: string) {
    const sid = sessionId.current;
    const alreadySaved = savedIds.has(id);
    const newSaved = new Set(savedIds);
    if (alreadySaved) newSaved.delete(id); else newSaved.add(id);
    setSavedIds(newSaved);
    showToast(alreadySaved ? 'Removed from saved' : 'Saved');

    if (alreadySaved) {
      await supabase.from('saves').delete().eq('recipe_id', id).eq('session_id', sid);
    } else {
      await supabase.from('saves').insert({ recipe_id: id, session_id: sid });
    }
  }

  async function deleteRecipe(id: string) {
    if (!confirm('Delete this recipe? This cannot be undone.')) return;
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) { showToast("Couldn't delete — try again."); return; }
    setRecipes(recipes.filter(r => r.id !== id));
    setDetailId(null);
    showToast('Recipe deleted');
  }

  function categoriesPresent() {
    const present = new Set(recipes.map(r => r.category || 'Other'));
    const ordered = CATEGORIES.filter(c => present.has(c));
    present.forEach(c => { if (!CATEGORIES.includes(c)) ordered.push(c); });
    return ['All', ...ordered, 'Saved'];
  }

  const filtered = recipes.filter(r => {
    if (activeCategory === 'Saved' && !savedIds.has(r.id)) return false;
    if (activeCategory !== 'All' && activeCategory !== 'Saved' && (r.category || 'Other') !== activeCategory) return false;
    if (search) {
      const hay = (r.title + ' ' + (r.ingredients || []).join(' ')).toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const heroList = recipes.slice(0, 5);
  const detailRecipe = recipes.find(r => r.id === detailId) || null;

  return (
  
    <div className="app">
      <div className="wrap">
        <div className="header-inner">
          <h1 className="brand">The Recipe <span>Box</span></h1>
          <div className="auth-area">
            {isOwner ? (
              <>
                <span className="owner-badge">Signed in as owner</span>
                <button className="pill-btn" onClick={() => setShowForm('new')}>+ Add recipe</button>
                <button className="pill-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
              </>
            ) : (
              <button className="pill-btn" onClick={() => setShowLogin(true)}>Owner sign in</button>
            )}
          </div>
        </div>

        {/* Hero slideshow */}
        <div className="hero" onMouseEnter={() => heroPaused.current = true} onMouseLeave={() => heroPaused.current = false}>
          {heroList.length === 0 ? (
            <div className="hero-empty">Add your first recipe to see it featured here.</div>
          ) : (
            <>
              {heroList.map((r, i) => (
                <div key={r.id} className={'hero-slide' + (i === heroIndex ? ' active' : '')} onClick={() => setDetailId(r.id)}>
                  {r.image_url && <img src={r.image_url} alt={r.title} />}
                  <div className="hero-overlay">
                    <span className="hero-tag">{r.category}</span>
                    <h2 className="hero-title">{r.title}</h2>
                    <p className="hero-meta">{[r.prep_time && r.prep_time + ' min', r.servings && r.servings + ' servings'].filter(Boolean).join(' · ')}</p>
                    <div className="hero-actions">
                      <button className={'hero-btn' + (likedIds.has(r.id) ? ' liked' : '')} onClick={(e) => { e.stopPropagation(); toggleLike(r.id); }}>
                        {likedIds.has(r.id) ? '❤️' : '🤍'} Like · {r.likes_count}
                      </button>
                      <button className={'hero-btn' + (savedIds.has(r.id) ? ' saved' : '')} onClick={(e) => { e.stopPropagation(); toggleSave(r.id); }}>
                        {savedIds.has(r.id) ? '🔖 Saved' : '📑 Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {heroList.length > 1 && (
                <div className="hero-dots">
                  {heroList.map((_, i) => (
                    <div key={i} className={'hero-dot' + (i === heroIndex ? ' active' : '')} onClick={() => setHeroIndex(i)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="tabs">
          {categoriesPresent().map(cat => (
            <button key={cat} className={'tab-btn' + (cat === activeCategory ? ' active' : '')} onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>

        <div className="search-row">
          <input placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading && <div className="loading-state">Pulling cards from the box…</div>}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            {recipes.length === 0 ? 'The box is empty so far.' : 'No recipes match. Try a different tab or search.'}
          </div>
        )}

        <main className="card-grid">
          {filtered.map(r => (
            <div key={r.id} className="recipe-card" onClick={() => setDetailId(r.id)}>
              {r.image_url
                ? <img className="card-photo" src={r.image_url} alt={r.title} />
                : <div className="card-photo-placeholder">no photo yet</div>}
              <div className="card-body">
                <h3 className="card-title">{r.title}</h3>
                <p className="card-meta">{[r.prep_time && r.prep_time + ' min', r.servings && r.servings + ' servings'].filter(Boolean).join(' · ') || '\u00A0'}</p>
              </div>
              <div className="card-footer">
                <span className="card-tag">{r.category}</span>
                <div className="card-actions">
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleLike(r.id); }}>
                    {likedIds.has(r.id) ? '❤️' : '🤍'} {r.likes_count}
                  </button>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleSave(r.id); }}>
                    {savedIds.has(r.id) ? '🔖' : '📑'}
                  </button>
                  {isOwner && (
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setShowForm(r.id); }}>✏️</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>

      {detailRecipe && (
        <DetailModal
          recipe={detailRecipe}
          liked={likedIds.has(detailRecipe.id)}
          saved={savedIds.has(detailRecipe.id)}
          isOwner={isOwner}
          onClose={() => setDetailId(null)}
          onLike={() => toggleLike(detailRecipe.id)}
          onSave={() => toggleSave(detailRecipe.id)}
          onEdit={() => { setDetailId(null); setShowForm(detailRecipe.id); }}
          onDelete={() => deleteRecipe(detailRecipe.id)}
        />
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSignedIn={() => setShowLogin(false)} />}

      {showForm && (
        <RecipeFormModal
          recipeId={showForm === 'new' ? null : showForm}
          recipes={recipes}
          onClose={() => setShowForm(null)}
          onSaved={async () => { setShowForm(null); await loadEverything(); }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ---------------- Detail modal ----------------
function DetailModal({ recipe, liked, saved, isOwner, onClose, onLike, onSave, onEdit, onDelete }: any) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>×</button>
        {recipe.image_url && <img className="detail-photo" src={recipe.image_url} alt={recipe.title} />}
        <h2>{recipe.title}</h2>
        <div className="meta-line">
          {[recipe.prep_time && recipe.prep_time + ' min', recipe.servings && recipe.servings + ' servings', recipe.category].filter(Boolean).join(' · ')}
        </div>
        {recipe.description && <p>{recipe.description}</p>}
        <div className="section-label">Ingredients</div>
        <ul className="ingredient-list">
          {(recipe.ingredients || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)}
        </ul>
        <div className="section-label">Steps</div>
        <ol className="steps-list">
          {(recipe.steps || []).map((s: string, idx: number) => <li key={idx}>{s}</li>)}
        </ol>
        <div className="modal-actions-row">
          <button className="pill-btn" onClick={onLike}>{liked ? '❤️ Liked' : '🤍 Like'} ({recipe.likes_count})</button>
          <button className="pill-btn" onClick={onSave}>{saved ? '🔖 Saved' : '📑 Save'}</button>
          {isOwner && <button className="pill-btn filled" onClick={onEdit}>Edit</button>}
          {isOwner && <button className="pill-btn danger" onClick={onDelete}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

// ---------------- Login modal ----------------
function LoginModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    onSignedIn();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Owner sign in</h2>
        <p className="meta-line">Only the account set up as the owner can add, edit, or delete recipes.</p>
        <form className="recipe-form-fields" onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions-row">
            <button type="submit" className="pill-btn filled" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- Add / edit form modal ----------------
function RecipeFormModal({ recipeId, recipes, onClose, onSaved }: any) {
  const editing = recipes.find((r: Recipe) => r.id === recipeId) || null;
  const [title, setTitle] = useState(editing?.title || '');
  const [category, setCategory] = useState(editing?.category || 'Breakfast');
  const [prepTime, setPrepTime] = useState(editing?.prep_time || '');
  const [servings, setServings] = useState(editing?.servings || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [ingredients, setIngredients] = useState((editing?.ingredients || []).join('\n'));
  const [steps, setSteps] = useState((editing?.steps || []).join('\n'));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(editing?.image_url || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function pickImage(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Please give the recipe a title.'); return; }
    setBusy(true);
    setError('');

    let imageUrl = editing?.image_url || null;
    if (imageFile) {
      const path = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabase.storage.from('recipe-images').upload(path, imageFile, { upsert: true });
      if (uploadError) { setError("Couldn't upload the photo: " + uploadError.message); setBusy(false); return; }
      const { data } = supabase.storage.from('recipe-images').getPublicUrl(path);
      imageUrl = data.publicUrl;
    }

    const payload = {
      title: title.trim(),
      category,
      prep_time: prepTime.trim(),
      servings: servings.trim(),
      description: description.trim(),
      ingredients: ingredients.split('\n').map(s => s.trim()).filter(Boolean),
      steps: steps.split('\n').map(s => s.trim()).filter(Boolean),
      image_url: imageUrl
    };

    const { error: saveError } = editing
      ? await supabase.from('recipes').update(payload).eq('id', editing.id)
      : await supabase.from('recipes').insert(payload);

    setBusy(false);
    if (saveError) { setError("Couldn't save: " + saveError.message); return; }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{editing ? 'Edit recipe' : 'Add a recipe'}</h2>
        <form className="recipe-form-fields" onSubmit={submit}>
          <label>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />

          <label>Photo</label>
          <label className="image-pick">
            {imagePreview ? 'Click to change photo' : 'Click to upload a photo'}
            {imagePreview && <img src={imagePreview} alt="" />}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && pickImage(e.target.files[0])} />
          </label>

          <div className="field-row">
            <div>
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Prep time (min)</label>
              <input type="text" value={prepTime} onChange={e => setPrepTime(e.target.value)} />
            </div>
            <div>
              <label>Servings</label>
              <input type="text" value={servings} onChange={e => setServings(e.target.value)} />
            </div>
          </div>

          <label>Description</label>
          <textarea style={{ fontFamily: 'Inter,sans-serif', minHeight: 60 }} value={description} onChange={e => setDescription(e.target.value)} />

          <label>Ingredients (one per line)</label>
          <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} />

          <label>Steps (one per line)</label>
          <textarea value={steps} onChange={e => setSteps(e.target.value)} />

          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions-row">
            <button type="submit" className="pill-btn filled" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add recipe'}</button>
            <button type="button" className="pill-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
