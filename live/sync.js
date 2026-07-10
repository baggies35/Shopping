(() => {
  const cfg = window.SHOPPING_SYNC || {};
  const statusEl = () => document.querySelector('.hero .hint');
  const setStatus = (text) => { const el = statusEl(); if (el) el.textContent = text; };
  const syncText = () => `Synced live · ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;

  if (!cfg.url || !cfg.anonKey || !cfg.appKey) {
    setStatus('Saved on this phone. Sync not configured yet.');
    return;
  }

  const rpc = async (name, payload) => {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        authorization: `Bearer ${cfg.anonKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`${name} failed ${res.status}`);
    return res.json();
  };

  const getSection = (name) => {
    try { return typeof sec === 'function' ? sec(name) : 'Cupboard'; }
    catch { return 'Cupboard'; }
  };

  const periodKey = (p) => [p?.startDate || '', p?.endDate || '', p?.createdAt || ''].join('|');

  const mergePeriods = (localPeriods = [], remotePeriods = []) => {
    const merged = [];
    const seen = new Set();
    [...remotePeriods, ...localPeriods]
      .filter(Boolean)
      .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')) || Number(a.createdAt || 0) - Number(b.createdAt || 0))
      .forEach(p => {
        const key = periodKey(p);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(p);
        }
      });
    return merged;
  };

  const normalise = (state) => {
    const currentUser = (typeof me === 'function') ? me() : (state.user || 'Jason');
    state.user = currentUser;
    state.periods = Array.isArray(state.periods) && state.periods.length ? state.periods : S.periods;
    state.meals = Array.isArray(state.meals) && state.meals.length ? state.meals : S.meals;
    state.items = Array.isArray(state.items) ? state.items : [];
    state.weekly = Array.isArray(state.weekly) ? state.weekly : [];
    state.includeStaples = state.includeStaples || {};
    state.skipWeekly = state.skipWeekly || {};
    state.finalItems = Array.isArray(state.finalItems) ? state.finalItems : [];
    state.finalKey = state.finalKey || '';
    state.masterIngredients = Array.isArray(state.masterIngredients) ? state.masterIngredients : [];

    state.meals.forEach(m => {
      m.ingredients = Array.isArray(m.ingredients) ? m.ingredients : [];
      m.ingredients = m.ingredients.map(x => ({
        name: x.name || '',
        qty: x.qty || '',
        unit: x.unit || '',
        type: x.type || 'required',
        section: x.section || getSection(x.name)
      }));
    });

    state.weekly = state.weekly.map(w => ({
      ...w,
      qty: w.qty || '',
      unit: w.unit || '',
      section: w.section || getSection(w.name),
      source: 'Weekly'
    }));

    state.items = state.items.map(i => ({
      ...i,
      qty: i.qty || '',
      unit: i.unit || '',
      section: i.section || getSection(i.name),
      status: i.status || 'needed'
    }));

    return state;
  };

  let saving = false;
  let pendingSave = false;
  let saveTimer = null;
  let loadedRemote = false;

  const saveRemote = async () => {
    if (!loadedRemote || typeof S === 'undefined') return false;
    if (saving) {
      pendingSave = true;
      return false;
    }

    saving = true;
    pendingSave = false;
    try {
      const remote = await rpc('public_get_live_app_state', { p_app_key: cfg.appKey });
      if (remote && Array.isArray(remote.periods)) {
        S.periods = mergePeriods(S.periods, remote.periods);
        if (typeof pi === 'number') {
          pi = Math.min(Math.max(pi, 0), S.periods.length - 1);
          S.currentPeriod = pi;
        }
      }
      await rpc('public_save_live_app_state', { p_app_key: cfg.appKey, p_state: S });
      localStorage.setItem('shopping-live', JSON.stringify(S));
      setStatus(syncText());
      return true;
    } catch (e) {
      console.warn(e);
      setStatus('Sync save failed. Still saved on this phone.');
      return false;
    } finally {
      saving = false;
      if (pendingSave) {
        pendingSave = false;
        queueSave();
      }
    }
  };

  const queueSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveRemote, 500);
  };

  const localSave = save;
  save = function syncedSave() {
    localSave();
    queueSave();
  };

  const loadRemote = async ({ mergeOnly = false } = {}) => {
    if (!mergeOnly) setStatus('Loading shared live list...');
    try {
      const remote = await rpc('public_get_live_app_state', { p_app_key: cfg.appKey });
      if (remote && Object.keys(remote).length) {
        if (mergeOnly && typeof S !== 'undefined') {
          const before = Array.isArray(S.periods) ? S.periods.length : 0;
          S.periods = mergePeriods(S.periods, remote.periods || []);
          if (S.periods.length !== before) {
            localStorage.setItem('shopping-live', JSON.stringify(S));
            if (typeof render === 'function') render();
          }
        } else {
          S = normalise(remote);
          pi = Math.min(S.currentPeriod || 0, S.periods.length - 1);
          localStorage.setItem('shopping-live', JSON.stringify(S));
          if (typeof render === 'function') render();
          setStatus(`Loaded shared live list · ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`);
        }
      } else if (!mergeOnly) {
        setStatus('No shared list yet. This phone will create it.');
        await rpc('public_save_live_app_state', { p_app_key: cfg.appKey, p_state: S });
        setStatus(syncText());
      }
      loadedRemote = true;
      return true;
    } catch (e) {
      loadedRemote = true;
      if (!mergeOnly) setStatus('Sync load failed. Using this phone only.');
      console.warn(e);
      return false;
    }
  };

  window.refreshSharedList = () => loadRemote();
  window.saveSharedNow = saveRemote;

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadRemote({ mergeOnly: true });
  });
  window.addEventListener('focus', () => loadRemote({ mergeOnly: true }));
  setInterval(() => {
    if (!document.hidden && !saving) loadRemote({ mergeOnly: true });
  }, 15000);

  loadRemote();
})();