(() => {
  const $ = id => document.getElementById(id);
  const normText = s => String(s || '').toLowerCase().trim();
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selectedQuickIngredient = null;

  function ingredientLibrary() {
    const map = new Map();
    const add = raw => {
      if (!raw || !raw.name) return;
      const key = normText(raw.name);
      if (!key) return;
      const cur = map.get(key) || {};
      map.set(key, {
        name: raw.name,
        qty: cur.qty || raw.qty || '',
        unit: cur.unit || raw.unit || '',
        type: cur.type || raw.type || 'required',
        section: cur.section || raw.section || (typeof sec === 'function' ? sec(raw.name) : 'Cupboard')
      });
    };
    (S.masterIngredients || []).forEach(add);
    (S.meals || []).forEach(m => (m.ingredients || []).forEach(add));
    (S.weekly || []).forEach(add);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function setNewFieldsVisible(show) {
    const wrap = $('quickNewIngredientFields');
    if (wrap) wrap.style.display = show ? 'block' : 'none';
  }

  function fillNewIngredientDefaults(name) {
    $('quickNewName').value = name || '';
    $('quickNewQty').value = $('quickAddQty').value || '';
    $('quickNewUnit').value = '';
    $('quickNewType').value = 'required';
    $('quickNewSection').value = typeof sec === 'function' ? sec(name) : 'Cupboard';
  }

  function renderQuickMatches() {
    const box = $('quickAddMatches');
    const input = $('quickAddName');
    if (!box || !input) return;
    const q = normText(input.value);
    selectedQuickIngredient = null;
    setNewFieldsVisible(false);

    if (!q) {
      box.innerHTML = '<div class="hint">Start typing to search your ingredients.</div>';
      return;
    }

    const matches = ingredientLibrary().filter(x => normText(x.name).includes(q)).slice(0, 10);
    if (!matches.length) {
      box.innerHTML = `<button type="button" class="btn alt small" id="createQuickIngredient" style="width:100%;text-align:left;margin-top:7px;padding:10px 12px"><b>Create “${esc(input.value)}”</b><span class="muted" style="display:block;font-weight:500">Complete the ingredient details first</span></button>`;
      $('createQuickIngredient').onclick = () => {
        fillNewIngredientDefaults(input.value.trim());
        setNewFieldsVisible(true);
      };
      return;
    }

    box.innerHTML = matches.map((x, i) => `<button type="button" class="btn alt small" data-quick-match="${i}" style="width:100%;text-align:left;margin-top:7px;padding:10px 12px"><b>${esc(x.name)}</b><span class="muted" style="display:block;font-weight:500">${esc(x.section || 'Cupboard')}${x.unit ? ` · ${esc(x.unit)}` : ''}</span></button>`).join('');
    [...box.querySelectorAll('[data-quick-match]')].forEach(btn => {
      btn.onclick = () => {
        const item = matches[Number(btn.dataset.quickMatch)];
        selectedQuickIngredient = item;
        input.value = item.name;
        if (!$('quickAddQty').value && item.qty) $('quickAddQty').value = item.qty;
        box.innerHTML = `<div class="hint">Selected: <b>${esc(item.name)}</b> · ${esc(item.section || 'Cupboard')}</div>`;
      };
    });
  }

  function ensureQuickAddModal() {
    if ($('quickAddModal')) return;
    const unitOptions = (window.units || ['', 'g','kg','ml','l','pack','tin','tub','each','tbsp','tsp','cloves','loaf','pints']).map(x => `<option value="${esc(x)}">${esc(x || 'none')}</option>`).join('');
    const sectionOptions = (window.sections || ['Bathroom','Fruit and veg','Chilled','Cupboard','Bread','Beer and wine','Fizzy drinks','Squash','Sweets','Household','Frozen']).map(x => `<option>${esc(x)}</option>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal" id="quickAddModal"><div class="sheet">
        <div class="between"><h2>Quick add to list</h2><button class="btn alt small" id="quickAddClose">Close</button></div>
        <div class="card">
          <div class="fieldLabel">Item</div><input id="quickAddName" placeholder="Start typing, e.g. Squash" autocomplete="off">
          <div id="quickAddMatches"></div>
          <div class="fieldLabel">Shopping quantity</div><input id="quickAddQty" placeholder="e.g. 1">
          <div id="quickNewIngredientFields" style="display:none;border-top:1px solid var(--line);margin-top:14px;padding-top:10px">
            <b>New ingredient details</b><div class="hint">All fields are required to keep the ingredient list consistent.</div>
            <div class="fieldLabel">Ingredient name</div><input id="quickNewName">
            <div class="fieldLabel">Default quantity</div><input id="quickNewQty" placeholder="e.g. 1">
            <div class="fieldLabel">Unit</div><select id="quickNewUnit">${unitOptions}</select>
            <div class="fieldLabel">Type</div><select id="quickNewType"><option value="required">required</option><option value="staple">staple</option><option value="optional">optional</option></select>
            <div class="fieldLabel">Tesco section</div><select id="quickNewSection">${sectionOptions}</select>
          </div>
          <button class="btn" style="width:100%;margin-top:12px" id="quickAddSave">Add to shopping list</button>
        </div>
      </div></div>`);
    $('quickAddClose').onclick = () => $('quickAddModal').classList.remove('on');
    $('quickAddSave').onclick = addQuickItem;
    $('quickAddName').oninput = renderQuickMatches;
  }

  function openQuickAdd() {
    ensureQuickAddModal();
    selectedQuickIngredient = null;
    $('quickAddName').value = '';
    $('quickAddQty').value = '';
    setNewFieldsVisible(false);
    $('quickAddModal').classList.add('on');
    renderQuickMatches();
    setTimeout(() => $('quickAddName').focus(), 50);
  }

  function addQuickItem() {
    const typedName = $('quickAddName').value.trim();
    const shopQty = $('quickAddQty').value.trim();
    if (!typedName) return alert('Enter an item first.');

    const exact = ingredientLibrary().find(x => normText(x.name) === normText(typedName));
    let ingredient = selectedQuickIngredient || exact;

    if (!ingredient) {
      const newFields = $('quickNewIngredientFields');
      if (!newFields || newFields.style.display === 'none') {
        fillNewIngredientDefaults(typedName);
        setNewFieldsVisible(true);
        return alert('This ingredient does not exist yet. Complete the ingredient details first.');
      }
      const name = $('quickNewName').value.trim();
      const qty = $('quickNewQty').value.trim();
      const unit = $('quickNewUnit').value;
      const type = $('quickNewType').value;
      const section = $('quickNewSection').value;
      if (!name || !qty || !unit || !type || !section) return alert('Complete all new ingredient fields.');
      if (ingredientLibrary().some(x => normText(x.name) === normText(name))) return alert('That ingredient already exists. Search and select it instead.');
      ingredient = { name, qty, unit, type, section };
      S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
      S.masterIngredients.push({...ingredient});
    }

    S.items = Array.isArray(S.items) ? S.items : [];
    const existing = S.items.find(x => normText(x.name) === normText(ingredient.name) && (x.status || 'needed') !== 'bought');
    if (existing) {
      existing.qty = shopQty || ingredient.qty;
      existing.unit = ingredient.unit;
      existing.section = ingredient.section;
      existing.status = 'needed';
    } else {
      S.items.push({name: ingredient.name, qty: shopQty || ingredient.qty, unit: ingredient.unit, section: ingredient.section, type: ingredient.type, source: 'Manual', status: 'needed'});
    }
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    $('quickAddModal').classList.remove('on');
    alert(`${ingredient.name} added to the shopping list.`);
  }

  function addQuickAddTile() {
    const home = $('home');
    if (!home || $('quickAddTile')) return;
    const tiles = home.querySelector('.tiles');
    if (!tiles) return;
    const btn = document.createElement('button');
    btn.id = 'quickAddTile'; btn.className = 'tile';
    btn.innerHTML = '<b>Quick add</b><span>Search ingredients and add straight to the list.</span>';
    btn.onclick = openQuickAdd;
    tiles.insertBefore(btn, tiles.children[1] || null);
  }

  function installIngredientSearch() {
    if (typeof window.renderIngredientsSetup !== 'function' || window.__ingredientSearchInstalled) return;
    window.__ingredientSearchInstalled = true;
    const original = window.renderIngredientsSetup;
    window.renderIngredientsSetup = function() {
      const result = original.apply(this, arguments), body = $('setupBody');
      if (!body || $('ingredientSetupSearch')) return result;
      const wrap = document.createElement('div'); wrap.className = 'card';
      wrap.innerHTML = '<b>Search ingredients</b><div class="fieldLabel">Ingredient name</div><input id="ingredientSetupSearch" placeholder="Start typing, e.g. squash"><div class="hint" id="ingredientSearchCount"></div>';
      body.insertBefore(wrap, body.firstChild);
      const input = $('ingredientSetupSearch');
      input.oninput = () => {
        const q = normText(input.value), rows = [...body.querySelectorAll('.item')]; let shown = 0;
        rows.forEach(row => { const match = !q || normText(row.textContent).includes(q); row.style.display = match ? '' : 'none'; if (match) shown++; });
        $('ingredientSearchCount').textContent = q ? `${shown} match${shown === 1 ? '' : 'es'}` : `${rows.length} ingredients`;
      };
      input.oninput(); return result;
    };
  }

  const oldRender = window.render;
  if (typeof oldRender === 'function') window.render = function() { const r = oldRender.apply(this, arguments); addQuickAddTile(); installIngredientSearch(); return r; };
  addQuickAddTile(); installIngredientSearch();
})();