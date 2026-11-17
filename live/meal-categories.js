(function(){
  'use strict';
  const categories=['All meals','Pasta','Chicken & Rice','Mexican & Takeaway','Comfort Food','Quick & Easy','Roasts','Fish & Seafood'];
  const assigned={
    'Pasta':['Spag bol','Prawn pasta','pasta bake','lasagne','Spaghetti Carbonara','Creamy Chicken & Bacon Pasta','Macaroni Cheese with Bacon','Chicken Fajita Pasta','BBQ Chicken Pasta Bake','Cheeseburger Pasta','Chicken & Spinach Pasta','Bacon & Mushroom Tagliatelle'],
    'Chicken & Rice':['chicken curry','honey garlic chicken','Chicken Egg Fried Rice','Chicken Noodle Stir-Fry','Sweet Chilli Chicken Noodles','Sticky Teriyaki Chicken & Rice','BBQ Chicken Rice Bowls','Lemon Garlic Chicken & Potatoes'],
    'Mexican & Takeaway':['Chicken fajitas','chicken kebab','Mild Chicken Enchiladas','Beef Taco Rice Bowls','Chicken Burrito Bowls','BBQ Chicken Quesadillas','Chicken Shawarma & Flatbreads','chilli','lamb bhuna'],
    'Comfort Food':['bangers & mash','Ultimate Rich Beef Stew & Suet Dumplings','Toad in the Hole, Mash, Carrots, Peas & Gravy','Sausage, Mash & Beans','Giant Sausage Rolls, Chips & Peas','burgers','hot dogs'],
    'Quick & Easy':['Jacket potatoes','Chicken nuggets','Pizza','beans on toast','fry up','homemade pizza','Ham, Egg & Chips','Chicken & Stuffing Baguettes'],
    'Roasts':['Chicken Roast dinner','Chicken & Stuffing Yorkshire Pudding Wraps'],
    'Fish & Seafood':['tuna steak','fish fingers','chicken ceasar salad']
  };
  // Chicken Caesar salad belongs in Quick & Easy, not Fish.
  assigned['Fish & Seafood'].pop();assigned['Quick & Easy'].push('chicken ceasar salad');
  const byName={};Object.entries(assigned).forEach(([cat,names])=>names.forEach(n=>byName[n.toLowerCase()]=cat));
  const key='our-shop-meal-category';
  let current='All meals';
  try{const remembered=localStorage.getItem(key);if(categories.includes(remembered))current=remembered;}catch(e){}
  function category(m){return categories.includes(m.category)?m.category:(byName[String(m.name||'').toLowerCase()]||'Comfort Food');}
  function matches(m){return current==='All meals'||category(m)===current;}
  function tabMarkup(){
    return '<div class="meal-category-tabs" role="tablist" aria-label="Meal categories" style="display:flex;gap:7px;overflow-x:auto;white-space:nowrap;padding:4px 0 12px;scrollbar-width:thin">'+categories.map(c=>'<button type="button" role="tab" aria-selected="'+(c===current)+'" data-meal-category="'+c.replace(/&/g,'&amp;')+'" class="btn small '+(c===current?'':'alt')+'" style="flex:none">'+c.replace(/&/g,'&amp;')+'</button>').join('')+'</div>';
  }
  function rows(meals,picker){
    return meals.map(m=>{
      const name=typeof esc==='function'?esc(m.name):String(m.name);
      const arg=name.replaceAll('&#39;',"\\&#39;");
      const n=(m.ingredients||[]).length;
      return picker?'<div class="card between"><div><b>'+name+'</b><div class="muted">'+n+' ingredients</div></div><button class="btn small" onclick="pick(\''+arg+'\')">Use</button></div>'
        :'<div class="item"><div><b>'+name+'</b><div class="muted">'+n+' ingredients</div></div><div><button class="btn small alt" onclick="editMeal(\''+arg+'\')">Edit</button> <button class="btn small red" onclick="deleteMeal(\''+arg+'\')">Delete</button></div></div>';
    }).join('');
  }
  function filtered(){return Array.isArray(S?.meals)?S.meals.filter(matches):[];}
  function paintPicker(){
    const target=document.getElementById('pickMeals');if(!target)return;
    const ms=filtered();target.innerHTML=tabMarkup()+(ms.length?rows(ms,true):'<p class="muted">No meals in this category yet.</p>');
  }
  function paintSetup(){
    if(typeof setupMode!=='undefined'&&setupMode!=='meals')return;
    const target=document.getElementById('setupBody');if(!target)return;
    const ms=filtered();
    target.innerHTML='<div class="card"><div class="between"><b>Meals ('+(Array.isArray(S?.meals)?S.meals.length:0)+')</b><button class="btn small" onclick="addMeal()">Add meal</button></div>'+tabMarkup()+(ms.length?rows(ms,false):'<p class="muted">No meals in this category yet.</p>')+'</div>';
  }
  document.addEventListener('click',function(e){
    const b=e.target.closest('[data-meal-category]');if(!b)return;
    current=b.getAttribute('data-meal-category');
    try{localStorage.setItem(key,current);}catch(e){}
    if(document.getElementById('pick')?.classList.contains('on'))paintPicker();
    paintSetup();
  });
  const oldOpen=window.openDay;
  if(typeof oldOpen==='function')window.openDay=function(){const r=oldOpen.apply(this,arguments);paintPicker();return r;};
  const oldSetup=window.renderSetup;
  if(typeof oldSetup==='function')window.renderSetup=function(){const r=oldSetup.apply(this,arguments);paintSetup();return r;};
  // The original meal edit, pick, delete and save functions remain untouched.
  paintSetup();
})();