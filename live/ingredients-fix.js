(() => {
  const clean = (v) => String(v || '').trim();
  const keyOf = (x) => norm((typeof x === 'string') ? x : (x && x.name));
  const sectionFor = (name) => { try { return sec(name); } catch { return 'Cupboard'; } };
  const allowedTypes = ['required', 'staple', 'optional'];
  const units = ['g','kg','ml','l','pack','tin','tub','each','tbsp','tsp','cloves','loaf','pints'];

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function splitQtyUnit(qty, unit) {
    let q = clean(qty);
    let u = clean(unit);
    if (!q || u) return { qty: q, unit: u };
    const m = q.match(/^(.+?)\s+(g|kg|ml|l|pack|tin|tub|each|tbsp|tsp|cloves|loaf|pints)$/i);
    if (!m) return { qty: q, unit: u };
    return { qty: clean(m[1]), unit: m[2].toLowerCase() };
  }

  function normaliseIngredient(x) {
    const parts = splitQtyUnit(x?.qty, x?.unit);
    return {
      name: clean(x?.name),
      qty: parts.qty,
      unit: parts.unit,
      type: clean(x?.type || 'required'),
      section: clean(x?.section || sectionFor(x?.name))
    };
  }

  function bestTypeForIngredient(k) {
    const counts = {};
    (S.meals || []).forEach(m => (m.ingredients || []).forEach(x => {
      if (keyOf(x.name) === k) counts[x.type || 'required'] = (counts[x.type || 'required'] || 0) + 1;
    }));
    return Object.entries(counts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'required';
  }

  function bestQtyUnitForIngredient(k) {
    const counts = {};
    const examples = {};
    (S.meals || []).forEach(m => (m.ingredients || []).forEach(raw => {
      if (keyOf(raw.name) !== k) return;
      const x = normaliseIngredient(raw);
      if (!x.qty && !x.unit) return;
      const combo = `${x.qty}|${x.unit}`;
      counts[combo] = (counts[combo] || 0) + 1;
      examples[combo] = { qty: x.qty, unit: x.unit };
    }));
    const best = Object.entries(counts).sort((a,b) => b[1] - a[1])[0]?.[0];
    return best ? examples[best] : { qty: '', unit: '' };
  }

  function ensureMasterIngredients() {
    S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
    const byKey = {};

    const add = (raw) => {
      const x = normaliseIngredient(raw);
      if (!x.name) return;
      const k = keyOf(x.name);
      const existing = byKey[k] || {};
      const best = bestQtyUnitForIngredient(k);
      byKey[k] = {
        name: clean(existing.name || x.name),
        qty: clean(existing.qty || x.qty || best.qty || ''),
        unit: clean(existing.unit || x.unit || best.unit || ''),
        section: clean(existing.section || x.section || sectionFor(x.name)),
        type: clean(existing.type || x.type || bestTypeForIngredient(k) || 'required')
      };
    };

    S.masterIngredients.forEach(add);
    (S.meals || []).forEach(m => (m.ingredients || []).forEach(add));
    (S.weekly || []).forEach(add);

    S.masterIngredients = Object.values(byKey).sort((a, b) => a.name.localeCompare(b.name));
    return S.masterIngredients;
  }

  window.allIngredients = function allIngredientsWithMaster() {
    const masters = ensureMasterIngredients();
    const mealsByKey = {};
    (S.meals || []).forEach(m => (m.ingredients || []).forEach(x => {
      const k = keyOf(x.name);
      if (!mealsByKey[k]) mealsByKey[k] = [];
      if (!mealsByKey[k].includes(m.name)) mealsByKey[k].push(m.name);
    }));
    return masters.map(raw => {
      const x = normaliseIngredient(raw);
      const best = bestQtyUnitForIngredient(keyOf(x.name));
      return {
        key: keyOf(x.name),
        name: x.name,
        qty: x.qty || best.qty || '',
        unit: x.unit || best.unit || '',
        type: x.type || bestTypeForIngredient(keyOf(x.name)),
        section: x.section || sectionFor(x.name),
        meals: mealsByKey[keyOf(x.name)] || []
      };
    });
  };

  function ensurePickerModal() {
    if (document.getElementById('ingredientPicker')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'ingredientPicker';
    modal.innerHTML = `
      <div class="sheet">
        <div class="between">
          <h2>Add ingredient</h2>
          <button class="btn alt small" onclick="closeM('ingredientPicker')">Close</button>
        </div>
        <div class="card">
          <div class="fieldLabel">Search existing ingredients</div>
          <input id="ingredientSearch" placeholder="Start typing, e.g. chicken, cheese, pasta" oninput="renderIngredientChoices()">
          <div class="hint">Tap an existing ingredient to prefill the details below.</div>
          <div id="ingredientChoices" style="margin-top:10px"></div>
        </div>
        <div class="card">
          <b id="chosenIngredientTitle">New ingredient</b>
          <div class="fieldLabel">Ingredient name</div>
          <input id="pickName" placeholder="e.g. chicken">
          <div class="fieldLabel">Quantity for this meal</div>
          <input id="pickQty" placeholder="e.g. 1, 500, 2">
          <div class="fieldLabel">Unit</div>
          <select id="pickUnit"><option value="">none</option>${units.map(u=>`<option>${u}</option>`).join('')}</select>
          <div class="fieldLabel">Type</div>
          <select id="pickType"><option>required</option><option>staple</option><option>optional</option></select>
          <div class="fieldLabel">Tesco section</div>
          <select id="pickSection"></select>
          <button class="btn" style="width:100%;margin-top:12px" onclick="savePickedIngredient()">Add to meal</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('pickSection').innerHTML = sections.map(s => `<option>${s}</option>`).join('');
  }

  window.renderIngredientChoices = function renderIngredientChoices() {
    ensureMasterIngredients();
    const q = keyOf(document.getElementById('ingredientSearch')?.value || '');
    let arr = S.masterIngredients;
    if (q) arr = arr.filter(x => keyOf(x.name).includes(q));
    arr = arr.slice(0, 30);
    const el = document.getElementById('ingredientChoices');
    if (!el) return;
    el.innerHTML = arr.map(raw => {
      const x = normaliseIngredient(raw);
      const k = keyOf(x.name);
      const qtyText = [x.qty, x.unit].filter(Boolean).join(' ');
      const details = [qtyText, x.type || bestTypeForIngredient(k), x.section || sectionFor(x.name)].filter(Boolean).join(' · ');
      return `<button class="tile" style="width:100%;min-height:auto;margin:6px 0" onclick="chooseIngredient('${k}')"><b>${escapeHtml(cap(x.name))}</b><span>${escapeHtml(details || 'No details yet')}</span></button>`;
    }).join('') || '<p class="muted">No match. Type the new ingredient details below.</p>';
  };

  window.chooseIngredient = function chooseIngredient(k) {
    const raw = ensureMasterIngredients().find(i => keyOf(i.name) === k);
    if (!raw) return;
    const x = normaliseIngredient(raw);
    const best = bestQtyUnitForIngredient(k);
    const qty = x.qty || best.qty || '';
    const unit = x.unit || best.unit || '';
    document.getElementById('chosenIngredientTitle').textContent = cap(x.name);
    document.getElementById('pickName').value = x.name || '';
    document.getElementById('pickQty').value = qty;
    document.getElementById('pickUnit').value = units.includes(unit) ? unit : '';
    document.getElementById('pickType').value = allowedTypes.includes(x.type) ? x.type : bestTypeForIngredient(k);
    document.getElementById('pickSection').value = x.section || sectionFor(x.name);
  };

  window.openIngredientPicker = function openIngredientPicker() {
    ensurePickerModal();
    ensureMasterIngredients();
    document.getElementById('ingredientSearch').value = '';
    document.getElementById('chosenIngredientTitle').textContent = 'New ingredient';
    document.getElementById('pickName').value = '';
    document.getElementById('pickQty').value = '';
    document.getElementById('pickUnit').value = '';
    document.getElementById('pickType').value = 'required';
    document.getElementById('pickSection').value = 'Cupboard';
    renderIngredientChoices();
    document.getElementById('ingredientPicker').classList.add('on');
  };

  window.savePickedIngredient = function savePickedIngredient() {
    const name = clean(document.getElementById('pickName').value);
    if (!name) { alert('Add an ingredient name first.'); return; }
    const unit = document.getElementById('pickUnit').value || '';
    const type = document.getElementById('pickType').value || 'required';
    const section = document.getElementById('pickSection').value || sectionFor(name);
    const qty = clean(document.getElementById('pickQty').value);
    const x = { name, qty, unit, type, section };
    const k = keyOf(name);

    let master = ensureMasterIngredients().find(i => keyOf(i.name) === k);
    if (!master) {
      S.masterIngredients.push({ name, qty, unit, type, section });
    } else {
      master.name = name;
      master.unit = unit;
      master.section = section || sectionFor(name);
      master.type = type || 'required';
      if (qty) master.qty = qty;
    }

    const m = meal(mealName);
    if (!m) return;
    const existingIx = (m.ingredients || []).findIndex(i => keyOf(i.name) === k);
    if (existingIx >= 0 && !confirm(`${cap(name)} is already on this meal. Add it again anyway?`)) return;
    m.ingredients.push(x);
    S.finalItems = [];
    closeM('ingredientPicker');
    save();
    render();
    editMeal(mealName);
  };

  const oldEditMeal = window.editMeal;
  window.editMeal = function editMealWithBetterPicker(n) {
    mealName = n;
    const m = meal(n);
    if (!m) return oldEditMeal(n);
    ensureMasterIngredients();
    $('mealTitle').textContent = n;
    $('mealBody').innerHTML = `<div class="card"><div class="fieldLabel">Meal name</div><input id="mealN" value="${escapeHtml(m.name)}"><button class="btn alt" style="width:100%;margin-top:8px" onclick="saveMealName()">Save meal name</button></div><div class="card"><div class="between"><div><b>Ingredients</b><div class="muted">Use Add ingredient to search existing items or create a new one.</div></div><button class="btn small" onclick="openIngredientPicker()">Add ingredient</button></div>${m.ingredients.map((raw,i)=>{const x=normaliseIngredient(raw);return `<div class="item"><div><b>${qt(x)} ${cap(x.name)}</b><div class="muted">${x.type || 'required'} · ${x.section || sectionFor(x.name)}</div></div><div><button class="btn small alt" onclick="openIng(${i})">Edit</button> <button class="btn small red" onclick="delIng(${i})">Remove</button></div></div>`}).join('') || '<p class="muted">No ingredients yet.</p>'}</div>`;
    $('meal').classList.add('on');
  };

  const oldSaveIng = window.saveIng;
  window.saveIng = function saveIngWithMasterDetails() {
    const beforeName = clean($('inName').value);
    const beforeQty = clean($('inQty')?.value || '');
    const beforeUnit = $('inUnit')?.value || '';
    const beforeType = $('inType')?.value || 'required';
    const beforeSection = $('inSection')?.value || sectionFor(beforeName);
    oldSaveIng();
    if (beforeName && typeof S !== 'undefined') {
      const k = keyOf(beforeName);
      ensureMasterIngredients();
      let x = S.masterIngredients.find(i => keyOf(i.name) === k);
      if (!x) {
        x = { name: beforeName };
        S.masterIngredients.push(x);
      }
      x.name = beforeName;
      if (beforeQty) x.qty = beforeQty;
      x.unit = beforeUnit;
      x.type = beforeType;
      x.section = beforeSection;
      save();
    }
  };
})();