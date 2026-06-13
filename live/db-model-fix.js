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
      if (!m.id) {
        m.id = makeId('meal');
        changed = true;
      }
      m.ingredients = Array.isArray(m.ingredients) ? m.ingredients : [];
    });
    return changed;
  }

  function findIngredientByName(name){
    if (!ensureArrays()) return null;
    const k = key(name);
    return S.ingredients.find(i => key(i.name) === k) || null;
  }

  function getOrCreateIngredient(raw){
    if (!ensureArrays()) return null;
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
    if (!ensureArrays()) return null;
    if (!mealId || !ingredient || !ingredient.id) return null;
    values = values || {};
    let row = S.mealIngredients.find(r =>
      r.mealId === mealId &&
      r.ingredientId === ingredient.id &&
      (r.type || 'required') === (values.type || 'required')
    );
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

  function migrateExistingMealsNonDestructive(){
    if (!ensureArrays()) return { changed:false, oldCount:0, linkCount:S?.mealIngredients?.length || 0 };
    let changed = ensureMealIds();
    let oldCount = 0;
    const existingJoinKeys = new Set(S.mealIngredients.map(r => r.mealId + '|' + r.ingredientId + '|' + (r.type || 'required')));

    S.meals.forEach(m => {
      m.ingredients = Array.isArray(m.ingredients) ? m.ingredients : [];
      m.ingredients.forEach(raw => {
        if (!clean(raw.name)) return;
        oldCount += 1;
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
    return { changed, oldCount, linkCount:S.mealIngredients.length };
  }

  function findMealById(id){
    ensureMealIds();
    return Array.isArray(S?.meals) ? S.meals.find(m => m.id === id) || null : null;
  }

  function findMealByName(name){
    ensureMealIds();
    const k = key(name);
    return Array.isArray(S?.meals) ? S.meals.find(m => key(m.name) === k) || null : null;
  }

  function addIngredientToMeal(mealId, raw){
    ensureMealIds();
    const m = findMealById(mealId);
    if (!m) return null;
    const name = clean(raw && raw.name);
    if (!name) return null;

    m.ingredients = Array.isArray(m.ingredients) ? m.ingredients : [];
    const oldExists = m.ingredients.some(x => key(x.name) === key(name) && (x.type || 'required') === (raw.type || 'required'));
    if (!oldExists) {
      m.ingredients.push({
        name,
        qty: raw.qty || '',
        unit: raw.unit || '',
        type: raw.type || 'required',
        section: raw.section || sectionFor(name)
      });
    }

    const ing = getOrCreateIngredient(raw);
    const link = upsertMealIngredient(mealId, ing, raw);
    return { meal:m, ingredient:ing, link };
  }

  window.shoppingDb = {
    migrateExistingMeals: migrateExistingMealsNonDestructive,
    migrateExistingMealsNonDestructive,
    findMealById,
    findMealByName,
    getOrCreateIngredient,
    upsertMealIngredient,
    addIngredientToMeal,
    ensureMealIds
  };

  setTimeout(() => {
    if (typeof S !== 'undefined') {
      const result = migrateExistingMealsNonDestructive();
      if (result.changed && typeof save === 'function') save();
    }
  }, 100);
})();
