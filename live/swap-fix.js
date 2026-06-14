(() => {
  function lower(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function currentPeriod(){
    try { return typeof p === 'function' ? p() : (S.periods && S.periods[pi]); }
    catch { return null; }
  }

  function mealForDay(day){
    try {
      if (day.meal) return typeof meal === 'function' ? meal(day.meal) : (S.meals || []).find(m => lower(m.name) === lower(day.meal));
      if (day.mealId) return (S.meals || []).find(m => m.id === day.mealId);
    } catch(e) {}
    return null;
  }

  function addSwapButtons(){
    try {
      const plan = document.getElementById('planDays');
      if (!plan) return;
      const cards = [...plan.querySelectorAll('.card')];
      const per = currentPeriod();
      if (!per || !Array.isArray(per.days)) return;
      cards.forEach((card, index) => {
        const day = per.days[index];
        if (!day || !mealForDay(day)) return;
        if (card.querySelector('.swapMealBtn')) return;
        const btn = document.createElement('button');
        btn.className = 'btn small alt swapMealBtn';
        btn.textContent = 'Swap';
        btn.style.marginLeft = '6px';
        btn.onclick = function(ev){
          ev.preventDefault();
          if (typeof openDay === 'function') openDay(index);
          return false;
        };
        const buttonArea = card.querySelector('.between > div:last-child') || card;
        buttonArea.appendChild(btn);
      });
    } catch(e) { console.warn('swap meal patch failed', e); }
  }

  const originalRenderPlan = window.renderPlan;
  if (typeof originalRenderPlan === 'function') {
    window.renderPlan = function renderPlanWithSwap(){
      const result = originalRenderPlan();
      setTimeout(addSwapButtons, 20);
      return result;
    };
  }

  const originalGo = window.go;
  if (typeof originalGo === 'function') {
    window.go = function goWithSwap(screenName){
      const result = originalGo(screenName);
      if (screenName === 'plan') setTimeout(addSwapButtons, 50);
      return result;
    };
  }

  setTimeout(addSwapButtons, 300);
})();
