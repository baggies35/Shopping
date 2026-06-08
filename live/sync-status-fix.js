(() => {
  const cfg = window.SHOPPING_SYNC || {};
  if (!cfg.url || !cfg.anonKey || !cfg.appKey) return;

  const statusEl = () => document.querySelector('.hero .hint');
  const currentLocal = () => {
    const periods = Array.isArray(S.periods) ? S.periods : [];
    const idx = Number(S.currentPeriod ?? pi ?? 0);
    const cur = periods[idx] || periods[0] || {};
    return {
      periods: periods.length,
      currentPeriod: idx,
      label: cur.label || '',
      start: cur.startDate || cur.startISO || '',
      end: cur.endDate || cur.endISO || ''
    };
  };
  const currentRemote = (R) => {
    const periods = Array.isArray(R.periods) ? R.periods : [];
    const idx = Number(R.currentPeriod ?? 0);
    const cur = periods[idx] || periods[0] || {};
    return {
      periods: periods.length,
      currentPeriod: idx,
      label: cur.label || '',
      start: cur.startDate || cur.startISO || '',
      end: cur.endDate || cur.endISO || ''
    };
  };
  const same = (a, b) => a.periods === b.periods && a.currentPeriod === b.currentPeriod && a.label === b.label && a.start === b.start && a.end === b.end;

  async function rpc(name, payload) {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: cfg.anonKey, authorization: `Bearer ${cfg.anonKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function correctStatus() {
    const el = statusEl();
    if (!el || !/failed/i.test(el.textContent || '')) return;
    try {
      const remote = await rpc('public_get_live_app_state', { p_app_key: cfg.appKey });
      if (same(currentLocal(), currentRemote(remote || {}))) {
        el.textContent = `Synced live · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    } catch (e) {
      console.warn('sync status check failed', e);
    }
  }

  setInterval(correctStatus, 3000);
  setTimeout(correctStatus, 800);
})();
