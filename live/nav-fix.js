(() => {
  const originalGo = window.go;

  window.go = function safeGo(screenName){
    try {
      document.querySelectorAll('.screen').forEach(x => x.classList.remove('on'));
      const screen = document.getElementById(screenName);
      if (screen) screen.classList.add('on');

      document.querySelectorAll('.nav button').forEach(x => x.classList.remove('on'));
      const navButton = document.getElementById('n-' + screenName);
      if (navButton) navButton.classList.add('on');

      if (screenName === 'finalise' && typeof ensureFinalItems === 'function') ensureFinalItems();
      if (typeof render === 'function') render();
      try { window.scrollTo(0, 0); } catch(e) {}
    } catch(e) {
      if (typeof originalGo === 'function') return originalGo(screenName);
      alert('Could not open page: ' + (e && e.message ? e.message : e));
    }
  };
})();
