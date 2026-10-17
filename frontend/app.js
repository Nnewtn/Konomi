/* ============================================================
   KONOMI AI v2 · frontend engine (Vanilla JS, fetch → FastAPI)
   ============================================================ */
const API = location.origin; // фронт раздаётся тем же сервером; для раздельного деплоя замените на URL бэкенда

/* ---------- state ---------- */
const S = { lang:"ru", cat:"all", filters:new Set(), cart:new Map(), comboApplied:false,
            menu:[], weather:null, history:[], sheet:"collapsed" };
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const t = k => I18N[S.lang][k] ?? k;
const esc = s => s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\n/g,"<br>");

/* ---------- i18n ---------- */
const I18N = {
  ru:{ venue_sub:"Restauracja Rodzinna", empty:"Под эти фильтры ничего не подошло — спросите Konomi AI.",
       cart_cta:"Показать официанту", ai_status:"Сомелье онлайн · знает состав и аллергены",
       input_ph:"Спросите Konomi AI про блюда или комбо…", receipt:" · Чек гостя", total:"Итого",
       show_code:"Покажите код официанту", add:"В заказ", added:"Добавлено",
       tab_all:"Все", tab_soup:"Супы", tab_main:"Горячее", tab_bev:"Напитки и десерты",
       chip_hit:"Хиты кухни", chip_gf:"Без глютена", chip_np:"Без свинины",
       cat:{soup:"Суп",main:"Горячее",beverage:"Напиток",dessert:"Десерт"},
       alg:{gluten:"глютен",pork:"свинина",lactose:"лактоза"},
       greet:(w)=>`Добрый ${({morning:"день",lunch:"день",evening:"вечер",night:"вечер"})[w?.time_slot||"evening"]}. В Łódź сейчас ${w?.temp ?? "—"}°C, ${COND.ru[w?.condition]||""} — ${w && (w.temp<12||["rain","drizzle","snow","storm"].includes(w.condition)) ? "я бы начал с чего-то согревающего: Rosół или Żurek." : "что приготовить для вас сегодня?"} Спросите про состав, аллергены или попросите собрать комбо со скидкой.`,
       combo_title:"Комбо −15%", combo_sub:"Суп + основное + напиток", combo_add:"Добавить сет в заказ",
       saves:"экономия", offline:"Связь с сомелье прервалась — попробуйте ещё раз.", view:"в меню" },
  en:{ venue_sub:"Restauracja Rodzinna", empty:"No dishes match these filters — ask Konomi AI.",
       cart_cta:"Show to waiter", ai_status:"Sommelier online · knows every allergen",
       input_ph:"Ask Konomi AI about dishes or combos…", receipt:" · Guest check", total:"Total",
       show_code:"Show the code to your waiter", add:"Add", added:"Added",
       tab_all:"All", tab_soup:"Soups", tab_main:"Mains", tab_bev:"Drinks & Desserts",
       chip_hit:"Kitchen hits", chip_gf:"Gluten-free", chip_np:"No pork",
       cat:{soup:"Soup",main:"Main",beverage:"Drink",dessert:"Dessert"},
       alg:{gluten:"gluten",pork:"pork",lactose:"lactose"},
       greet:(w)=>`Good ${({morning:"morning",lunch:"afternoon",evening:"evening",night:"evening"})[w?.time_slot||"evening"]}. It's ${w?.temp ?? "—"}°C in Łódź${w?.condition?", "+COND.en[w.condition]:""} — ${w && (w.temp<12||["rain","drizzle","snow","storm"].includes(w.condition)) ? "may I suggest something warming first, like Rosół or Żurek?" : "what shall we start with?"} Ask about ingredients, allergens, or request a combo deal.`,
       combo_title:"Combo −15%", combo_sub:"Soup + main + drink", combo_add:"Add combo to check",
       saves:"you save", offline:"Connection lost — please try again.", view:"view" },
  pl:{ venue_sub:"Kuchnia tradycyjna", empty:"Brak dań w tych filtrach — zapytaj Konomi AI.",
       cart_cta:"Pokaż kelnerowi", ai_status:"Sommelier online · zna skład i alergeny",
       input_ph:"Zapytaj Konomi AI o dania lub combo…", receipt:" · Rachunek", total:"Razem",
       show_code:"Pokaż kod kelnerowi", add:"Dodaj", added:"Dodano",
       tab_all:"Wszystko", tab_soup:"Zupy", tab_main:"Dania główne", tab_bev:"Napoje i desery",
       chip_hit:"Hity kuchni", chip_gf:"Bez glutenu", chip_np:"Bez wieprzowiny",
       cat:{soup:"Zupa",main:"Danie",beverage:"Napój",dessert:"Deser"},
       alg:{gluten:"gluten",pork:"wieprzowina",lactose:"laktoza"},
       greet:(w)=>`Dzień dobry. W Łodzi jest teraz ${w?.temp ?? "—"}°C — ${w && (w.temp<12||["rain","drizzle","snow","storm"].includes(w.condition)) ? "polecam zacząć od rozgrzewającego Rosołu lub Żurku." : "od czego zaczynamy?"} Zapytaj o skład, alergeny lub combo ze zniżką.`,
       combo_title:"Combo −15%", combo_sub:"Zupa + danie + napój", combo_add:"Dodaj combo",
       saves:"oszczędzasz", offline:"Brak połączenia — spróbuj ponownie.", view:"zobacz" }
};
const COND = {
  ru:{clear:"ясно",cloudy:"облачно",fog:"туман",drizzle:"морось",rain:"дождь",snow:"снег",storm:"гроза"},
  en:{clear:"clear",cloudy:"cloudy",fog:"fog",drizzle:"drizzle",rain:"rain",snow:"snow",storm:"storm"}
};
/* Тонкие SVG-иконки 16×16, stroke 1.5 */
const ICON = {
  hit:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8L12 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  gf:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 20L20 4M7 4c0 5 2 8 5 9M17 20c0-5-2-8-5-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  np:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 6.5l11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  rain:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 15a5 5 0 01-.9-9.9A6 6 0 0117.7 7 4.5 4.5 0 0117 16H7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 19l-1 2.5M14 19l-1 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  sun:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  cloud:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 16a5 5 0 01-.9-9.9A6 6 0 0117.7 8 4.5 4.5 0 0117 17H7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  snow:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  storm:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 3L6 13h5l-1 8 7-11h-5l1-7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  fog:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 9h14M4 13h16M6 17h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
};
const wIcon = c => ({clear:ICON.sun,rain:ICON.rain,drizzle:ICON.rain,snow:ICON.snow,storm:ICON.storm,fog:ICON.fog}[c] || ICON.cloud);

