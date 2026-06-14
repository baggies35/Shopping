(() => {
  const FROM = 'chicken';
  const TO = 'chicken loose';

  function clean(v){ return String(v || '').trim(); }
  function lower(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function sameName(v, target){ return lower(v) === lower(target); }
  function numeric(v){ const n = Number(String(v || '').trim()); return Number.isFinite(n) ? n : null; }

  function mergeRows(rows){
    const out = [];
    (rows || []).forEach(row => {
      if (!row || !row.name) return;
      if (sameName(row.name, FROM)) row.name = TO;
      const key = [lower(row.name), clean(row.unit).toLowerCase(), clean(row.section).toLowerCase(), clean(row.status || 'needed').toLowerCase()].join('|');
      const existing = out.find(x => [lower(x.name), clean(x.unit).toLowerCase(), clean(x.section).toLowerCase(), clean(x.status || 'needed').toLowerCase()].join('|') === key);
      if (!existing) {
        out.push(row);
        return;
      }
      const a = numeric(existing.qty);
      const b = numeric(row.qty);
      if (a !== null && b !== null) existing.qty = String(a + b);
      if (row.source && !String(existing.source || '').includes(row.source)) existing.source = [existing.source, row.source].filter(Boolean).join(', ');
    });
    return out;
  }

  function mergeChicken(){
    try {
      if (!window.S) return false;
      let changed = false;

      if (Array.isArray(S.meals)) {
        S.meals.forEach(meal => (meal.ingredients || []).forEach(ing => {
          if (sameName(ing.name, FROM)) { ing.name = TO; changed = true; }
        }));
      }

      if (Array.isArray(S.masterIngredients)) {
        S.masterIngredients.forEach(ing => {
          if (sameName(ing.name, FROM)) { ing.name = TO; changed = true; }
        });
        const seen = new Set();
        S.masterIngredients = S.masterIngredients.filter(ing => {
          const k = lower(ing.name);
          if (k !== lower(TO)) return true;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }

      ['items','finalItems','weekly'].forEach(listName => {
        if (!Array.isArray(S[listName])) return;
        const before = JSON.stringify(S[listName]);
        S[listName] = mergeRows(S[listName]);
        if (JSON.stringify(S[listName]) !== before) changed = true;
      });

      if (changed) {
        if (typeof ensureMasterIngredients === 'function') ensureMasterIngredients(false);
        if (typeof save === 'function') save();
        if (typeof render === 'function') render();
      }
      return changed;
    } catch(e) {
      alert('Could not merge Chicken ingredients: ' + (e && e.message ? e.message : e));
      return false;
    }
  }

  window.mergeChickenDuplicate = mergeChicken;
  setTimeout(mergeChicken, 400);
})();
