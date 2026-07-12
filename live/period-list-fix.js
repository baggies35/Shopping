(() => {
  const clone = value => JSON.parse(JSON.stringify(value ?? null));
  const normaliseText = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let changingPeriod = false;
  let lastStateRef = null;

  function currentPeriod() {
    if (typeof S === 'undefined' || !S || !Array.isArray(S.periods)) return null;
    return S.periods[typeof pi === 'number' ? pi : (S.currentPeriod || 0)] || null;
  }

  function periodKey(period = currentPeriod()) {
    if (!period) return 'unassigned';
    return [period.startDate || '', period.endDate || '', period.createdAt || ''].join('|');
  }

  function tagItems(items, key = periodKey()) {
    return (Array.isArray(items) ? items : []).map(item => ({
      ...item,
      shoppingPeriodKey: key
    }));
  }

  function ensurePeriodLists({ loadActive = false } = {}) {
    if (typeof S === 'undefined' || !S) return;
    S.periodLists = S.periodLists && typeof S.periodLists === 'object' && !Array.isArray(S.periodLists)
      ? S.periodLists
      : {};

    const key = periodKey();
    if (!Array.isArray(S.periodLists[key])) {
      // One-time migration: the legacy list belongs to whichever period was active.
      S.periodLists[key] = tagItems(Array.isArray(S.items) ? clone(S.items) : [], key);
    }

    if (loadActive) S.items = tagItems(clone(S.periodLists[key]), key);
  }

  function storeActiveList() {
    if (typeof S === 'undefined' || !S || changingPeriod) return;
    ensurePeriodLists();
    const key = periodKey();
    S.periodLists[key] = tagItems(clone(Array.isArray(S.items) ? S.items : []), key);
  }

  function loadActiveList() {
    ensurePeriodLists();
    const key = periodKey();
    S.items = tagItems(clone(S.periodLists[key] || []), key);
    S.currentPeriod = typeof pi === 'number' ? pi : (S.currentPeriod || 0);
  }

  function sourceText(item) {
    return Array.isArray(item?.source) ? item.source.join(', ') : String(item?.source || '');
  }

  function isManual(item) {
    return sourceText(item).trim().toLowerCase() === 'manual';
  }

  function itemKey(item) {
    return `${normaliseText(item?.name)}|${String(item?.unit || '').toLowerCase()}`;
  }

  function mergeGeneratedWithManual(generated, existing) {
    const output = tagItems(generated.map(item => ({
      ...item,
      status: item.status || 'needed',
      source: sourceText(item)
    })));
    const byKey = new Map(output.map((item, index) => [itemKey(item), index]));

    existing.filter(isManual).forEach(manual => {
      const key = itemKey(manual);
      if (!byKey.has(key)) {
        byKey.set(key, output.length);
        output.push({ ...manual, shoppingPeriodKey: periodKey() });
        return;
      }

      // A manually-added item that is now also generated must not disappear.
      const index = byKey.get(key);
      const generatedItem = output[index];
      output[index] = {
        ...generatedItem,
        qty: manual.qty || generatedItem.qty,
        unit: manual.unit || generatedItem.unit,
        section: manual.section || generatedItem.section,
        status: manual.status || generatedItem.status,
        source: [sourceText(generatedItem), 'Manual'].filter(Boolean).join(', '),
        shoppingPeriodKey: periodKey()
      };
    });

    return output;
  }

  const originalSave = window.save;
  if (typeof originalSave === 'function') {
    window.save = function periodAwareSave() {
      storeActiveList();
      return originalSave.apply(this, arguments);
    };
  }

  const originalMove = window.move;
  if (typeof originalMove === 'function') {
    window.move = function periodAwareMove() {
      storeActiveList();
      changingPeriod = true;
      let result;
      try {
        result = originalMove.apply(this, arguments);
        loadActiveList();
      } finally {
        changingPeriod = false;
      }
      if (typeof window.save === 'function') window.save();
      if (typeof window.render === 'function') window.render();
      return result;
    };
  }

  // Replace the destructive finalise action. Generated meal/weekly items are refreshed,
  // while manually-added items for this period are retained.
  window.createList = function periodAwareCreateList() {
    if (typeof ensureFinalItems === 'function') ensureFinalItems();
    ensurePeriodLists();

    const generated = [...(Array.isArray(S.finalItems) ? S.finalItems : [])];
    if (typeof combine === 'function') {
      combine('staple').forEach(staple => {
        if (S.includeStaples && S.includeStaples[stapleKey(staple)]) generated.push(staple);
      });
    }
    (Array.isArray(S.weekly) ? S.weekly : []).forEach(weekly => {
      if (!S.skipWeekly || !S.skipWeekly[weeklyKey(weekly)]) {
        generated.push({ ...weekly, source: ['Weekly'] });
      }
    });

    const existing = Array.isArray(S.items) ? clone(S.items) : [];
    S.items = mergeGeneratedWithManual(generated, existing);
    storeActiveList();
    if (typeof window.save === 'function') window.save();
    if (typeof window.go === 'function') window.go('shop');
  };

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function periodAwareRender() {
      // Supabase sync replaces the whole S object. Re-activate the correct period list
      // whenever that happens, including the first remote load.
      if (S !== lastStateRef) {
        lastStateRef = S;
        ensurePeriodLists({ loadActive: true });
      }
      return originalRender.apply(this, arguments);
    };
  }

  ensurePeriodLists({ loadActive: true });
  lastStateRef = S;
  window.PERIOD_SHOPPING = { periodKey, ensurePeriodLists, storeActiveList, loadActiveList };
})();
