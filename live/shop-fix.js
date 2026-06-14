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

  function setupManualLookup(){
    const input = document.getElementById('manual');
    if (!input) return;
    let dl = document.getElementById('manualIngredientOptions');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'manualIngredientOptions';
      document.body.appendChild(dl);
    }
    dl.innerHTML = ingredientDefaults().map(x => '<option value="' + String(x.name || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '"></option>').join('');
    input.setAttribute('list', 'manualIngredientOptions');
  }

  window.addManual = function addManualWithIngredientLookup(){
    try {
      const input = document.getElementById('manual');
      const value = clean(input && input.value);
      if (!value) return;
      const found = findIngredientByName(value);
      const item = found ? {
        name: found.name || value,
        qty: found.qty || '',
        unit: found.unit || '',
        type: found.type || 'required',
        section: found.section || (typeof sec === 'function' ? sec(found.name || value) : 'Cupboard'),
        source: 'Manual',
        status: 'needed'
      } : {
        name: value,
        qty: '',
        unit: '',
        type: 'required',
        section: typeof sec === 'function' ? sec(value) : 'Cupboard',
        source: 'Manual',
        status: 'needed'
      };
      S.items = Array.isArray(S.items) ? S.items : [];
      S.items.push(item);
      input.value = '';
      if (typeof save === 'function') save();
      if (typeof renderShop === 'function') renderShop();
      else if (typeof render === 'function') render();
    } catch(e) {
      alert('Could not add shopping item: ' + (e && e.message ? e.message : e));
    }
  };

  const originalRenderShop = window.renderShop;
  if (typeof originalRenderShop === 'function') {
    window.renderShop = function renderShopWithManualLookup(){
      const result = originalRenderShop();
      setTimeout(setupManualLookup, 20);
      return result;
    };
  }

  const originalGo = window.go;
  if (typeof originalGo === 'function') {
    window.go = function goWithManualLookup(screenName){
      const result = originalGo(screenName);
      if (screenName === 'shop') setTimeout(setupManualLookup, 50);
      return result;
    };
  }

  setTimeout(setupManualLookup, 250);
})();
