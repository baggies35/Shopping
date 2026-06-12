(() => {
  const APP_BUILD = '2026-06-12-1608';
  window.SHOPPING_APP_BUILD = APP_BUILD;

  async function registerNoCacheWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      await registration.update();
      if (!navigator.serviceWorker.controller) {
        // The first visit installs the worker. The next refresh is then controlled by it.
        console.log('Shopping app update worker installed');
      }
    } catch (e) {
      console.warn('Shopping app update worker failed', e);
    }
  }

  function showBuild() {
    const hero = document.querySelector('.hero');
    if (!hero || document.getElementById('appBuildBadge')) return;
    const badge = document.createElement('div');
    badge.id = 'appBuildBadge';
    badge.className = 'hint';
    badge.style.color = '#e6fff7';
    badge.textContent = 'App build ' + APP_BUILD;
    hero.appendChild(badge);
  }

  registerNoCacheWorker();
  setTimeout(showBuild, 300);

  const oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function renderWithBuildBadge() {
      oldRender();
      setTimeout(showBuild, 0);
    };
  }
})();