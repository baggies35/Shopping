(() => {
  function addShopSwapShortcut(){
    try {
      const shop = document.getElementById('shop');
      if (!shop) return;
      if (document.getElementById('shopSwapMealsBtn')) return;

      const summary = document.getElementById('shopSummary');
      const anchor = summary || shop.querySelector('.title');
      if (!anchor) return;

      const wrap = document.createElement('div');
      wrap.id = 'shopSwapMealsBtn';
      wrap.className = 'card';
      wrap.style.marginTop = '10px';
      wrap.innerHTML = '<div class="between"><div><b>Need to change a meal?</b><div class="muted">Swap meals, then recreate the list.</div></div><button class="btn small" type="button">Swap meals</button></div>';
      wrap.querySelector('button').onclick = function(){
        if (typeof go === 'function') go('plan');
      };

      const parent = anchor.parentNode;
      parent.insertBefore(wrap, anchor.nextSibling);
    } catch(e) { console.warn('shop swap shortcut failed', e); }
  }

  const originalRenderShop = window.renderShop;
  if (typeof originalRenderShop === 'function') {
    window.renderShop = function renderShopWithSwapShortcut(){
      const result = originalRenderShop();
      setTimeout(addShopSwapShortcut, 20);
      return result;
    };
  }

  const originalGo = window.go;
  if (typeof originalGo === 'function') {
    window.go = function goWithShopSwapShortcut(screenName){
      const result = originalGo(screenName);
      if (screenName === 'shop') setTimeout(addShopSwapShortcut, 50);
      return result;
    };
  }

  setTimeout(addShopSwapShortcut, 300);
})();
