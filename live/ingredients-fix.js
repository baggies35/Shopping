(() => {
  const clean = (v) => String(v || '').trim();
  const keyOf = (x) => norm((typeof x === 'string') ? x : (x && x.name));
  const sectionFor = (name) => {
    try { return sec(name); } catch { return 'Cupboard'; }
  };

  function ensureMasterIngredients() {
    S.masterIngredients = Array.isArray(S.masterIngredients) ? S.masterIngredients : [];
    const byKey = {};

    S.masterIngredients.forEach(x => {
      if (!clean(x.name)) return;
      const k = keyOf(x.name);
      byKey[k] = {
        name: clean(x.name),
        unit: x.unit || '',
        section: x.section || sectionFor(x.name)
      };
    });

    (S.meals || []).forEach(m => (m.ingredients || []).forEach(x => {
      if (!clean(x.name)) return;
      const k = keyOf(x.name);
      if (!byKey[k]) {
        byKey[k] = {
          name: clean(x.name),
          unit: x.unit || '',
          section: x.section || sectionFor(x.name)
        };
      }
    }));

    (S.weekly || []).forEach(x => {
      if (!clean(x.name)) return;
      const k = keyOf(x.name);
      if (!byKey[k]) {
        byKey[k] = {
          name: clean(x.name),
          unit: x.unit || '',
          section: x.section || sectionFor(x.name)
        };
      }
    });

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
    return masters.map(x => ({
      key: keyOf(x.name),
      name: x.name,
      unit: x.unit || '',
      section: x.section || sectionFor(x.name),
      meals: mealsByKey[keyOf(x.name)] || []
    }));
  };

  const oldLoad = window.load;
  if (typeof oldLoad === 'function') {
    window.load = function loadWithMasterIngredients() {
      oldLoad();
      ensureMasterIngredients();
      localStorage.setItem('shopping-live', JSON.stringify(S));
    };
  }

  const oldEditMeal = window.editMeal;
  window.editMeal = function editMealWithPicker(n) {
    mealName = n;
    const m = meal(n);
    if (!m) return oldEditMeal(n);
    ensureMasterIngredients();
    $('mealTitle').textContent = n;
    $('mealBody').innerHTML = `<div class="card"><div class="fieldLabel">Meal name</div><input id="mealN" value="${m.name}"><button class="btn alt" style="width:100%;margin-top:8px" onclick="saveMealName()">Save meal name</button></div><div class="card"><div class="between"><b>Ingredients</b><button class="btn small" onclick="openIngredientPicker()">Add</button></div>${m.ingredients.map((x,i)=>`<div class="item"><div><b>${qt(x)} ${cap(x.name)}</b><div class="muted">${x.type} · ${x.section}</div></div><div><button class="btn small alt" onclick="openIng(${i})">Edit</button> <button class="btn small red" onclick="delIng(${i})">Remove</button></div></div>`).join('') || '<p class="muted">No ingredients yet.</p>'}</div>`;
    $('meal').classList.add('on');
  };

  window.openIngredientPicker = function openIngredientPicker() {
    ensureMasterIngredients();
    const options = S.masterIngredients.map((x, i) => `${i + 1}. ${cap(x.name)}${x.unit ? ' (' + x.unit + ')' : ''} · ${x.section}`).join('\n');
    const answer = prompt(`Pick an existing ingredient by number, or type a new ingredient name.\n\n${options || 'No existing ingredients yet.'}\n\nType NEW ingredient name if it is not listed.`);
    if (!answer) return;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= S.masterIngredients.length) {
      const x = S.masterIngredients[n - 1];
      addPickedIngredient(x);
      return;
    }
    const name = clean(answer);
    if (!name) return;
    let existing = S.masterIngredients.find(x => keyOf(x.name) === keyOf(name));
    if (!existing) {
      existing = { name, unit: '', section: sectionFor(name) };
      S.masterIngredients.push(existing);
      S.masterIngredients.sort((a, b) => a.name.localeCompare(b.name));
    }
    addPickedIngredient(existing);
  };

  function addPickedIngredient(base) {
    const qty = prompt(`Quantity for ${cap(base.name)}? Leave blank if none.`, '') || '';
    const type = prompt('Type: required, staple or optional', 'required') || 'required';
    const x = {
      name: base.name,
      qty: clean(qty),
      unit: base.unit || '',
      type: ['required', 'staple', 'optional'].includes(type.toLowerCase()) ? type.toLowerCase() : 'required',
      section: base.section || sectionFor(base.name)
    };
    const m = meal(mealName);
    if (!m) return;
    const existingIx = (m.ingredients || []).findIndex(i => keyOf(i.name) === keyOf(x.name));
    if (existingIx >= 0 && !confirm(`${cap(x.name)} is already on this meal. Add it again anyway?`)) return;
    m.ingredients.push(x);
    S.finalItems = [];
    save();
    render();
    editMeal(mealName);
  }

  const oldSaveIng = window.saveIng;
  window.saveIng = function saveIngWithMaster() {
    const beforeName = clean($('inName').value);
    oldSaveIng();
    if (beforeName && typeof S !== 'undefined') {
      ensureMasterIngredients();
      const k = keyOf(beforeName);
      const x = S.masterIngredients.find(i => keyOf(i.name) === k);
      if (x) {
        x.unit = $('inUnit') ? $('inUnit').value : (x.unit || '');
        x.section = $('inSection') ? $('inSection').value : (x.section || sectionFor(x.name));
      }
      save();
    }
  };
})();