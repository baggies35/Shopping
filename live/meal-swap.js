(() => {
  const itemKey = (x) => `${norm(x.name || '')}|${x.unit || ''}`;
  const toSourceText = (source) => Array.isArray(source) ? source.join(', ') : String(source || '');

  const mealNamesForItem = (item) => {
    const src = toSourceText(item.source);
    return (S.meals || []).map(m => m.name).filter(name => src.toLowerCase().includes(String(name).toLowerCase()));
  };

  const chooseByNumber = (title, options) => {
    if (!options.length) return null;
    const text = title + '\n\n' + options.map((x, i) => `${i + 1}. ${x}`).join('\n');
    const answer = prompt(text, '1');
    if (!answer) return null;
    const ix = Number(answer) - 1;
    if (!Number.isInteger(ix) || ix < 0 || ix >= options.length) {
      alert('Please enter one of the numbers shown.');
      return null;
    }
    return options[ix];
  };

  const rebuildListPreservingBought = () => {
    const bought = new Set((S.items || []).filter(i => i.status === 'bought').map(itemKey));
    S.finalItems = [];
    if (typeof ensureFinalItems === 'function') ensureFinalItems();
    let items = Array.isArray(S.finalItems) ? [...S.finalItems] : [];

    if (typeof combine === 'function') {
      combine('staple').forEach(s => {
        const k = norm(s.name) + '|' + (s.unit || '');
        if (S.includeStaples && S.includeStaples[k]) items.push(s);
      });
    }

    (S.weekly || []).forEach(w => {
      const k = norm(w.name) + '|' + (w.unit || '');
      if (!S.skipWeekly || !S.skipWeekly[k]) items.push({ ...w, section: w.section || sec(w.name), source: ['Weekly'] });
    });

    S.items = items.map(x => ({
      ...x,
      status: bought.has(itemKey(x)) ? 'bought' : 'needed',
      source: Array.isArray(x.source) ? x.source.join(', ') : x.source
    }));
  };

  window.swapMealFromShoppingItem = function swapMealFromShoppingItem(ix) {
    const item = S.items && S.items[ix];
    if (!item) return;

    const linkedMeals = mealNamesForItem(item);
    if (!linkedMeals.length) {
      alert('This item is not linked to a meal.');
      return;
    }

    const oldMeal = linkedMeals.length === 1 ? linkedMeals[0] : chooseByNumber('Which meal do you want to change?', linkedMeals);
    if (!oldMeal) return;

    const replacements = (S.meals || []).map(m => m.name).filter(name => name !== oldMeal);
    const newMeal = chooseByNumber(`Replace ${oldMeal} with which meal?`, replacements);
    if (!newMeal) return;

    let changed = false;
    (p().days || []).forEach(d => {
      if (d.meal === oldMeal) {
        d.meal = newMeal;
        d.status = 'agreed';
        d.respondedBy = (typeof me === 'function') ? me() : S.user;
        changed = true;
      }
    });

    if (!changed) {
      alert('Could not find that meal in the current plan.');
      return;
    }

    rebuildListPreservingBought();
    save();
    render();
    setTimeout(decorateMealSwapButtons, 50);
    alert(`${oldMeal} changed to ${newMeal}. Shopping list updated.`);
  };

  const originalShowItemInfo = showItemInfo;
  window.showItemInfo = function showItemInfoWithSwap(ix) {
    const item = S.items && S.items[ix];
    if (!item) return originalShowItemInfo(ix);
    const source = toSourceText(item.source) || 'No meal/source recorded';
    const linkedMeals = mealNamesForItem(item);
    if (!linkedMeals.length) {
      alert(`${cap(item.name)}\n\nFor: ${source}`);
      return;
    }
    const doSwap = confirm(`${cap(item.name)}\n\nFor: ${source}\n\nDo you want to change one of these meals?`);
    if (doSwap) swapMealFromShoppingItem(ix);
  };

  function indexFromRow(row, fallback) {
    const html = row.innerHTML || '';
    const m = html.match(/(?:showItemInfo|editShop|toggleBought|toggleItem)\((\d+)\)/);
    return m ? Number(m[1]) : fallback;
  }

  function decorateMealSwapButtons() {
    const list = document.getElementById('list');
    if (!list || !Array.isArray(S.items)) return;
    const rows = [...list.querySelectorAll('.item')];
    let fallback = 0;
    rows.forEach(row => {
      if (row.querySelector('.meal-swap-btn')) return;
      const ix = indexFromRow(row, fallback++);
      const item = S.items[ix];
      if (!item || !mealNamesForItem(item).length) return;
      const btn = document.createElement('button');
      btn.className = 'btn small alt meal-swap-btn';
      btn.textContent = 'Change meal';
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        swapMealFromShoppingItem(ix);
      };
      row.appendChild(btn);
    });
  }

  const originalRender = render;
  window.render = function renderWithMealSwapButtons() {
    originalRender();
    setTimeout(decorateMealSwapButtons, 50);
  };

  setInterval(decorateMealSwapButtons, 1500);
  setTimeout(decorateMealSwapButtons, 500);
})();
