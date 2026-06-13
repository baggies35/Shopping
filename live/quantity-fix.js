(() => {
  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

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

  const originalSaveIng = window.saveIng;
  window.saveIng = function saveIngFixed(){
    if (editMode !== 'master') return originalSaveIng();
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
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      if (typeof renderSetup === 'function') renderSetup();
    } catch(e) {
      alert('Could not save ingredient: ' + (e && e.message ? e.message : e));
    }
  };
})();
