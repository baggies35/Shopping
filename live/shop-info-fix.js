(() => {
  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function title(v){ return String(v || '').replace(/\b\w/g, c => c.toUpperCase()); }

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
      String(item.source).split(',').map(clean).filter(Boolean).forEach(x => {
        if (!names.some(n => lower(n) === lower(x))) names.push(x);
      });
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

  const previousShowItemInfo = window.showItemInfo;
  window.showItemInfo = function showItemInfoWithMeals(index){
    if (Array.isArray(S?.items) && S.items[index]) return showShoppingItemInfo(index);
    if (typeof previousShowItemInfo === 'function') return previousShowItemInfo(index);
  };
})();