/* ---------- API ---------- */
async function api(path, opts){ const r = await fetch(API+path, opts); if(!r.ok) throw new Error(r.status); return r.json(); }

/* ---------- menu render ---------- */
function dishOk(d){
  if(S.cat!=="all"){ if(S.cat==="beverage"){ if(!["beverage","dessert"].includes(d.category)) return false; } else if(d.category!==S.cat) return false; }
  for(const f of S.filters){
    if(f==="hit" && !d.tags.includes("hit")) return false;
    if(f==="gf" && d.allergens.includes("gluten")) return false;
    if(f==="np" && d.allergens.includes("pork")) return false;
  }
  return true;
}
function renderMenu(highlight){
  const grid = $("#menuGrid"); grid.innerHTML = "";
  const vis = S.menu.filter(dishOk);
  $("#emptyState").classList.toggle("hidden", vis.length!==0);
  vis.forEach((d,i)=>{
    const el = document.createElement("article");
    el.className = "dish-card rounded-[18px] overflow-hidden rise-in"; el.style.animationDelay = `${i*0.05}s`; el.dataset.id = d.id;
    const alg = d.allergens.map(a=>`<span class="text-[10px] font-medium text-coral bg-coral/10 rounded px-1.5 py-0.5">${t("alg")[a]||a}</span>`).join("");
    el.innerHTML = `
      ${d.image?`<img class="dish-img" src="${d.image}" alt="${esc(d.name)}" loading="lazy" onerror="this.remove()">`:""}
      <div class="p-3.5">
        <div class="flex items-start justify-between gap-2">
          <h3 class="wordmark text-[15px] leading-tight">${d.name}</h3>
          <div class="shrink-0 wordmark text-[16px]">${d.price}<span class="text-[10px] text-onyx/40 ml-0.5">zł</span></div>
        </div>
        <div class="mt-1 flex items-center gap-1.5 flex-wrap">
          <span class="text-[10px] font-medium text-onyx/45 bg-onyx/5 rounded px-1.5 py-0.5">${t("cat")[d.category]||d.category}</span>
          ${d.tags.includes("hit")?'<span class="text-[10px] font-bold text-onyx bg-lime rounded px-1.5 py-0.5">HIT</span>':""}
          ${alg}
          <span class="ml-auto text-[10px] text-onyx/35">${d.weight}</span>
        </div>
        <p class="mt-2 text-[12px] leading-snug text-onyx/60">${d.desc[S.lang]||d.desc.en}</p>
        <div class="mt-3 flex justify-end">
          <button data-add="${d.id}" class="add-btn bg-onyx text-cream text-[12px] font-semibold rounded-full px-4 py-2 spring-fast active:scale-95">+ ${t("add")}</button>
        </div>
      </div>`;
    grid.appendChild(el);
  });
  grid.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>{
    addToCart(b.dataset.add);
    const o = b.textContent; b.textContent = "✓ "+t("added"); b.classList.replace("bg-onyx","bg-emer");
    setTimeout(()=>{ b.textContent = o; b.classList.replace("bg-emer","bg-onyx"); },1000);
  }));
  if(highlight){
    const el = grid.querySelector(`[data-id="${highlight}"]`);
    if(el){ el.classList.add("dish-highlight"); el.scrollIntoView({behavior:"smooth",block:"center"});
      setTimeout(()=>el.classList.remove("dish-highlight"),3400); }
  }
}

