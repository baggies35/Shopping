(() => {
  const $ = (id) => document.getElementById(id);
  const normText = (s) => String(s || '').toLowerCase().trim();

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
            <input id="quickAddName" placeholder="e.g. Squash">
            <div class="fieldLabel">Quantity (optional)</div>
            <input id="quickAddQty" placeholder="e.g. 2">
            <button class="btn" style="width:100%;margin-top:12px" id="quickAddSave">Add to shopping list</button>
          </div>
        </div>
      </div>`);

    $('quickAddClose').onclick = () => $('quickAddModal').classList.remove('on');
    $('quickAddSave').onclick = addQuickItem;
    $('quickAddName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addQuickItem();
    });
  }

  function openQuickAdd() {
    ensureQuickAddModal();
    $('quickAddName').value = '';
    $('quickAddQty').value = '';
    $('quickAddModal').classList.add('on');
    setTimeout(() => $('quickAddName').focus(), 50);
  }

  function addQuickItem() {
    const name = $('quickAddName').value.trim();
    const qty = $('quickAddQty').value.trim();
    if (!name) return alert('Enter an item first.');

    S.items = Array.isArray(S.items) ? S.items : [];
    const existing = S.items.find(x => normText(x.name) === normText(name) && (x.status || 'needed') !== 'bought');
    if (existing) {
      if (qty) existing.qty = qty;
      existing.status = 'needed';
    } else {
      S.items.push({
        name,
        qty,
        unit: '',
        section: typeof sec === 'function' ? sec(name) : 'Cupboard',
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
    btn.innerHTML = '<b>Quick add</b><span>Add an ad-hoc item straight to the list.</span>';
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