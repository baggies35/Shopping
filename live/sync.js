(() => {
  const cfg = window.SHOPPING_SYNC || {};
  const statusEl = () => document.querySelector('.hero .hint');
  const setStatus = (text) => { const el = statusEl(); if (el) el.textContent = text; };

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

  const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const getSection = (name) => {
    try { return typeof sec === 'function' ? sec(name) : 'Cupboard'; }
    catch { return 'Cupboard'; }
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

  const fingerprint = (state) => {
    const periods = Array.isArray(state.periods) ? state.periods : [];
    const items = Array.isArray(state.items) ? state.items : [];
    const currentPeriod = Number(state.currentPeriod || 0);
    const current = periods[currentPeriod] || periods[0] || {};
    return JSON.stringify({
      periodsCount: periods.length,
      currentPeriod,
      currentLabel: current.label || '',
      currentStart: current.startDate || current.startISO || '',
      currentEnd: current.endDate || current.endISO || '',
      itemsCount: items.length,
      boughtCount: items.filter(x => x.status === 'bought').length,
      finalKey: state.finalKey || ''
    });
  };

  const remoteMatchesLocal = async () => {
    try {
      const remote = await rpc('public_get_live_app_state', { p_app_key: cfg.appKey });
      return fingerprint(remote || {}) === fingerprint(S || {});
    } catch {
      return false;
    }
  };

  let saving = false;
  let pendingSave = false;
  let saveTimer = null;
  let loadedRemote = false;

  const saveRemote = async () => {
    if (!loadedRemote || typeof S === 'undefined') return;
    if (saving) {
      pendingSave = true;
      return;
    }

    saving = true;
    pendingSave = false;
    try {
      await rpc('public_save_live_app_state', { p_app_key: cfg.appKey, p_state: S });
      setStatus(`Synced live · ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`);
    } catch (e) {
      const matches = await remoteMatchesLocal();
      if (matches) {
        setStatus(`Synced live · ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`);
      } else {
        setStatus('Sync save failed. Still saved on this phone.');
      }
      console.warn(e);
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

  const loadRemote = async () => {
    setStatus('Loading shared live list...');
    try {
      const remote = await rpc('public_get_live_app_state', { p_app_key: cfg.appKey });
      if (remote && Object.keys(remote).length) {
        S = normalise(remote);
        pi = Math.min(S.currentPeriod || 0, S.periods.length - 1);
        localStorage.setItem('shopping-live', JSON.stringify(S));
        if (typeof render === 'function') render();
        setStatus(`Loaded shared live list · ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`);
      } else {
        setStatus('No shared list yet. This phone will create it.');
        await rpc('public_save_live_app_state', { p_app_key: cfg.appKey, p_state: S });
      }
      loadedRemote = true;
    } catch (e) {
      loadedRemote = true;
      setStatus('Sync load failed. Using this phone only.');
      console.warn(e);
    }
  };

  window.refreshSharedList = loadRemote;
  loadRemote();
})();
