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
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${name} failed ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };

  const getSection = (name) => {
    try { return typeof sec === 'function' ? sec(name) : 'Cupboard'; }
    catch { return 'Cupboard'; }
  };

  // A shopping week is identified by its displayed date range. createdAt is not
  // part of its identity: two phones can create the same week milliseconds apart.
  const periodKey = (p) => {
    const start = p?.startDate || '';
    const end = p?.endDate || '';
    return (start || end) ? `${start}|${end}` : `created|${p?.createdAt || ''}`;
  };

  const mergeMissingPeriodData = (primary, duplicate) => {
    const out = { ...duplicate, ...primary };
    const a = Array.isArray(primary?.days) ? primary.days : [];
    const b = Array.isArray(duplicate?.days) ? duplicate.days : [];
    out.days = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
      const preferred = a[i] || {};
      const fallback = b[i] || {};
      const day = { ...fallback, ...preferred };
      Object.keys(fallback).forEach(key => {
        if (day[key] == null || day[key] === '') day[key] = fallback[key];
      });
      return day;
    });
    return out;
  };

  const dedupePeriods = (periods = [], selectedIndex = 0) => {
    const selected = periods[selectedIndex];
    const selectedKey = periodKey(selected);
    const groups = new Map();
    periods.filter(Boolean).forEach(p => {
      const key = periodKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    const result = [...groups.entries()].map(([key, copies]) => {
      const preferred = key === selectedKey && selected ? selected : copies[0];
      return copies.filter(p => p !== preferred).reduce(mergeMissingPeriodData, preferred);
    }).sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return { periods: result, currentPeriod: Math.max(0, result.findIndex(p => periodKey(p) === selectedKey)) };
  };

  const mergePeriods = (localPeriods = [], remotePeriods = []) => {
    const merged = [];
    const seen = new Set();
    [...localPeriods, ...remotePeriods]
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
    const deduped = dedupePeriods(state.periods, Number(state.currentPeriod || 0));
    state.periods = deduped.periods;
    state.currentPeriod = deduped.currentPeriod;
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
  let localDirty = false;

  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((out, key) => {
        out[key] = canonical(value[key]);
        return out;
      }, {});
    }
    return value;
  };

  const sameState = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

  const adoptRemote = (remote) => {
    const viewedPeriod = (typeof pi === 'number' && S?.periods?.[pi]) ? periodKey(S.periods[pi]) : '';
    S = normalise(remote);
    const viewedIndex = viewedPeriod ? S.periods.findIndex(p => periodKey(p) === viewedPeriod) : -1;
    pi = viewedIndex >= 0 ? viewedIndex : Math.min(S.currentPeriod || 0, S.periods.length - 1);
    S.currentPeriod = Math.max(pi, 0);
    window.S = S;
    localStorage.setItem('shopping-live', JSON.stringify(S));
    if (typeof render === 'function') render();
  };

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
      const confirmed = await rpc('public_get_live_app_state', { p_app_key: cfg.appKey });
      if (!sameState(confirmed, S)) throw new Error('Saved state could not be verified');
      localStorage.setItem('shopping-live', JSON.stringify(S));
      localDirty = false;
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
    localDirty = true;
    queueSave();
  };

  const loadRemote = async ({ mergeOnly = false } = {}) => {
    if (!mergeOnly) setStatus('Loading shared live list...');
    try {
      const remote = await rpc('public_get_live_app_state', { p_app_key: cfg.appKey });
      if (remote && Object.keys(remote).length) {
        if (mergeOnly && typeof S !== 'undefined') {
          // Never overwrite a local edit that is still being saved. Otherwise the
          // database is authoritative: changes inside an existing week must be
          // applied too, not just newly-created weeks.
          if (localDirty || saving) return false;
          adoptRemote(remote);
          setStatus(syncText());
        } else {
          adoptRemote(remote);
          localDirty = false;
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
