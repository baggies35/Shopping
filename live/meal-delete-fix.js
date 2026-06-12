(() => {
  const clean = (v) => String(v || '').trim();
  const mealKey = (name) => norm(name || '');

  function mergeDuplicateMeals() {
    if (!Array.isArray(S.meals)) S.meals = [];
    const byKey = {};
    const merged = [];

    S.meals.forEach(m => {
      const k = mealKey(m.name);
      if (!k) return;
      if (!byKey[k]) {
        byKey[k] = {
          ...m,
          name: clean(m.name),
          ingredients: Array.isArray(m.ingredients) ? m.ingredients : []
        };
        merged.push(byKey[k]);
        return;
      }

      const target = byKey[k];
      const sourceIngredients = Array.isArray(m.ingredients) ? m.ingredients : [];
      sourceIngredients.forEach(x => {
        const ik = norm(x.name || '') + '|' + (x.unit || '') + '|' + (x.type || 'required');
        const exists = (target.ingredients || []).some(y => norm(y.name || '') + '|' + (y.unit || '') + '|' + (y.type || 'required') === ik);
        if (!exists) target.ingredients.push(x);
      });
    });

    S.meals = merged;
  }

  window.deleteMeal = function deleteMeal(name) {
    const k = mealKey(name);
    const m = (S.meals || []).find(x => mealKey(x.name) === k);
    if (!m) return;
    const usedDays = [];
    (S.periods || []).forEach(pp => (pp.days || []).forEach(d => {
      if (mealKey(d.meal) === k) usedDays.push(`${pp.label || 'Shop'} ${d.day}`);
    }));

    const msg = usedDays.length
      ? `Delete ${m.name}?\n\nIt is currently used on:\n${usedDays.join('\n')}\n\nThose days will be cleared.`
      : `Delete ${m.name}?`;
    if (!confirm(msg)) return;

    S.meals = (S.meals || []).filter(x => mealKey(x.name) !== k);
    (S.periods || []).forEach(pp => (pp.days || []).forEach(d => {
      if (mealKey(d.meal) === k) {
        d.meal = null;
        d.status = null;
        d.suggestedBy = null;
        d.respondedBy = null;
      }
    }));
    S.finalItems = [];
    save();
    render();
  };

  const oldAddMeal = window.addMeal;
  window.addMeal = function addMealNoDuplicates() {
    const n = prompt('Meal name');
    if (!n) return;
    const name = clean(n);
    const existing = (S.meals || []).find(m => mealKey(m.name) === mealKey(name));
    if (existing) {
      alert(`${existing.name} already exists. Opening it instead.`);
      render();
      editMeal(existing.name);
      return;
    }
    S.meals.push({ name, ingredients: [] });
    save();
    render();
    editMeal(name);
  };

  const oldRenderSetup = window.renderSetup;
  window.renderSetup = function renderSetupWithDelete() {
    mergeDuplicateMeals();
    if (setupMode === 'weekly') { renderWeeklySetup(); return; }
    if (setupMode === 'ingredients') { renderIngredientsSetup(); return; }
    $('setupBody').innerHTML = `<div class="card"><div class="between"><b>Meals</b><button class="btn small" onclick="addMeal()">Add meal</button></div>${S.meals.map(m=>`<div class="item"><div><b>${m.name}</b><div class="muted">${(m.ingredients || []).length} ingredients</div></div><div><button class="btn small alt" onclick="editMeal('${String(m.name).replaceAll("'","\\'")}')">Edit</button> <button class="btn small red" onclick="deleteMeal('${String(m.name).replaceAll("'","\\'")}')">Delete</button></div></div>`).join('') || '<p class="muted">No meals yet.</p>'}</div>`;
    save();
  };

  const oldRender = window.render;
  window.render = function renderWithMealDelete() {
    mergeDuplicateMeals();
    oldRender();
  };

  setTimeout(() => {
    if (typeof S !== 'undefined') {
      mergeDuplicateMeals();
      save();
      render();
    }
  }, 800);
})();