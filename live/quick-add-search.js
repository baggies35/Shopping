(() => {
  const $ = (id) => document.getElementById(id);
  const normText = (s) => String(s || '').toLowerCase().trim();
  let selectedQuickIngredient = null;

  function ingredientLibrary() {
    const map = new Map();
    const add = (raw) => {
      if (!raw || !raw.name) return;
      const key = normText(raw.name);
      if (!key) return;
      const current = map.get(key) || {};
      map.set(key, {
        name: raw.name,
        qty: current.qty || raw.qty || '',
        unit: current.unit || raw.unit || '',
        type: current.type || raw.type || 'required',
        section: current.section || raw.section || (typeof sec === 'function' ? sec(raw.name) : 'Cupboard')
      });
    };

    (S.masterIngredients || []).forEach(add);
    (S.meals || []).forEach(m => (m.ingredients || []).forEach(add));
    (S.weekly || []).forEach(add);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderQuickMatches() {
    const box = $('quickAddMatches');
    const input = $('quickAddName');
    if (!box || !input) return;

    const q = normText(input.value);
    selectedQuickIngredient = null;
    if (!q) {
      box.innerHTML = '<div class="hint">Start typing to search your ingredients.</div>';
      return;
    }

    const matches = ingredientLibrary()
      .filter(x => normText(x.name).includes(q))
      .slice(0, 10);

    if (!matches.length) {
      box.innerHTML = `<div class="hint">No matching ingredient. You can still add “${input.value.replace(/[&<>"']/g, '')}” as a new item.</div>`;
      return;
    }

    box.innerHTML = matches.map((x, i) => `
      <button type="button" class="btn alt small" data-quick-match="${i}" style="width:100%;text-align:left;margin-top:7px;padding:10px 12px">
        <b>${String(x.name).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</b>
        <span class="muted" style="display:block;font-weight:500">${x.section || 'Cupboard'}${x.unit ? ` · ${x.unit}` : ''}</span>
      </button>`).join('');

    [...box.querySelectorAll('[data-quick-match]')].forEach(btn => {
      btn.onclick = () => {
        const item = matches[Number(btn.dataset.quickMatch)];
        selectedQuickIngredient = item;
        input.value = item.name;
        if (!$('quickAddQty').value && item.qty) $('quickAddQty').value = item.qty;
        box.innerHTML = `<div class="hint">Selected: <b>${item.name}</b> · ${item.section || 'Cupboard'}</div>`;
      };
    });
  }

  function ensureQuickAddModal() {
    if ($('quickAddModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal" id="quickAddModal">
        <div class="sheet">
          <div class="between">
            <h2>Quick add to list</h2>
            <button class="btn alt small" id="quickAddClose">Close</button>
          </div>
          <div class="card">
            <div class="fieldLabel">Item</div>
            <input id="quickAddName" placeholder="Start typing, e.g. Squash" autocomplete="off">
            <div id="quickAddMatches"></div>
            <div class="fieldLabel">Quantity (optional)</div>
            <input id="quickAddQty" placeholder="e.g. 2">
            <button class="btn" style="width:100%;margin-top:12px" id="quickAddSave">Add to shopping list</button>
          </div>
        </div>
      </div>`);

    $('quickAddClose').onclick = () => $('quickAddModal').classList.remove('on');
    $('quickAddSave').onclick = addQuickItem;
    $('quickAddName').oninput = renderQuickMatches;
    $('quickAddName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addQuickItem();
    });
  }

  function openQuickAdd() {
    ensureQuickAddModal();
    selectedQuickIngredient = null;
    $('quickAddName').value = '';
    $('quickAddQty').value = '';
    $('quickAddModal').classList.add('on');
    renderQuickMatches();
    setTimeout(() => $('quickAddName').focus(), 50);
  }

  function addQuickItem() {
    const typedName = $('quickAddName').value.trim();
    const qty = $('quickAddQty').value.trim();
    if (!typedName) return alert('Enter an item first.');

    const exact = ingredientLibrary().find(x => normText(x.name) === normText(typedName));
    const ingredient = selectedQuickIngredient || exact;
    const name = ingredient ? ingredient.name : typedName;

    S.items = Array.isArray(S.items) ? S.items : [];
    const existing = S.items.find(x => normText(x.name) === normText(name) && (x.status || 'needed') !== 'bought');
    if (existing) {
      if (qty) existing.qty = qty;
      if (ingredient && ingredient.unit) existing.unit = ingredient.unit;
      if (ingredient && ingredient.section) existing.section = ingredient.section;
      existing.status = 'needed';
    } else {
      S.items.push({
        name,
        qty: qty || (ingredient && ingredient.qty) || '',
        unit: (ingredient && ingredient.unit) || '',
        section: (ingredient && ingredient.section) || (typeof sec === 'function' ? sec(name) : 'Cupboard'),
        source: 'Manual',
        status: 'needed'
      });
    }

    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    $('quickAddModal').classList.remove('on');
    alert(`${name} added to the shopping list.`);
  }

  function addQuickAddTile() {
    const home = $('home');
    if (!home || $('quickAddTile')) return;
    const tiles = home.querySelector('.tiles');
    if (!tiles) return;
    const btn = document.createElement('button');
    btn.id = 'quickAddTile';
    btn.className = 'tile';
    btn.innerHTML = '<b>Quick add</b><span>Search ingredients and add straight to the list.</span>';
    btn.onclick = openQuickAdd;
    tiles.insertBefore(btn, tiles.children[1] || null);
  }

  function installIngredientSearch() {
    if (typeof window.renderIngredientsSetup !== 'function' || window.__ingredientSearchInstalled) return;
    window.__ingredientSearchInstalled = true;
    const original = window.renderIngredientsSetup;

    window.renderIngredientsSetup = function patchedRenderIngredientsSetup() {
      const result = original.apply(this, arguments);
      const body = $('setupBody');
      if (!body || $('ingredientSetupSearch')) return result;

      const wrap = document.createElement('div');
      wrap.className = 'card';
      wrap.innerHTML = `
        <b>Search ingredients</b>
        <div class="fieldLabel">Ingredient name</div>
        <input id="ingredientSetupSearch" placeholder="Start typing, e.g. squash">
        <div class="hint" id="ingredientSearchCount"></div>`;
      body.insertBefore(wrap, body.firstChild);

      const input = $('ingredientSetupSearch');
      const applyFilter = () => {
        const q = normText(input.value);
        const rows = [...body.querySelectorAll('.item')];
        let shown = 0;
        rows.forEach(row => {
          const match = !q || normText(row.textContent).includes(q);
          row.style.display = match ? '' : 'none';
          if (match) shown++;
        });
        $('ingredientSearchCount').textContent = q ? `${shown} match${shown === 1 ? '' : 'es'}` : `${rows.length} ingredients`;
      };
      input.oninput = applyFilter;
      applyFilter();
      return result;
    };
  }

  const oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function patchedRender() {
      const result = oldRender.apply(this, arguments);
      addQuickAddTile();
      installIngredientSearch();
      return result;
    };
  }

  addQuickAddTile();
  installIngredientSearch();
})();