/* ---------- cart ---------- */
function addToCart(id){ S.cart.set(id,(S.cart.get(id)||0)+1); updateCart(); }
function cartLines(){ return [...S.cart.entries()].map(([id,qty])=>({d:S.menu.find(x=>x.id===id),qty})).filter(l=>l.d); }
function updateCart(){
  const n=[...S.cart.values()].reduce((a,b)=>a+b,0), bar=$("#cartBar");
  if(!n){ bar.classList.add("hide"); return; }
  bar.classList.remove("hide");
  let total = cartLines().reduce((s,l)=>s+l.d.price*l.qty,0);
  if(S.comboApplied){ total -= Math.round(total*0.15); $("#cartSaving").classList.remove("hidden"); }
  else $("#cartSaving").classList.add("hidden");
  $("#cartCount").textContent = n; $("#cartTotal").textContent = total+" zł";
}
function openOrder(){
  const items=$("#modalItems"); items.innerHTML="";
  cartLines().forEach(({d,qty})=>{ items.innerHTML += `
    <div class="flex items-start justify-between gap-3 text-[14px]">
      <div class="min-w-0"><div class="text-cream leading-tight">${d.name}</div>
      <div class="text-white/40 text-[11px]">${qty} × ${d.price} zł · ${d.weight}</div></div>
      <div class="shrink-0 wordmark">${d.price*qty} zł</div></div>`; });
  const sub=cartLines().reduce((s,l)=>s+l.d.price*l.qty,0); let total=sub;
  const disc=$("#modalDiscount");
  if(S.comboApplied){ const sv=Math.round(sub*0.15); total-=sv; disc.classList.remove("hidden");
    disc.innerHTML=`<span>${t("combo_title")}</span><span>−${sv} zł</span>`; } else disc.classList.add("hidden");
  $("#modalTotal").textContent=total+" zł";
  $("#modalTime").textContent=new Date().toLocaleString(S.lang==="pl"?"pl-PL":S.lang==="en"?"en-GB":"ru-RU",{dateStyle:"medium",timeStyle:"short"});
  $("#orderCode").textContent="GP-"+Math.floor(1000+Math.random()*9000);
  $("#modalWrap").classList.remove("hide");
}

/* ---------- sheet ---------- */
function setSheet(mode){
  const s=$("#aiSheet"); s.classList.remove("expanded","collapsed"); s.classList.add(mode); S.sheet=mode;
  $("#chatBody").classList.toggle("hidden", mode==="collapsed");
  $("#sheetChevron").style.transform = mode==="expanded"?"rotate(180deg)":"rotate(0deg)";
}
(function drag(){
  let y0=0, top0=0, on=false;
  document.addEventListener("DOMContentLoaded",()=>{
    const g=$("#sheetGrab"), s=$("#aiSheet");
    const start=y=>{ on=true; y0=y; top0=s.getBoundingClientRect().top; s.classList.add("dragging"); };
    const move=y=>{ if(!on) return; const dy=Math.max(0,y-y0);
      s.style.transform = innerWidth>=768 ? `translate(-50%,${dy}px)` : `translateY(${dy}px)`; };
    const end=y=>{ if(!on) return; on=false; s.classList.remove("dragging"); s.style.transform="";
      setSheet((y-y0)>80 ? "collapsed" : "expanded"); };
    g.addEventListener("touchstart",e=>start(e.touches[0].clientY),{passive:true});
    g.addEventListener("touchmove",e=>move(e.touches[0].clientY),{passive:true});
    g.addEventListener("touchend",e=>end(e.changedTouches[0].clientY));
    g.addEventListener("mousedown",e=>{ start(e.clientY);
      const mm=ev=>move(ev.clientY), mu=ev=>{ end(ev.clientY);
        document.removeEventListener("mousemove",mm); document.removeEventListener("mouseup",mu); };
      document.addEventListener("mousemove",mm); document.addEventListener("mouseup",mu); });
  });
})();

