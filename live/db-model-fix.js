(() => {
  function clean(v){ return String(v || '').trim(); }
  function key(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function makeId(prefix){ return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
  function sectionFor(name){ try { return typeof sec === 'function' ? sec(name) : 'Cupboard'; } catch { return 'Cupboard'; } }

  function state(){ return window.S || (typeof S !== 'undefined' ? S : null); }
  function hasState(){ return !!state(); }

  function ensureArrays(){
    const st = state();
    if (!st) return false;
    st.meals = Array.isArray(st.meals) ? st.meals : [];
    st.ingredients = Array.isArray(st.ingredients) ? st.ingredients : [];
    st.mealIngredients = Array.isArray(st.mealIngredients) ? st.mealIngredients : [];
    st.masterIngredients = Array.isArray(st.masterIngredients) ? st.masterIngredients : [];
    return true;
  }

  function ensureMealIds(){
    const st = state();
    if (!ensureArrays()) return false;
    let changed = false;
    st.meals.forEach(m => {
      if (!m.id) { m.id = makeId('meal'); changed = true; }
    });
    return changed;
  }

  function ensureIngredientIds(){
    const st = state();
    if (!ensureArrays()) return false;
    let changed = false;
    st.ingredients.forEach(i => {
      if (!i.id) { i.id = makeId('ing'); changed = true; }
      i.name = clean(i.name);
      i.defaultUnit = i.defaultUnit || i.unit || '';
      i.defaultSection = i.defaultSection || i.section || sectionFor(i.name);
      i.defaultType = i.defaultType || i.type || 'required';
    });
    return changed;
  }

  function findMealById(id){
    const st = state();
    ensureMealIds();
    return st ? st.meals.find(m => m.id === id) || null : null;
  }

  function findMealByName(name){
    const st = state();
    ensureMealIds();
    const k = key(name);
    return st ? st.meals.find(m => key(m.name) === k) || null : null;
  }

  function findIngredientById(id){
    const st = state();
    ensureIngredientIds();
    return st ? st.ingredients.find(i => i.id === id) || null : null;
  }

  function findIngredientByName(name){
    const st = state();
    ensureIngredientIds();
    const k = key(name);
    return st ? st.ingredients.find(i => key(i.name) === k) || null : null;
  }

  function getOrCreateIngredient(raw){
    const st = state();
    if (!ensureArrays()) return null;
    ensureIngredientIds();
    raw = raw || {};
    const name = clean(raw.name);
    if (!name) return null;
    let ing = findIngredientByName(name);
    if (!ing) {
      ing = {
        id: makeId('ing'),
        name,
        defaultUnit: raw.unit || raw.defaultUnit || '',
        defaultSection: raw.section || raw.defaultSection || sectionFor(name),
        defaultType: raw.type || raw.defaultType || 'required'
      };
      st.ingredients.push(ing);
    } else {
      ing.name = ing.name || name;
      ing.defaultUnit = ing.defaultUnit || raw.unit || raw.defaultUnit || '';
      ing.defaultSection = ing.defaultSection || raw.section || raw.defaultSection || sectionFor(name);
      ing.defaultType = ing.defaultType || raw.type || raw.defaultType || 'required';
    }
    return ing;
  }

  function normaliseJoin(row){
    row.id = row.id || makeId('meal_ing');
    row.mealId = row.mealId || row.meal_id || row.mealID || '';
    row.ingredientId = row.ingredientId || row.ingredient_id || row.ingredientID || '';
    row.qty = row.qty || '';
    row.unit = row.unit || '';
    row.type = row.type || 'required';
    row.section = row.section || '';
    return row;
  }

  function upsertMealIngredient(mealId, ingredientIdOrRecord, values){
    const st = state();
    if (!ensureArrays()) return null;
    ensureMealIds();
    ensureIngredientIds();
    values = values || {};
    const ingredient = typeof ingredientIdOrRecord === 'string'
      ? findIngredientById(ingredientIdOrRecord)
      : ingredientIdOrRecord;
    if (!mealId || !ingredient || !ingredient.id) return null;

    let row = st.mealIngredients.find(r => {
      normaliseJoin(r);
      return r.mealId === mealId && r.ingredientId === ingredient.id && (r.type || 'required') === (values.type || 'required');
    });

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
      st.mealIngredients.push(row);
    } else {
      row.qty = values.qty || row.qty || '';
      row.unit = values.unit || row.unit || ingredient.defaultUnit || '';
      row.type = values.type || row.type || 'required';
      row.section = values.section || row.section || ingredient.defaultSection || sectionFor(ingredient.name);
    }
    return row;
  }

  function rebuildDisplayIngredients(){
    const st = state();
    if (!ensureArrays()) return;
    ensureMealIds();
    ensureIngredientIds();
    st.mealIngredients.forEach(normaliseJoin);
    const ingredientsById = Object.fromEntries(st.ingredients.map(i => [i.id, i]));

    st.meals.forEach(m => {
      const rows = st.mealIngredients.filter(r => r.mealId === m.id);
      m.ingredients = rows.map(r => {
        const ing = ingredientsById[r.ingredientId] || {};
        return {
          id: r.id,
          mealIngredientId: r.id,
          mealId: r.mealId,
          ingredientId: r.ingredientId,
          name: ing.name || '',
          qty: r.qty || '',
          unit: r.unit || ing.defaultUnit || '',
          type: r.type || ing.defaultType || 'required',
          section: r.section || ing.defaultSection || sectionFor(ing.name)
        };
      });
    });
  }

  function migrateOldIngredientsToStructure(){
    const st = state();
    if (!ensureArrays()) return false;
    let changed = false;
    changed = ensureMealIds() || changed;
    changed = ensureIngredientIds() || changed;
    st.mealIngredients.forEach(r => { normaliseJoin(r); });

    st.meals.forEach(m => {
      const oldIngredients = Array.isArray(m.ingredients) ? [...m.ingredients] : [];
      oldIngredients.forEach(raw => {
        if (!clean(raw.name)) return;
        const ing = getOrCreateIngredient(raw);
        if (!ing) return;
        const before = st.mealIngredients.length;
        upsertMealIngredient(m.id, ing, {
          qty: raw.qty || '',
          unit: raw.unit || ing.defaultUnit || '',
          type: raw.type || 'required',
          section: raw.section || ing.defaultSection || sectionFor(raw.name)
        });
        if (st.mealIngredients.length !== before) changed = true;
      });
    });

    st.masterIngredients.forEach(raw => { if (clean(raw.name)) getOrCreateIngredient(raw); });
    rebuildDisplayIngredients();
    return changed;
  }

  function addIngredientToMeal(mealId, raw){
    raw = raw || {};
    const meal = findMealById(mealId);
    if (!meal) return null;
    const ing = getOrCreateIngredient(raw);
    if (!ing) return null;
    const link = upsertMealIngredient(meal.id, ing, raw);
    rebuildDisplayIngredients();
    return { meal, ingredient:ing, link };
  }

  function removeIngredientFromMeal(mealId, ingredientOrIndex){
    const st = state();
    if (!ensureArrays()) return false;
    ensureMealIds();
    ensureIngredientIds();
    const meal = findMealById(mealId);
    if (!meal) return false;
    st.mealIngredients.forEach(normaliseJoin);
    rebuildDisplayIngredients();
    const displayList = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    const target = typeof ingredientOrIndex === 'number' ? displayList[ingredientOrIndex] : ingredientOrIndex;
    if (!target) return false;
    const targetJoinId = target.mealIngredientId || target.id || '';
    const targetIngId = target.ingredientId || '';
    const targetNameKey = key(target.name);
    const targetType = target.type || 'required';

    const before = st.mealIngredients.length;
    st.mealIngredients = st.mealIngredients.filter(r => {
      normaliseJoin(r);
      if (r.mealId !== meal.id) return true;
      if (targetJoinId && r.id === targetJoinId) return false;
      if (targetIngId && r.ingredientId === targetIngId && (r.type || 'required') === targetType) return false;
      const ing = findIngredientById(r.ingredientId);
      if (ing && key(ing.name) === targetNameKey && (r.type || 'required') === targetType) return false;
      return true;
    });

    rebuildDisplayIngredients();
    return st.mealIngredients.length !== before;
  }

  window.shoppingDb = {
    migrateOldIngredientsToStructure,
    rebuildDisplayIngredients,
    findMealById,
    findMealByName,
    findIngredientById,
    findIngredientByName,
    getOrCreateIngredient,
    upsertMealIngredient,
    addIngredientToMeal,
    removeIngredientFromMeal,
    ensureMealIds,
    ensureIngredientIds,
    hasState
  };

  function runWhenReady(attempt){
    if (!hasState()) {
      if ((attempt || 0) < 100) setTimeout(() => runWhenReady((attempt || 0) + 1), 50);
      return;
    }
    const changed = migrateOldIngredientsToStructure();
    if (changed && typeof save === 'function') save();
    if (typeof render === 'function') render();
  }

  runWhenReady(0);
})();
