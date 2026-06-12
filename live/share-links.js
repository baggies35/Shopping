(() => {
  function appBaseUrl() {
    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '/');
    return origin + path;
  }

  function profileUrl(name) {
    return appBaseUrl() + '#' + String(name || '').toLowerCase();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        alert('Link copied');
        return;
      }
    } catch (e) {}
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      alert('Link copied');
    } catch (e) {
      prompt('Copy this link', text);
    }
    document.body.removeChild(ta);
  }

  window.copyProfileLink = function copyProfileLink(name) {
    copyText(profileUrl(name));
  };

  function addShareCard() {
    const setup = document.getElementById('setup');
    if (!setup || document.getElementById('shareLinksCard')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'shareLinksCard';
    card.innerHTML = `
      <b>Share / copy links</b>
      <p class="muted">Permanent links stay the same. The app handles updates internally.</p>
      <div class="row" style="margin-top:8px;flex-wrap:wrap">
        <button class="btn small" onclick="copyProfileLink('Jason')">Copy Jason link</button>
        <button class="btn small" onclick="copyProfileLink('Rach')">Copy Rach link</button>
      </div>
      <div class="hint">Jason: ${profileUrl('Jason')}</div>
      <div class="hint">Rach: ${profileUrl('Rach')}</div>
    `;
    const tabs = setup.querySelector('.tabs');
    if (tabs && tabs.parentNode) tabs.parentNode.insertBefore(card, tabs);
    else setup.appendChild(card);
  }

  const oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function renderWithShareLinks() {
      oldRender();
      setTimeout(addShareCard, 0);
    };
  }

  setTimeout(addShareCard, 300);
})();