/* ---------- chat ---------- */
function bubble(role, html){
  const body=$("#chatBody"), w=document.createElement("div");
  w.className=`flex pop-in ${role==="user"?"justify-end":"justify-start"}`;
  const b=document.createElement("div");
  b.className = role==="user"
    ? "msg-user bg-lime text-onyx px-4 py-2.5 text-[14px] max-w-[82%] font-medium"
    : "msg-ai bg-white/[.08] border border-white/10 px-4 py-3 text-[14px] leading-snug max-w-[88%]";
  b.innerHTML=html; w.appendChild(b); body.appendChild(w); body.scrollTop=body.scrollHeight; return w;
}
function typing(on){
  let el=$("#typingW");
  if(on){ if(el) return; const w=bubble("ai",'<div class="flex gap-1 items-center h-4"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>'); w.id="typingW"; }
  else if(el) el.remove();
}
function dishCardMini(d){
  const alg=d.allergens.map(a=>`<span class="text-[10px] text-coral/90 bg-coral/15 rounded px-1 py-0.5">${t("alg")[a]||a}</span>`).join(" ");
  return `<div class="mt-2 rounded-xl bg-white/[.06] border border-white/10 p-3 flex gap-3 items-center">
    ${d.image?`<img src="${d.image}" class="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" onerror="this.remove()">`:""}
    <div class="min-w-0 flex-1">
      <div class="wordmark text-[13px] text-cream leading-tight">${d.name}</div>
      <div class="text-[10px] text-white/40">${d.weight} · ${t("cat")[d.category]||d.category}</div>
      <div class="flex gap-1 mt-1 flex-wrap">${alg}</div>
    </div>
    <div class="shrink-0 text-right">
      <div class="wordmark text-lime text-[14px]">${d.price} zł</div>
      <button class="add-inline mt-1 text-[11px] font-bold bg-lime text-onyx rounded-full px-3 py-1" data-id="${d.id}">+ ${t("add")}</button>
    </div></div>`;
}
function comboCard(ids,discount){
  const ds=ids.map(id=>S.menu.find(d=>d.id===id)).filter(Boolean); if(ds.length<2) return "";
  const sum=ds.reduce((s,d)=>s+d.price,0), sv=Math.round(sum*discount/100), fin=sum-sv;
  const list=ds.map(d=>`<li class="flex justify-between text-[12px] text-cream/85"><span class="truncate pr-2">${d.name}</span><span class="text-white/45 shrink-0">${d.price} zł</span></li>`).join("");
  return `<div class="combo-glow mt-2 rounded-xl p-[1.5px]"><div class="relative bg-onyx2 rounded-xl p-3.5">
    <div class="flex items-center justify-between">
      <div><div class="text-[10px] font-bold tracking-[.18em] uppercase text-lime">${t("combo_title")}</div>
      <div class="text-white/45 text-[10px]">${t("combo_sub")}</div></div>
      <div class="text-right"><div class="text-white/35 text-[10px] line-through">${sum} zł</div>
      <div class="wordmark text-lime text-lg">${fin} zł</div></div></div>
    <ul class="mt-2.5 space-y-1">${list}</ul>
    <div class="mt-2 text-[11px] text-lime2 font-semibold">${t("saves")}: −${sv} zł</div>
    <button class="combo-apply mt-2.5 w-full bg-lime text-onyx font-bold rounded-full py-2 text-[12px] spring-fast active:scale-95" data-ids="${ids.join(",")}">${t("combo_add")}</button>
  </div></div>`;
}
function bindChatButtons(scope){
  scope.querySelectorAll(".add-inline").forEach(b=>b.addEventListener("click",()=>{
    addToCart(b.dataset.id); b.textContent="✓ "+t("added"); b.classList.replace("bg-lime","bg-emer"); b.classList.add("text-cream"); }));
  scope.querySelectorAll(".combo-apply").forEach(b=>b.addEventListener("click",()=>{
    b.dataset.ids.split(",").forEach(id=>S.cart.set(id,(S.cart.get(id)||0)+1));
    S.comboApplied=true; updateCart();
    b.textContent="✓ "+t("added"); b.classList.replace("bg-lime","bg-emer"); b.classList.add("text-cream"); }));
}

