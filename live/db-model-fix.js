(() => {
  function clean(v){ return String(v || '').trim(); }
  function key(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function makeId(prefix){ return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
  function sectionFor(name){ try { return typeof sec === 'function' ? sec(name) : 'Cupboard'; } catch { return 'Cupboard'; } }

  function ensureArrays(){
    S.meals = Array.isArray(S.meals) ? S.meals : [];
    S.ingredients = Array.isArray(S.ingredients) ? S.ingredients : [];
    S.mealIngredients = Array.isArray(S.mealIngredients) ? S.mealIngredients : [];
    S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
  }

  function ensureMealIds(){
    ensureArrays();
    let changed = false;
    S.meals.forEach(m => {
      if (!m.id) {
        m.id = makeId('meal');
        changed = true;
      }
    });
    return changed;
  }

  function findIngredientByName(name){
    const k = key(name);
    return S.ingredients.find(i => key(i.name) === k) || null;
  }

  function getOrCreateIngredient(raw){
    ensureArrays();
    const name = clean(raw && raw.name);
    if (!name) return null;
    let existing = findIngredientByName(name);
    if (existing) {
      existing.name = existing.name || name;
      existing.defaultUnit = existing.defaultUnit || raw.unit || '';
      existing.defaultSection = existing.defaultSection || raw.section || sectionFor(name);
      existing.defaultType = existing.defaultType || raw.type || 'required';
      return existing;
    }
    existing = {
      id: makeId('ing'),
      name,
      defaultUnit: raw.unit || '',
      defaultSection: raw.section || sectionFor(name),
      defaultType: raw.type || 'required'
    };
    S.ingredients.push(existing);
    return existing;
  }

  function upsertMealIngredient(mealId, ingredient, values){
    ensureArrays();
    if (!mealId || !ingredient || !ingredient.id) return null;
    let row = S.mealIngredients.find(r => r.mealId === mealId && r.ingredientId === ingredient.id && (r.type || 'required') === (values.type || 'required'));
    if (!row) {
      row = {
        id: makeId('meal_ing'),
        mealId,
        ingredientId: ingredient.id,
        qty: values.qty || '',
        unit: values.unit || ingredient.defaultUnit || '',
        type: values.type || ingredient.defaultType || 'required',
        section: values.section || ingredient.defaultSection || sectionFor(ingredient.name)
      };
      S.mealIngredients.push(row);
    } else {
      row.qty = values.qty || row.qty || '';
      row.unit = values.unit || row.unit || ingredient.defaultUnit || '';
      row.type = values.type || row.type || 'required';
      row.section = values.section || row.section || ingredient.defaultSection || sectionFor(ingredient.name);
    }
    return row;
  }

  function rebuildMealIngredientsForDisplay(){
    ensureArrays();
    const ingById = Object.fromEntries(S.ingredients.map(i => [i.id, i]));
    S.meals.forEach(m => {
      const rows = S.mealIngredients.filter(r => r.mealId === m.id);
      m.ingredients = rows.map(r => {
        const ing = ingById[r.ingredientId] || {};
        return {
          id: r.id,
          mealIngredientId: r.id,
          mealId: r.mealId,
          ingredientId: r.ingredientId,
          name: ing.name || r.name || '',
          qty: r.qty || '',
          unit: r.unit || ing.defaultUnit || '',
          type: r.type || ing.defaultType || 'required',
          section: r.section || ing.defaultSection || sectionFor(ing.name || r.name)
        };
      });
    });
  }

  function migrateExistingMeals(){
    ensureArrays();
    let changed = ensureMealIds();
    const existingJoinKeys = new Set(S.mealIngredients.map(r => r.mealId + '|' + r.ingredientId + '|' + (r.type || 'required')));

    S.meals.forEach(m => {
      const oldList = Array.isArray(m.ingredients) ? m.ingredients : [];
      oldList.forEach(raw => {
        if (!clean(raw.name)) return;
        const ing = getOrCreateIngredient(raw);
        if (!ing) return;
        const joinKey = m.id + '|' + ing.id + '|' + (raw.type || 'required');
        if (!existingJoinKeys.has(joinKey)) {
          upsertMealIngredient(m.id, ing, {
            qty: raw.qty || '',
            unit: raw.unit || ing.defaultUnit || '',
            type: raw.type || 'required',
            section: raw.section || ing.defaultSection || sectionFor(raw.name)
          });
          existingJoinKeys.add(joinKey);
          changed = true;
        }
      });
    });

    S.masterIngredients.forEach(raw => getOrCreateIngredient(raw));
    rebuildMealIngredientsForDisplay();
    if (changed && typeof save === 'function') save();
  }

  function findMealById(id){
    ensureArrays();
    return S.meals.find(m => m.id === id) || null;
  }

  function findMealByName(name){
    ensureArrays();
    const k = key(name);
    return S.meals.find(m => key(m.name) === k) || null;
  }

  window.shoppingDb = {
    migrateExistingMeals,
    rebuildMealIngredientsForDisplay,
    findMealById,
    findMealByName,
    getOrCreateIngredient,
    upsertMealIngredient,
    ensureMealIds
  };

  const oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function renderWithNormalisedModel(){
      migrateExistingMeals();
      return oldRender();
    };
  }

  const oldSave = window.save;
  if (typeof oldSave === 'function') {
    window.save = function saveWithNormalisedModel(){
      try { migrateExistingMeals(); } catch(e) { console.warn(e); }
      return oldSave();
    };
  }

  setTimeout(() => {
    if (typeof S !== 'undefined') {
      migrateExistingMeals();
      if (typeof render === 'function') render();
    }
  }, 100);
})();
