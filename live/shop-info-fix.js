(() => {
  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function title(v){ return String(v || '').replace(/\b\w/g, c => c.toUpperCase()); }

  function itemNameFromText(text){
    text = clean(text);
    return text
      .replace(/^\d+(\.\d+)?\s*(g|kg|ml|l|pack|packs|tin|tins|tub|tubs|each|tbsp|tsp|cloves|loaf|pints)?\s+/i, '')
      .trim();
  }

  function mealNameForDay(day){
    try {
      if (!day) return '';
      if (day.meal) return day.meal;
      if (day.mealId && Array.isArray(S?.meals)) {
        const m = S.meals.find(x => x.id === day.mealId);
        return m ? m.name : '';
      }
    } catch(e) {}
    return '';
  }

  function mealsForIngredient(item){
    const names = [];
    const itemName = clean(item && item.name);
    if (!itemName) return names;
    const itemKey = lower(itemName);

    if (item && item.source && item.source !== 'Manual' && item.source !== 'Weekly') {
      String(item.source).split(',').map(clean).filter(Boolean).forEach(x => names.push(x));
    }

    try {
      if (typeof p === 'function' && Array.isArray(S?.meals)) {
        const period = p();
        (period.days || []).forEach(day => {
          if (day.status !== 'agreed') return;
          const mealName = mealNameForDay(day);
          const mealObj = S.meals.find(m => lower(m.name) === lower(mealName) || m.id === day.mealId);
          if (!mealObj) return;
          const hasIngredient = (mealObj.ingredients || []).some(ing => lower(ing.name) === itemKey);
          if (hasIngredient && mealName && !names.some(x => lower(x) === lower(mealName))) names.push(mealName);
        });
      }
    } catch(e) {}

    return names;
  }

  function showShoppingItemInfo(index){
    try {
      const item = S.items && S.items[index];
      if (!item) return;
      const meals = mealsForIngredient(item);
      const itemTitle = [item.qty, item.unit, title(item.name)].filter(Boolean).join(' ');
      if (meals.length) alert(itemTitle + '\n\nFor meal(s):\n' + meals.map(x => '• ' + x).join('\n'));
      else alert(itemTitle + '\n\nNo meal source recorded. This is probably a manual or weekly item.');
    } catch(e) {
      alert('Could not show item info: ' + (e && e.message ? e.message : e));
    }
  }

  function addTapHandlers(){
    try {
      const rows = [...document.querySelectorAll('#list .item')];
      rows.forEach(row => {
        if (row.dataset.mealInfoHooked === '1') return;
        row.dataset.mealInfoHooked = '1';
        row.style.cursor = 'pointer';
        row.addEventListener('click', function(ev){
          if (ev && ev.target && ev.target.closest && ev.target.closest('.check')) return;
          const text = clean(row.textContent).replace('✓','');
          const nameGuess = itemNameFromText(text);
          let idx = -1;
          if (Array.isArray(S?.items)) {
            idx = S.items.findIndex(i => lower(i.name) === lower(nameGuess));
            if (idx < 0) idx = S.items.findIndex(i => lower(text).includes(lower(i.name)));
          }
          if (idx >= 0) showShoppingItemInfo(idx);
        });
      });
    } catch(e) { console.warn('shop item info hook failed', e); }
  }

  const previousShowItemInfo = window.showItemInfo;
  window.showItemInfo = function showItemInfoWithMeals(index){
    if (Array.isArray(S?.items) && S.items[index]) return showShoppingItemInfo(index);
    if (typeof previousShowItemInfo === 'function') return previousShowItemInfo(index);
  };

  const originalRenderShop = window.renderShop;
  if (typeof originalRenderShop === 'function') {
    window.renderShop = function renderShopWithMealInfo(){
      const result = originalRenderShop();
      setTimeout(addTapHandlers, 20);
      return result;
    };
  }

  const originalGo = window.go;
  if (typeof originalGo === 'function') {
    window.go = function goWithShopItemInfo(screenName){
      const result = originalGo(screenName);
      if (screenName === 'shop') setTimeout(addTapHandlers, 50);
      return result;
    };
  }

  setTimeout(addTapHandlers, 300);
})();