async function sendChat(){
  const inp=$("#chatInput"), text=inp.value.trim(); if(!text) return;
  inp.value=""; bubble("user", md(text)); typing(true); setSheet("expanded");
  S.history.push({role:"user", content:text});
  try{
    const res = await api("/api/chat",{ method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ message:text, context:{lang:S.lang}, history:S.history.slice(-8) }) });
    typing(false);
    let html = md(res.reply||"");
    (res.dishes||[]).forEach(id=>{ const d=S.menu.find(x=>x.id===id); if(d) html+=dishCardMini(d); });
    if(res.combo?.ids?.length>=2) html+=comboCard(res.combo.ids, res.combo.discount||15);
    const w=bubble("ai",html); bindChatButtons(w);
    S.history.push({role:"assistant", content:res.reply||""});
  }catch(e){ typing(false); bubble("ai", t("offline")); }
}

/* ---------- voice ---------- */
function initVoice(){
  const btn=$("#micBtn"), SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ btn.style.display="none"; return; }
  const rec=new SR(); rec.continuous=false; rec.interimResults=false; let on=false;
  const code=()=>({ru:"ru-RU",en:"en-US",pl:"pl-PL"})[S.lang];
  btn.addEventListener("click",()=>{ rec.lang=code();
    if(on){ rec.stop(); return; }
    try{ rec.start(); on=true; btn.classList.add("mic-live"); }catch(e){} });
  rec.onresult=e=>{ $("#chatInput").value=e.results[0][0].transcript; sendChat(); };
  rec.onend=()=>{ on=false; btn.classList.remove("mic-live"); };
}

/* ---------- i18n apply ---------- */
function applyLang(){
  document.documentElement.lang=S.lang;
  $$("[data-i18n]").forEach(el=>{ const v=I18N[S.lang][el.dataset.i18n]; if(typeof v==="string") el.textContent=v; });
  $$("[data-i18n-ph]").forEach(el=>{ const v=I18N[S.lang][el.dataset.i18nPh]; if(v) el.placeholder=v; });
  $$(".lang-btn").forEach(b=>{ const on=b.dataset.lang===S.lang;
    b.classList.toggle("bg-lime",on); b.classList.toggle("text-onyx",on); b.classList.toggle("text-white/50",!on); });
  // tabs & chips
  const tabs=$("#catTabs"); tabs.innerHTML="";
  [["all","tab_all"],["soup","tab_soup"],["main","tab_main"],["beverage","tab_bev"]].forEach(([c,k])=>{
    const b=document.createElement("button");
    b.className=`tab shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold border border-onyx/10 bg-white ${S.cat===c?"on":""}`;
    b.textContent=t(k); b.addEventListener("click",()=>{ S.cat=c; applyLang(); }); tabs.appendChild(b); });
  const chips=$("#filterChips"); chips.innerHTML="";
  [["hit","chip_hit",ICON.hit],["gf","chip_gf",ICON.gf],["np","chip_np",ICON.np]].forEach(([f,k,ic])=>{
    const b=document.createElement("button");
    b.className=`chip shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border border-onyx/15 bg-white ${S.filters.has(f)?"on":""}`;
    b.innerHTML=`${ic}<span>${t(k)}</span>`;
    b.addEventListener("click",()=>{ S.filters.has(f)?S.filters.delete(f):S.filters.add(f); applyLang(); });
    chips.appendChild(b); });
  renderMenu(); updateCart();
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  applyLang();
  $("#sheetToggle").addEventListener("click",()=>setSheet(S.sheet==="expanded"?"collapsed":"expanded"));
  $("#sendBtn").addEventListener("click",sendChat);
  $("#chatInput").addEventListener("keydown",e=>{ if(e.key==="Enter") sendChat(); });
  $("#cartOpen").addEventListener("click",openOrder);
  $("#modalClose").addEventListener("click",()=>$("#modalWrap").classList.add("hide"));
  $("#modalWrap").addEventListener("click",e=>{ if(e.target.id==="modalWrap") e.target.classList.add("hide"); });
  initVoice();
  try{
    const [menu, weather] = await Promise.all([ api("/api/menu"), api("/api/weather") ]);
    S.menu = menu.dishes; S.weather = weather;
    $("#weatherBadge").classList.remove("hidden");
    $("#weatherIcon").innerHTML = wIcon(weather.condition);
    $("#weatherText").textContent = `${weather.city} ${weather.temp}°C`;
    applyLang();
    setTimeout(()=>{ setSheet("expanded"); bubble("ai", md(t("greet")(weather))); }, 900);
  }catch(e){
    console.error("API offline:", e);
    $("#emptyState").classList.remove("hidden");
  }
});
