(() => {
  function clean(v){ return String(v || '').trim(); }
  function key(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function makeId(prefix){ return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
  function sectionFor(name){ try { return typeof sec === 'function' ? sec(name) : 'Cupboard'; } catch { return 'Cupboard'; } }

  function ensureArrays(){
    if (typeof S === 'undefined' || !S) return false;
    S.meals = Array.isArray(S.meals) ? S.meals : [];
    S.ingredients = Array.isArray(S.ingredients) ? S.ingredients : [];
    S.mealIngredients = Array.isArray(S.mealIngredients) ? S.mealIngredients : [];
    S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
    return true;
  }

  function ensureMealIds(){
    if (!ensureArrays()) return false;
    let changed = false;
    S.meals.forEach(m => {
      if (!m.id) { m.id = makeId('meal'); changed = true; }
    });
    return changed;
  }

  function ensureIngredientIds(){
    if (!ensureArrays()) return false;
    let changed = false;
    S.ingredients.forEach(i => {
      if (!i.id) { i.id = makeId('ing'); changed = true; }
      i.name = clean(i.name);
      i.defaultUnit = i.defaultUnit || i.unit || '';
      i.defaultSection = i.defaultSection || i.section || sectionFor(i.name);
      i.defaultType = i.defaultType || i.type || 'required';
    });
    return changed;
  }

  function findMealById(id){
    ensureMealIds();
    return S.meals.find(m => m.id === id) || null;
  }

  function findMealByName(name){
    ensureMealIds();
    const k = key(name);
    return S.meals.find(m => key(m.name) === k) || null;
  }

  function findIngredientById(id){
    ensureIngredientIds();
    return S.ingredients.find(i => i.id === id) || null;
  }

  function findIngredientByName(name){
    ensureIngredientIds();
    const k = key(name);
    return S.ingredients.find(i => key(i.name) === k) || null;
  }

  function getOrCreateIngredient(raw){
    ensureArrays();
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
      S.ingredients.push(ing);
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
    ensureArrays();
    ensureMealIds();
    ensureIngredientIds();
    values = values || {};
    const ingredient = typeof ingredientIdOrRecord === 'string'
      ? findIngredientById(ingredientIdOrRecord)
      : ingredientIdOrRecord;
    if (!mealId || !ingredient || !ingredient.id) return null;

    let row = S.mealIngredients.find(r => {
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
      S.mealIngredients.push(row);
    } else {
      row.qty = values.qty || row.qty || '';
      row.unit = values.unit || row.unit || ingredient.defaultUnit || '';
      row.type = values.type || row.type || 'required';
      row.section = values.section || row.section || ingredient.defaultSection || sectionFor(ingredient.name);
    }
    return row;
  }

  function rebuildDisplayIngredients(){
    ensureArrays();
    ensureMealIds();
    ensureIngredientIds();
    S.mealIngredients.forEach(normaliseJoin);
    const ingredientsById = Object.fromEntries(S.ingredients.map(i => [i.id, i]));

    S.meals.forEach(m => {
      const rows = S.mealIngredients.filter(r => r.mealId === m.id);
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
    ensureArrays();
    let changed = false;
    changed = ensureMealIds() || changed;
    changed = ensureIngredientIds() || changed;
    S.mealIngredients.forEach(r => { normaliseJoin(r); });

    S.meals.forEach(m => {
      const oldIngredients = Array.isArray(m.ingredients) ? [...m.ingredients] : [];
      oldIngredients.forEach(raw => {
        if (!clean(raw.name)) return;
        const ing = getOrCreateIngredient(raw);
        if (!ing) return;
        const before = S.mealIngredients.length;
        upsertMealIngredient(m.id, ing, {
          qty: raw.qty || '',
          unit: raw.unit || ing.defaultUnit || '',
          type: raw.type || 'required',
          section: raw.section || ing.defaultSection || sectionFor(raw.name)
        });
        if (S.mealIngredients.length !== before) changed = true;
      });
    });

    S.masterIngredients.forEach(raw => { if (clean(raw.name)) getOrCreateIngredient(raw); });
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
    ensureArrays();
    ensureMealIds();
    ensureIngredientIds();
    const meal = findMealById(mealId);
    if (!meal) return false;
    S.mealIngredients.forEach(normaliseJoin);
    rebuildDisplayIngredients();
    const displayList = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    const target = typeof ingredientOrIndex === 'number' ? displayList[ingredientOrIndex] : ingredientOrIndex;
    if (!target) return false;
    const targetJoinId = target.mealIngredientId || target.id || '';
    const targetIngId = target.ingredientId || '';
    const targetNameKey = key(target.name);
    const targetType = target.type || 'required';

    const before = S.mealIngredients.length;
    S.mealIngredients = S.mealIngredients.filter(r => {
      normaliseJoin(r);
      if (r.mealId !== meal.id) return true;
      if (targetJoinId && r.id === targetJoinId) return false;
      if (targetIngId && r.ingredientId === targetIngId && (r.type || 'required') === targetType) return false;
      const ing = findIngredientById(r.ingredientId);
      if (ing && key(ing.name) === targetNameKey && (r.type || 'required') === targetType) return false;
      return true;
    });

    rebuildDisplayIngredients();
    return S.mealIngredients.length !== before;
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
    ensureIngredientIds
  };

  setTimeout(() => {
    if (typeof S !== 'undefined') {
      const changed = migrateOldIngredientsToStructure();
      if (changed && typeof save === 'function') save();
      if (typeof render === 'function') render();
    }
  }, 100);
})();
