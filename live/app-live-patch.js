(() => {
  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function makeMealId(){ return 'meal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }

  window.__targetMealIdForIngredient = window.__targetMealIdForIngredient || '';

  function showLiveError(context, error, extra){
    const msg = error && error.message ? error.message : String(error || 'Unknown error');
    const stack = error && error.stack ? error.stack : '';
    const details = ['Context: ' + context,'Message: ' + msg,extra ? 'Extra: ' + extra : '',stack ? 'Stack: ' + stack : ''].filter(Boolean).join('\n\n');
    console.error(context, error, extra || '');
    let box = document.getElementById('liveErrorBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'liveErrorBox';
      box.style.cssText = 'position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;background:#fff1f1;border:2px solid #b84b4b;border-radius:14px;padding:12px;color:#1e1b16;font-family:system-ui;max-height:45vh;overflow:auto;box-shadow:0 8px 28px #0004;text-align:left;';
      document.body.appendChild(box);
    }
    box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>App error</b><button id="liveErrorClose" style="border:0;border-radius:10px;padding:7px 10px;font-weight:900">Close</button></div><pre style="white-space:pre-wrap;font-size:12px;line-height:1.25;margin:10px 0 0">' + details.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</pre>';
    document.getElementById('liveErrorClose').onclick = () => box.remove();
    alert('Error shown at bottom of screen. Screenshot that box.');
  }

  window.addEventListener('error', ev => showLiveError('window.error', ev.error || ev.message, ev.filename + ':' + ev.lineno + ':' + ev.colno));
  window.addEventListener('unhandledrejection', ev => showLiveError('unhandled promise rejection', ev.reason));

  function ensureMealIdsFallback(){
    if (!Array.isArray(window.S?.meals)) return;
    let changed = false;
    S.meals.forEach(m => { if (!m.id) { m.id = makeMealId(); changed = true; } });
    if (changed && typeof save === 'function') { try { save(); } catch(e) { console.warn(e); } }
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
      if (byName) { window.__targetMealIdForIngredient = byName.id; return byName; }
    }
    if (window.__targetMealIdForIngredient && Array.isArray(S?.meals)) {
      const byId = S.meals.find(m => m.id === window.__targetMealIdForIngredient);
      if (byId) return byId;
    }
    return findMealByNameFallback(currentMealNameCandidate());
  }

  function getIngredientNameById(id){
    if (!id || !Array.isArray(S?.ingredients)) return '';
    const found = S.ingredients.find(x => x.id === id);
    return found ? found.name : '';
  }

  function allIngredientRowsForKey(k){
    const rows = [];
    if (!Array.isArray(S?.meals)) return rows;
    S.meals.forEach(m => (m.ingredients || []).forEach(g => { if (lower(g.name) === k) rows.push(g); }));
    return rows;
  }

  function getMasterIngredientByKey(k){
    let rows = allIngredientRowsForKey(k);
    if (rows.length) return rows[0];
    if (Array.isArray(S?.masterIngredients)) {
      const m = S.masterIngredients.find(x => lower(x.name) === k || lower(x.key) === k);
      if (m) return m;
    }
    if (Array.isArray(S?.ingredients)) {
      const ing = S.ingredients.find(x => lower(x.name) === k);
      if (ing) return { name: ing.name, qty: ing.defaultQty || '', unit: ing.defaultUnit || '', type: ing.defaultType || 'required', section: ing.defaultSection || '' };
    }
    return null;
  }

  function removeIngredientDirect(meal, index){
    if (!meal) throw new Error('removeIngredientDirect: meal is blank');
    const displayList = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    const target = displayList[Number(index)];
    if (!target) throw new Error('removeIngredientDirect: no target at index ' + index + '. Display count=' + displayList.length);
    const targetJoinId = target.mealIngredientId || target.id || '';
    const targetIngredientId = target.ingredientId || '';
    const targetNameKey = lower(target.name);
    const targetType = target.type || 'required';
    let removed = false;
    if (Array.isArray(S.mealIngredients) && meal.id) {
      const before = S.mealIngredients.length;
      S.mealIngredients = S.mealIngredients.filter(row => {
        const rowMealId = row.mealId || row.meal_id || row.mealID || '';
        if (rowMealId !== meal.id) return true;
        const rowId = row.id || '';
        const rowIngredientId = row.ingredientId || row.ingredient_id || row.ingredientID || '';
        const rowType = row.type || 'required';
        const rowNameKey = lower(row.name || getIngredientNameById(rowIngredientId));
        if (targetJoinId && rowId === targetJoinId) return false;
        if (targetIngredientId && rowIngredientId === targetIngredientId && rowType === targetType) return false;
        if (targetNameKey && rowNameKey === targetNameKey && rowType === targetType) return false;
        return true;
      });
      removed = S.mealIngredients.length !== before;
    }
    if (!removed && Array.isArray(meal.ingredients)) { meal.ingredients.splice(Number(index), 1); removed = true; }
    if (window.shoppingDb && typeof shoppingDb.rebuildDisplayIngredients === 'function') shoppingDb.rebuildDisplayIngredients();
    return removed;
  }

  function tidyStatusText(){
    document.querySelectorAll('#days .pill, #planDays .muted').forEach(el => {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'rejected') el.textContent = 'Rejected';
      if (t === 'agreed') el.textContent = 'Agreed';
      if (t === 'suggested') el.textContent = 'Suggested';
    });
  }

  function makeHomeMealsOpenPlan(){ document.querySelectorAll('#days .day').forEach(el => { el.onclick = function(){ go('plan'); }; }); }

  function rewireMealRemoveButtons(){
    const currentMeal = findCurrentMeal();
    if (!currentMeal || !Array.isArray(currentMeal.ingredients)) return;
    const mealBody = document.getElementById('mealBody');
    if (!mealBody) return;
    const buttons = [...mealBody.querySelectorAll('button')].filter(b => (b.textContent || '').trim().toLowerCase() === 'remove');
    buttons.forEach((button, index) => { button.onclick = function(ev){ if (ev) ev.preventDefault(); window.liveRemoveIngredient(index); return false; }; });
  }

  function applyLivePatch(){
    if (window.shoppingDb && typeof shoppingDb.migrateOldIngredientsToStructure === 'function') shoppingDb.migrateOldIngredientsToStructure();
    else ensureMealIdsFallback();
    makeHomeMealsOpenPlan();
    tidyStatusText();
    rewireMealRemoveButtons();
  }

  const originalOpenMasterIng = window.openMasterIng;
  window.openMasterIng = function openMasterIngredientWithQty(k){
    try {
      if (typeof resetModal === 'function') resetModal();
      editMode = 'master';
      masterKey = k;
      const x = getMasterIngredientByKey(k) || { name:'', qty:'', unit:'', type:'required', section:'Cupboard' };
      document.getElementById('qtyField').style.display = 'block';
      document.getElementById('typeWrap').style.display = 'block';
      document.getElementById('ingTitle').textContent = 'Edit ingredient';
      document.getElementById('inName').value = x.name || '';
      document.getElementById('inQty').value = x.qty || x.defaultQty || '';
      document.getElementById('inUnit').value = x.unit || x.defaultUnit || '';
      document.getElementById('inType').value = x.type || x.defaultType || 'required';
      document.getElementById('inSection').value = x.section || x.defaultSection || (typeof sec === 'function' ? sec(x.name || '') : 'Cupboard');
      document.getElementById('ing').classList.add('on');
    } catch(e) {
      if (typeof originalOpenMasterIng === 'function') return originalOpenMasterIng(k);
      showLiveError('openMasterIng', e, 'key=' + k);
    }
  };

  const originalSaveIng = window.saveIng;
  window.saveIng = function saveIngredientWithMasterQty(){
    try {
      if (editMode !== 'master') return originalSaveIng();
      const name = clean(document.getElementById('inName')?.value);
      if (!name) return;
      const parts = typeof splitQU === 'function'
        ? splitQU(document.getElementById('inQty')?.value, document.getElementById('inUnit')?.value)
        : { qty: clean(document.getElementById('inQty')?.value), unit: document.getElementById('inUnit')?.value || '' };
      const x = { name, qty: parts.qty || '', unit: parts.unit || '', type: document.getElementById('inType')?.value || 'required', section: document.getElementById('inSection')?.value || (typeof sec === 'function' ? sec(name) : 'Cupboard') };
      const oldKey = masterKey;
      if (Array.isArray(S?.meals)) {
        S.meals.forEach(m => (m.ingredients || []).forEach(g => {
          if (lower(g.name) === oldKey) {
            g.name = x.name;
            g.qty = x.qty;
            g.unit = x.unit;
            g.type = x.type;
            g.section = x.section;
          }
        }));
      }
      if (Array.isArray(S?.masterIngredients)) {
        S.masterIngredients.forEach(g => {
          if (lower(g.name) === oldKey || lower(g.key) === oldKey) {
            g.name = x.name; g.qty = x.qty; g.unit = x.unit; g.type = x.type; g.section = x.section;
          }
        });
      }
      if (Array.isArray(S?.ingredients)) {
        S.ingredients.forEach(g => {
          if (lower(g.name) === oldKey) {
            g.name = x.name; g.defaultQty = x.qty; g.defaultUnit = x.unit; g.defaultType = x.type; g.defaultSection = x.section;
          }
        });
      }
      if (Array.isArray(S?.mealIngredients) && Array.isArray(S?.ingredients)) {
        const ids = S.ingredients.filter(g => lower(g.name) === lower(x.name)).map(g => g.id);
        S.mealIngredients.forEach(r => { if (ids.includes(r.ingredientId)) { r.qty = x.qty; r.unit = x.unit; r.type = x.type; r.section = x.section; } });
      }
      S.finalItems = [];
      if (typeof closeM === 'function') closeM('ing'); else document.getElementById('ing')?.classList.remove('on');
      if (typeof save === 'function') save();
      if (typeof renderSetup === 'function') renderSetup(); else if (typeof render === 'function') render();
    } catch(e) {
      showLiveError('saveIng master', e, 'masterKey=' + masterKey);
    }
  };

  const originalEditMeal = window.editMeal;
  if (typeof originalEditMeal === 'function') {
    window.editMeal = function editMealWithStableId(n){
      let found = null;
      if (window.shoppingDb) found = shoppingDb.findMealByName(n); else found = findMealByNameFallback(n);
      if (found) window.__targetMealIdForIngredient = found.id;
      if (window.shoppingDb && typeof shoppingDb.rebuildDisplayIngredients === 'function') shoppingDb.rebuildDisplayIngredients();
      const result = originalEditMeal(found ? found.name : n);
      setTimeout(rewireMealRemoveButtons, 0);
      return result;
    };
  }

  const originalOpenIngredientPicker = window.openIngredientPicker;
  window.openIngredientPicker = function openIngredientPickerWithStableMealId(){
    let found = null;
    if (window.shoppingDb) found = shoppingDb.findMealByName(currentMealNameCandidate()); else found = findMealByNameFallback(currentMealNameCandidate());
    if (found) window.__targetMealIdForIngredient = found.id;
    if (typeof originalOpenIngredientPicker === 'function') return originalOpenIngredientPicker();
  };

  window.savePickedIngredient = function savePickedIngredientFixed(){
    try {
      if (window.shoppingDb && typeof shoppingDb.migrateOldIngredientsToStructure === 'function') shoppingDb.migrateOldIngredientsToStructure(); else ensureMealIdsFallback();
      const name = clean(document.getElementById('pickName')?.value);
      if (!name) { alert('Add an ingredient name first.'); return; }
      const qty = clean(document.getElementById('pickQty')?.value);
      const unit = document.getElementById('pickUnit')?.value || '';
      const type = document.getElementById('pickType')?.value || 'required';
      const section = document.getElementById('pickSection')?.value || (typeof sec === 'function' ? sec(name) : 'Cupboard');
      const currentMeal = findCurrentMeal();
      if (!currentMeal) throw new Error('Could not find meal to add ingredient.');
      const raw = { name, qty, unit, type, section };
      if (window.shoppingDb && typeof shoppingDb.addIngredientToMeal === 'function') shoppingDb.addIngredientToMeal(currentMeal.id, raw); else { currentMeal.ingredients = Array.isArray(currentMeal.ingredients) ? currentMeal.ingredients : []; currentMeal.ingredients.push(raw); }
      window.__targetMealIdForIngredient = currentMeal.id;
      S.finalItems = [];
      if (typeof closeM === 'function') closeM('ingredientPicker'); else document.getElementById('ingredientPicker')?.classList.remove('on');
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      if (typeof editMeal === 'function') editMeal(currentMeal.name);
    } catch(e) { showLiveError('savePickedIngredient', e, 'targetMealId=' + window.__targetMealIdForIngredient); }
  };

  window.liveRemoveIngredient = function liveRemoveIngredient(i){
    try {
      const currentMeal = findCurrentMeal();
      if (!currentMeal) throw new Error('Could not find current meal. targetMealId=' + window.__targetMealIdForIngredient + ', candidate=' + currentMealNameCandidate());
      if (!confirm('Remove ingredient?')) return;
      const removed = removeIngredientDirect(currentMeal, Number(i));
      if (!removed) throw new Error('removeIngredientDirect returned false for index ' + i + ', meal=' + currentMeal.name + ', mealId=' + currentMeal.id);
      S.finalItems = [];
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      if (typeof editMeal === 'function') editMeal(currentMeal.name);
    } catch(e) {
      const meal = findCurrentMeal();
      const extra = 'index=' + i + ', targetMealId=' + window.__targetMealIdForIngredient + ', meal=' + (meal ? meal.name : 'none') + ', displayCount=' + (meal && Array.isArray(meal.ingredients) ? meal.ingredients.length : 'none') + ', links=' + (Array.isArray(S?.mealIngredients) ? S.mealIngredients.length : 'none');
      showLiveError('liveRemoveIngredient', e, extra);
    }
  };

  window.delIng = window.liveRemoveIngredient;

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function patchedRender(){
      if (window.shoppingDb && typeof shoppingDb.rebuildDisplayIngredients === 'function') shoppingDb.rebuildDisplayIngredients();
      originalRender();
      setTimeout(applyLivePatch, 0);
    };
  }

  const originalRespond = window.respond;
  if (typeof originalRespond === 'function') {
    window.respond = function patchedRespond(i, s){ originalRespond(i, String(s || '').toLowerCase()); setTimeout(applyLivePatch, 0); };
  }

  setTimeout(function(){ if (typeof render === 'function') render(); applyLivePatch(); }, 250);
  setInterval(function(){ if (document.hidden) return; if (typeof window.refreshSharedList === 'function') window.refreshSharedList(); }, 15000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && typeof window.refreshSharedList === 'function') window.refreshSharedList(); });
})();
