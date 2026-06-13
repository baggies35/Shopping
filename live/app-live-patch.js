(() => {
  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function makeMealId(){ return 'meal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }

  window.__targetMealIdForIngredient = window.__targetMealIdForIngredient || '';

  function ensureMealIdsFallback(){
    if (!Array.isArray(window.S?.meals)) return;
    let changed = false;
    S.meals.forEach(m => {
      if (!m.id) { m.id = makeMealId(); changed = true; }
    });
    if (changed && typeof save === 'function') {
      try { save(); } catch(e) { console.warn(e); }
    }
  }

  function currentMealNameCandidate(){
    const names = [];
    if (typeof mealName !== 'undefined' && mealName) names.push(mealName);
    const title = document.getElementById('mealTitle')?.textContent;
    if (title) names.push(title);
    const inputName = document.getElementById('mealN')?.value;
    if (inputName) names.push(inputName);
    return names.find(Boolean) || '';
  }

  function findMealByNameFallback(n){
    ensureMealIdsFallback();
    if (!n || !Array.isArray(S?.meals)) return null;
    return S.meals.find(m => lower(m.name) === lower(n)) || null;
  }

  function findCurrentMeal(){
    if (window.shoppingDb) {
      if (window.__targetMealIdForIngredient) {
        const byId = shoppingDb.findMealById(window.__targetMealIdForIngredient);
        if (byId) return byId;
      }
      const byName = shoppingDb.findMealByName(currentMealNameCandidate());
      if (byName) {
        window.__targetMealIdForIngredient = byName.id;
        return byName;
      }
    }
    if (window.__targetMealIdForIngredient && Array.isArray(S?.meals)) {
      const byId = S.meals.find(m => m.id === window.__targetMealIdForIngredient);
      if (byId) return byId;
    }
    return findMealByNameFallback(currentMealNameCandidate());
  }

  function tidyStatusText(){
    document.querySelectorAll('#days .pill, #planDays .muted').forEach(el => {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'rejected') el.textContent = 'Rejected';
      if (t === 'agreed') el.textContent = 'Agreed';
      if (t === 'suggested') el.textContent = 'Suggested';
    });
  }

  function makeHomeMealsOpenPlan(){
    document.querySelectorAll('#days .day').forEach(el => {
      el.onclick = function(){ go('plan'); };
    });
  }

  function rewireMealRemoveButtons(){
    const currentMeal = findCurrentMeal();
    if (!currentMeal || !Array.isArray(currentMeal.ingredients)) return;
    const mealBody = document.getElementById('mealBody');
    if (!mealBody) return;
    const buttons = [...mealBody.querySelectorAll('button')].filter(b => (b.textContent || '').trim().toLowerCase() === 'remove');
    buttons.forEach((button, index) => {
      button.onclick = function(ev){
        if (ev) ev.preventDefault();
        window.liveRemoveIngredient(index);
        return false;
      };
    });
  }

  function applyLivePatch(){
    if (window.shoppingDb) shoppingDb.migrateOldIngredientsToStructure();
    else ensureMealIdsFallback();
    makeHomeMealsOpenPlan();
    tidyStatusText();
    rewireMealRemoveButtons();
  }

  const originalEditMeal = window.editMeal;
  if (typeof originalEditMeal === 'function') {
    window.editMeal = function editMealWithStableId(n){
      let found = null;
      if (window.shoppingDb) found = shoppingDb.findMealByName(n);
      else found = findMealByNameFallback(n);
      if (found) window.__targetMealIdForIngredient = found.id;
      if (window.shoppingDb) shoppingDb.rebuildDisplayIngredients();
      const result = originalEditMeal(found ? found.name : n);
      setTimeout(rewireMealRemoveButtons, 0);
      return result;
    };
  }

  const originalOpenIngredientPicker = window.openIngredientPicker;
  window.openIngredientPicker = function openIngredientPickerWithStableMealId(){
    let found = null;
    if (window.shoppingDb) found = shoppingDb.findMealByName(currentMealNameCandidate());
    else found = findMealByNameFallback(currentMealNameCandidate());
    if (found) window.__targetMealIdForIngredient = found.id;
    if (typeof originalOpenIngredientPicker === 'function') return originalOpenIngredientPicker();
  };

  window.savePickedIngredient = function savePickedIngredientFixed(){
    try {
      if (window.shoppingDb) shoppingDb.migrateOldIngredientsToStructure();
      else ensureMealIdsFallback();

      const name = clean(document.getElementById('pickName')?.value);
      if (!name) { alert('Add an ingredient name first.'); return; }

      const qty = clean(document.getElementById('pickQty')?.value);
      const unit = document.getElementById('pickUnit')?.value || '';
      const type = document.getElementById('pickType')?.value || 'required';
      const section = document.getElementById('pickSection')?.value || (typeof sec === 'function' ? sec(name) : 'Cupboard');
      const currentMeal = findCurrentMeal();

      if (!currentMeal) {
        const available = Array.isArray(S?.meals) ? S.meals.map(m => (m.id || 'no-id') + ':' + m.name).join(', ') : 'none';
        alert('Could not find the meal to add this to. Available meals: ' + available);
        return;
      }

      const raw = { name, qty, unit, type, section };
      if (window.shoppingDb) shoppingDb.addIngredientToMeal(currentMeal.id, raw);
      else {
        currentMeal.ingredients = Array.isArray(currentMeal.ingredients) ? currentMeal.ingredients : [];
        currentMeal.ingredients.push(raw);
      }

      window.__targetMealIdForIngredient = currentMeal.id;
      S.finalItems = [];
      if (typeof closeM === 'function') closeM('ingredientPicker');
      else document.getElementById('ingredientPicker')?.classList.remove('on');

      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      if (typeof editMeal === 'function') editMeal(currentMeal.name);
    } catch(e) {
      console.error(e);
      alert('Could not add ingredient. I have logged the error in the browser console.');
    }
  };

  window.liveRemoveIngredient = function liveRemoveIngredient(i){
    try {
      const currentMeal = findCurrentMeal();
      if (!currentMeal) { alert('Could not find the meal to remove from.'); return; }
      if (!confirm('Remove ingredient?')) return;
      const index = Number(i);

      if (window.shoppingDb) {
        shoppingDb.removeIngredientFromMeal(currentMeal.id, index);
      } else if (Array.isArray(currentMeal.ingredients)) {
        currentMeal.ingredients.splice(index, 1);
      }

      S.finalItems = [];
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      if (typeof editMeal === 'function') editMeal(currentMeal.name);
    } catch(e) {
      console.error(e);
      alert('Could not remove ingredient. I have logged the error in the browser console.');
    }
  };

  window.delIng = window.liveRemoveIngredient;

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function patchedRender(){
      if (window.shoppingDb) shoppingDb.rebuildDisplayIngredients();
      originalRender();
      setTimeout(applyLivePatch, 0);
    };
  }

  const originalRespond = window.respond;
  if (typeof originalRespond === 'function') {
    window.respond = function patchedRespond(i, s){
      originalRespond(i, String(s || '').toLowerCase());
      setTimeout(applyLivePatch, 0);
    };
  }

  setTimeout(function(){ if (typeof render === 'function') render(); applyLivePatch(); }, 250);

  setInterval(function(){
    if (document.hidden) return;
    if (typeof window.refreshSharedList === 'function') window.refreshSharedList();
  }, 15000);

  document.addEventListener('visibilitychange', function(){
    if (!document.hidden && typeof window.refreshSharedList === 'function') window.refreshSharedList();
  });
})();
