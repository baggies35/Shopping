(() => {
  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function ingredientDefaults(){
    try { return typeof allIngredients === 'function' ? allIngredients() : []; }
    catch { return []; }
  }

  function findIngredientByName(name){
    const k = lower(name);
    return ingredientDefaults().find(x => lower(x.name) === k || x.key === k) || null;
  }

  function attachWeeklyIngredientLookup(){
    const input = document.getElementById('inName');
    if (!input) return;
    let dl = document.getElementById('weeklyIngredientOptions');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'weeklyIngredientOptions';
      document.body.appendChild(dl);
    }
    dl.innerHTML = ingredientDefaults().map(x => '<option value="' + String(x.name || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '"></option>').join('');
    input.setAttribute('list', 'weeklyIngredientOptions');
    input.onchange = input.onblur = function(){
      const found = findIngredientByName(input.value);
      if (!found) return;
      document.getElementById('inName').value = found.name || '';
      document.getElementById('inQty').value = found.qty || '';
      document.getElementById('inUnit').value = found.unit || '';
      document.getElementById('inType').value = found.type || 'required';
      document.getElementById('inSection').value = found.section || (typeof sec === 'function' ? sec(found.name || '') : 'Cupboard');
    };
  }

  window.openWeekly = function openWeeklyWithIngredientLookup(i){
    try {
      if (typeof resetModal === 'function') resetModal();
      editMode = 'weekly';
      weeklyIx = i;
      const x = i == null ? {} : (S.weekly && S.weekly[i]) || {};
      document.getElementById('ingTitle').textContent = i == null ? 'Add weekly item' : 'Edit weekly item';
      const qtyField = document.getElementById('qtyField');
      const typeWrap = document.getElementById('typeWrap');
      if (qtyField) qtyField.style.display = 'block';
      if (typeWrap) typeWrap.style.display = 'block';
      document.getElementById('inName').value = x.name || '';
      document.getElementById('inQty').value = x.qty || '';
      document.getElementById('inUnit').value = x.unit || '';
      document.getElementById('inType').value = x.type || 'required';
      document.getElementById('inSection').value = x.section || (x.name && typeof sec === 'function' ? sec(x.name) : 'Cupboard');
      document.getElementById('ing').classList.add('on');
      attachWeeklyIngredientLookup();
      setTimeout(() => document.getElementById('inName')?.focus(), 150);
    } catch(e) {
      alert('Could not open weekly item: ' + (e && e.message ? e.message : e));
    }
  };

  const previousSaveIng = window.saveIng;
  window.saveIng = function saveWeeklyWithIngredientDefaults(){
    if (editMode !== 'weekly') return previousSaveIng();
    try {
      const parts = typeof splitQU === 'function'
        ? splitQU(document.getElementById('inQty').value, document.getElementById('inUnit').value)
        : { qty: clean(document.getElementById('inQty').value), unit: document.getElementById('inUnit').value || '' };
      const x = {
        name: clean(document.getElementById('inName').value),
        qty: parts.qty || '',
        unit: parts.unit || '',
        type: document.getElementById('inType').value || 'required',
        section: document.getElementById('inSection').value || 'Cupboard',
        source: 'Weekly'
      };
      if (!x.name) return;
      S.weekly = Array.isArray(S.weekly) ? S.weekly : [];
      if (weeklyIx == null || weeklyIx === undefined) S.weekly.push(x);
      else S.weekly[weeklyIx] = x;
      S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
      if (!S.masterIngredients.some(g => lower(g.name) === lower(x.name))) S.masterIngredients.push({...x});
      if (typeof closeM === 'function') closeM('ing');
      if (typeof ensureMasterIngredients === 'function') ensureMasterIngredients(false);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      if (typeof renderSetup === 'function') renderSetup();
    } catch(e) {
      alert('Could not save weekly item: ' + (e && e.message ? e.message : e));
    }
  };
})();
