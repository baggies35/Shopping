(() => {
  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function title(v){ return String(v || '').replace(/\b\w/g, c => c.toUpperCase()); }

  function firstIngredientForKey(k){
    try {
      const arr = typeof allIngredients === 'function' ? allIngredients() : [];
      const fromAll = arr.find(x => x.key === k || lower(x.name) === k);
      if (fromAll) return fromAll;
      if (Array.isArray(S?.meals)) {
        for (const meal of S.meals) {
          const found = (meal.ingredients || []).find(x => lower(x.name) === k);
          if (found) return found;
        }
      }
      return null;
    } catch(e) { return null; }
  }

  function makeHomeCardsOpenPlan(){
    try {
      const days = document.getElementById('days');
      if (!days) return;
      days.querySelectorAll('.day, .card, .item').forEach(el => {
        const text = (el.textContent || '').trim();
        if (!text || text.toLowerCase().includes('what we')) return;
        el.style.cursor = 'pointer';
        el.onclick = function(ev){
          if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
          if (typeof go === 'function') go('plan');
        };
      });
    } catch(e) { console.warn('home click patch failed', e); }
  }

  function ingredientDefaultList(){
    try { return typeof allIngredients === 'function' ? allIngredients() : []; }
    catch { return []; }
  }

  function renderIngredientsSetupFixed(){
    try {
      const body = document.getElementById('setupBody');
      if (!body) return;
      const arr = ingredientDefaultList();
      body.innerHTML = `<div class="card"><div class="between"><div><b>Ingredients</b><div class="muted">Edit global ingredient defaults.</div></div><button class="btn small" onclick="openNewMasterIng()">Add</button></div>${arr.map(x=>`<div class="item"><div><b>${title(x.name)}</b><div class="muted">${typeof qt==='function' ? (qt(x)||'no qty') : (x.qty||'no qty')} · ${x.type||'required'} · ${x.section}</div></div><button class="btn small alt" onclick="openMasterIng('${x.key}')">Edit</button></div>`).join('')||'<p class="muted">No ingredients yet.</p>'}</div>`;
    } catch(e) { alert('Could not show ingredients: ' + (e && e.message ? e.message : e)); }
  }

  window.openNewMasterIng = function openNewMasterIng(){
    try {
      if (typeof resetModal === 'function') resetModal();
      editMode = 'newMaster';
      masterKey = '';
      document.getElementById('ingTitle').textContent = 'Add ingredient';
      const qtyField = document.getElementById('qtyField');
      const typeWrap = document.getElementById('typeWrap');
      if (qtyField) qtyField.style.display = 'block';
      if (typeWrap) typeWrap.style.display = 'block';
      document.getElementById('inName').value = '';
      document.getElementById('inQty').value = '';
      document.getElementById('inUnit').value = '';
      document.getElementById('inType').value = 'required';
      document.getElementById('inSection').value = 'Cupboard';
      document.getElementById('ing').classList.add('on');
      setTimeout(() => document.getElementById('inName')?.focus(), 150);
    } catch(e) { alert('Could not open add ingredient: ' + (e && e.message ? e.message : e)); }
  };

  window.openMasterIng = function openMasterIngFixed(k){
    try {
      if (typeof resetModal === 'function') resetModal();
      editMode = 'master';
      masterKey = k;
      const x = firstIngredientForKey(k) || { name:'', qty:'', unit:'', type:'required', section:'Cupboard' };
      const qtyField = document.getElementById('qtyField');
      const typeWrap = document.getElementById('typeWrap');
      if (qtyField) qtyField.style.display = 'block';
      if (typeWrap) typeWrap.style.display = 'block';
      document.getElementById('ingTitle').textContent = 'Edit ingredient';
      document.getElementById('inName').value = x.name || '';
      document.getElementById('inQty').value = x.qty || '';
      document.getElementById('inUnit').value = x.unit || '';
      document.getElementById('inType').value = x.type || 'required';
      document.getElementById('inSection').value = x.section || (typeof sec === 'function' ? sec(x.name || '') : 'Cupboard');
      document.getElementById('ing').classList.add('on');
    } catch(e) {
      alert('Could not open ingredient editor: ' + (e && e.message ? e.message : e));
    }
  };

  const originalChooseIngredient = window.chooseIngredient;
  window.chooseIngredient = function chooseIngredientAndScroll(k){
    try {
      if (typeof originalChooseIngredient === 'function') originalChooseIngredient(k);
      const picked = firstIngredientForKey(k);
      if (picked) {
        const titleEl = document.getElementById('chosenIngredientTitle');
        const name = document.getElementById('pickName');
        const qty = document.getElementById('pickQty');
        const unit = document.getElementById('pickUnit');
        const type = document.getElementById('pickType');
        const section = document.getElementById('pickSection');
        if (titleEl) titleEl.textContent = title(picked.name);
        if (name) name.value = picked.name || '';
        if (qty) qty.value = picked.qty || '';
        if (unit) unit.value = picked.unit || '';
        if (type) type.value = picked.type || 'required';
        if (section) section.value = picked.section || (typeof sec === 'function' ? sec(picked.name || '') : 'Cupboard');
      }
      const target = document.getElementById('chosenIngredientTitle') || document.getElementById('pickName');
      if (target && target.scrollIntoView) setTimeout(() => target.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
      setTimeout(() => document.getElementById('pickQty')?.focus(), 250);
    } catch(e) {
      alert('Could not load ingredient details: ' + (e && e.message ? e.message : e));
    }
  };

  const originalSaveIng = window.saveIng;
  window.saveIng = function saveIngFixed(){
    if (editMode !== 'master' && editMode !== 'newMaster') return originalSaveIng();
    try {
      const parts = typeof splitQU === 'function'
        ? splitQU(document.getElementById('inQty').value, document.getElementById('inUnit').value)
        : { qty: clean(document.getElementById('inQty').value), unit: document.getElementById('inUnit').value || '' };
      const x = {
        name: clean(document.getElementById('inName').value),
        qty: parts.qty || '',
        unit: parts.unit || '',
        type: document.getElementById('inType').value || 'required',
        section: document.getElementById('inSection').value || 'Cupboard'
      };
      if (!x.name) return;

      if (editMode === 'newMaster') {
        S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
        if (!S.masterIngredients.some(g => lower(g.name) === lower(x.name))) S.masterIngredients.push({...x});
      } else {
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
        S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
        S.masterIngredients.forEach(g => {
          if (lower(g.name) === oldKey || lower(g.key) === oldKey) {
            g.name = x.name;
            g.qty = x.qty;
            g.unit = x.unit;
            g.type = x.type;
            g.section = x.section;
          }
        });
      }

      S.finalItems = [];
      if (typeof closeM === 'function') closeM('ing');
      if (typeof ensureMasterIngredients === 'function') ensureMasterIngredients(false);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      if (typeof renderSetup === 'function') renderSetup();
      setTimeout(() => { makeHomeCardsOpenPlan(); if (setupMode === 'ingredients') renderIngredientsSetupFixed(); }, 50);
    } catch(e) {
      alert('Could not save ingredient: ' + (e && e.message ? e.message : e));
    }
  };

  const originalSetupTab = window.setupTab;
  if (typeof originalSetupTab === 'function') {
    window.setupTab = function setupTabWithAdd(t){
      const result = originalSetupTab(t);
      if (t === 'ingredients') setTimeout(renderIngredientsSetupFixed, 50);
      return result;
    };
  }

  const originalRenderSetup = window.renderSetup;
  if (typeof originalRenderSetup === 'function') {
    window.renderSetup = function renderSetupWithAdd(){
      const result = originalRenderSetup();
      if (setupMode === 'ingredients') setTimeout(renderIngredientsSetupFixed, 0);
      return result;
    };
  }

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function renderWithBehaviourFixes(){
      const result = originalRender();
      setTimeout(() => { makeHomeCardsOpenPlan(); if (setupMode === 'ingredients') renderIngredientsSetupFixed(); }, 50);
      return result;
    };
  }

  setTimeout(() => { makeHomeCardsOpenPlan(); if (setupMode === 'ingredients') renderIngredientsSetupFixed(); }, 250);
})();
