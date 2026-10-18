'use strict';
const {esc:E,icon:I}=K;
const $=s=>document.querySelector(s);
const L={
 ru:{menu:'Меню',count:'позиций',categories:['Все','Супы','Горячее','Напитки и десерты','Закуски','Другое'],filters:['Хиты кухни','Без глютена','Без свинины'],empty:'Нет подходящих блюд. Уберите фильтр или спросите официанта.',add:'Добавить в заказ',stopped:'Временно нет',unknown:'Состав уточняется',photo:'Иллюстрация подачи',chat:'Ваш проводник по меню',greet:'Добро пожаловать в Gęsi Puch. Расскажу о блюдах, помогу с выбором и соберу комбо. При аллергии обязательно уточните состав и перекрестные контакты у официанта.',cool:' В прохладную погоду приятно начать с горячего Rosół.',quick:['Без свинины','Сытно до 100 PLN','Комбо со скидкой'],input:'Спросите про блюда или комбо…',cart:'Ваш заказ',show:'Показать официанту',total:'Итого',clear:'Очистить',checkout:'Сформировать чек',notice:'Это чек для показа официанту, не автоматическая отправка на кухню.',receipt:'Чек гостя',combo:'Комбо',set:'Добавить сет',saving:'Выгода',checking:'Проверяем цены и доступность…',reset:'Сбросить',diet:'Исключения',thinking:'Подбираю блюда…',voice:'Голосовой ввод недоступен. Используйте текст.',error:'Не удалось получить ответ. Попробуйте ещё раз.',retry:'Повторить',load:'Не удалось загрузить меню.',emptyCart:'В корзине пока нет блюд.',remove:'Удалить',rules:'Локальный помощник',gemini:'ИИ-сомелье',allergens:{gluten:'глютен',pork:'свинина',lactose:'лактоза',milk:'молоко',egg:'яйцо',fish:'рыба',nuts:'орехи'}},
 en:{menu:'Menu',count:'dishes',categories:['All','Soups','Mains','Drinks & desserts','Starters','Other'],filters:['Kitchen hits','Gluten-free','No pork'],empty:'No matching dishes. Remove a filter or ask your waiter.',add:'Add to order',stopped:'Unavailable',unknown:'Confirm ingredients',photo:'Serving illustration',chat:'Your guide to the menu',greet:'Welcome to Gęsi Puch. I can explain dishes and help build a combo. If you have allergies, always confirm ingredients and cross-contact with your waiter.',cool:' A hot Rosół is a lovely start in cool weather.',quick:['No pork','Hearty under 100 PLN','Combo deal'],input:'Ask about dishes or combos…',cart:'Your order',show:'Show to waiter',total:'Total',clear:'Clear',checkout:'Create guest check',notice:'This is a guest check to show your waiter, not an automatic kitchen order.',receipt:'Guest check',combo:'Combo',set:'Add set',saving:'Saving',checking:'Checking prices and availability…',reset:'Reset',diet:'Exclusions',thinking:'Finding dishes…',voice:'Voice input unavailable. Please type.',error:'Could not get a response. Please retry.',retry:'Retry',load:'Could not load menu.',emptyCart:'Your cart is empty.',remove:'Remove',rules:'Local assistant',gemini:'AI sommelier',allergens:{gluten:'gluten',pork:'pork',lactose:'lactose',milk:'milk',egg:'egg',fish:'fish',nuts:'nuts'}},
 pl:{menu:'Menu',count:'pozycji',categories:['Wszystko','Zupy','Dania główne','Napoje i desery','Przystawki','Inne'],filters:['Hity kuchni','Bez glutenu','Bez wieprzowiny'],empty:'Brak pasujących dań. Zmień filtr lub zapytaj kelnera.',add:'Dodaj do zamówienia',stopped:'Niedostępne',unknown:'Potwierdź skład',photo:'Przykładowe podanie',chat:'Twój przewodnik po menu',greet:'Witamy w Gęsim Puchu. Pomogę wybrać dania i złożyć zestaw. Przy alergii zawsze potwierdź skład i ryzyko kontaktu krzyżowego z kelnerem.',cool:' W chłodną pogodę warto zacząć od gorącego rosołu.',quick:['Bez wieprzowiny','Sycąco do 100 PLN','Combo ze zniżką'],input:'Zapytaj o dania lub combo…',cart:'Twoje zamówienie',show:'Pokaż kelnerowi',total:'Razem',clear:'Wyczyść',checkout:'Utwórz rachunek',notice:'Rachunek do pokazania kelnerowi, bez automatycznej wysyłki na kuchnię.',receipt:'Rachunek gościa',combo:'Combo',set:'Dodaj zestaw',saving:'Oszczędność',checking:'Sprawdzamy ceny i dostępność…',reset:'Resetuj',diet:'Wykluczenia',thinking:'Wybieram dania…',voice:'Wpisz wiadomość — głos niedostępny.',error:'Nie udało się uzyskać odpowiedzi. Spróbuj ponownie.',retry:'Ponów',load:'Nie udało się załadować menu.',emptyCart:'Koszyk jest pusty.',remove:'Usuń',rules:'Lokalny pomocnik',gemini:'AI sommelier',allergens:{gluten:'gluten',pork:'wieprzowina',lactose:'laktoza',milk:'mleko',egg:'jajko',fish:'ryba',nuts:'orzechy'}}
};
const S={lang:['ru','en','pl'].includes(K.read('konomi-lang','ru'))?K.read('konomi-lang','ru'):'ru',menu:[],cat:'all',filters:new Set(),lines:[],history:[],excludes:[],quote:null,busy:false,opened:false,venue:'Gęsi Puch',idempotency:null};
const t=k=>L[S.lang][k];
const money=v=>new Intl.NumberFormat(S.lang==='ru'?'ru-RU':S.lang==='en'?'en-GB':'pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v)+' PLN';
const categories=['all','soup','main','beverage','starter','other'];
let quoteController,quoteTimer,lastWeather=null,langGeneration=0;

function saveCart(){K.save('konomi-cart-v3',{lines:S.lines,excludes:S.excludes});S.idempotency=null;}
function restoreCart(){const old=K.read('konomi-cart-v3',{});S.lines=Array.isArray(old.lines)?old.lines.filter(l=>Array.isArray(l.ids)&&l.ids.length>0&&l.ids.length<=3&&l.ids.every(i=>typeof i==='string')&&Number.isInteger(l.qty)&&l.qty>0&&l.qty<=30).slice(0,40).map(l=>({ids:l.ids,qty:l.qty,combo:!!l.combo})):[];S.excludes=Array.isArray(old.excludes)?old.excludes.filter(x=>typeof x==='string').slice(0,40):[];}
function applyLanguage(){
 document.documentElement.lang=S.lang; document.title=`Konomi AI — ${S.venue}`;
 $('#menuTitle').textContent=t('menu');$('#messageInput').placeholder=t('input');$('#cartCta').textContent=t('show');$('#cartTitle').textContent=t('cart');$('#totalLabel').textContent=t('total');$('#checkout').textContent=t('checkout');$('#clearCart').textContent=t('clear');$('#checkNotice').textContent=t('notice');$('#receiptTitle').textContent=t('receipt');$('#clearDiet').textContent=t('reset');$('#engineLabel').textContent=t('chat');
 document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('active',b.dataset.lang===S.lang);b.setAttribute('aria-pressed',b.dataset.lang===S.lang);});
 $('#tabs').innerHTML=categories.map((c,i)=>`<button data-cat="${c}" class="${S.cat===c?'active':''}" aria-pressed="${S.cat===c}">${E(t('categories')[i])}</button>`).join('');
 $('#filters').innerHTML=['hit','gluten','pork'].map((f,i)=>`<button data-filter="${f}" class="${S.filters.has(f)?'active':''}" aria-pressed="${S.filters.has(f)}">${I(['star','grain-off','pork-off'][i])}${E(t('filters')[i])}</button>`).join('');
 $('#quick').innerHTML=t('quick').map((q,i)=>`<button data-quick="${i}">${E(q)}</button>`).join('');
 renderDiet();renderMenu();renderCart();
}
function renderDiet(){
 $('#dietBar').classList.toggle('hidden',S.excludes.length===0);
 $('#dietText').textContent=t('diet')+': '+S.excludes.map(a=>t('allergens')[a]||a).join(', ');
}
function renderMenu(){
 const visible=S.menu.filter(d=>{
  if(S.cat!=='all'&&(S.cat==='beverage'?!['beverage','dessert'].includes(d.category):d.category!==S.cat))return false;
  if(S.filters.has('hit')&&!d.tags.includes('hit'))return false;
  for(const a of ['gluten','pork'])if(S.filters.has(a)&&(d.allergens.includes(a)||!d.allergens_verified))return false;
  return true;
 });
 $('#dishCount').textContent=`${visible.length} ${t('count')}`;$('#empty').classList.toggle('hidden',visible.length>0);$('#empty').textContent=t('empty');
 $('#menuGrid').innerHTML=visible.map((d,i)=>`<article class="dish" data-dish="${E(d.id)}" style="animation-delay:${Math.min(i,8)*35}ms">
 <div class="photo">${I('leaf',28)}${d.image?`<img src="${E(d.image)}" alt="${E(d.name)}" loading="lazy" referrerpolicy="no-referrer"><span class="photo-label">${E(t('photo'))}</span>`:''}</div>
 <div class="dish-body"><div class="dish-top"><h2>${E(d.name)}</h2><span class="weight">${E(d.weight)}</span></div><p class="description">${E(d.desc?.[S.lang]||d.desc?.pl||d.desc?.en||d.desc?.ru||'')}</p><div class="badges">${d.tags.includes('hit')?`<span class="badge hit">${I('star',10)} ${E(t('filters')[0])}</span>`:''}${d.allergens.map(a=>`<span class="badge">${E(t('allergens')[a]||a)}</span>`).join('')}${!d.allergens_verified?`<span class="badge warn">${E(t('unknown'))}</span>`:''}</div>
 <div class="dish-bottom"><span class="price">${new Intl.NumberFormat(S.lang).format(d.price)} <small>PLN</small></span><button class="add" data-add="${E(d.id)}" aria-label="${E(t('add')+': '+d.name)}" ${!d.available?'disabled':''}>${I(d.available?'plus':'ban',18)}</button></div>${!d.available?`<span class="small subtle">${E(t('stopped'))}</span>`:''}</div></article>`).join('');
 $('#menuGrid').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.nextElementSibling?.remove();img.remove();},{once:true}));
}
function openChat(open=true){S.opened=open;$('#sheet').classList.toggle('open',open);$('#sheet').setAttribute('aria-hidden',String(!open));$('#sheet').inert=!open;$('#toggleChat').setAttribute('aria-expanded',String(open));$('#toggleChat').style.transform=open?'rotate(180deg)':'';if(open)$('#messages').scrollTop=$('#messages').scrollHeight;}
function addLine(ids,combo=false){
 const same=S.lines.find(l=>l.combo===combo&&l.ids.join('|')===ids.join('|'));
 if(same&&same.qty>=30){K.toast('Максимум 30 порций в строке',true);return;}
 if(same)same.qty++;else if(S.lines.length<40)S.lines.push({ids,qty:1,combo});else{K.toast('Максимум 40 строк в чеке',true);return;}
 saveCart();renderCart();requestQuote();K.toast(t('add'));
}
function renderCart(){
 const count=S.lines.reduce((s,l)=>s+l.qty*l.ids.length,0);
 $('#cartOpen').classList.toggle('hidden',count===0);$('#cartCount').textContent=count;$('#checkout').disabled=!count||!S.quote;
 $('#cartTotal').textContent=S.quote?money(S.quote.total):'— PLN';$('#dialogTotal').textContent=S.quote?money(S.quote.total):'—';
 $('#cartSaving').classList.toggle('hidden',!S.quote?.saving);$('#cartSaving').textContent=S.quote?.saving?`−${money(S.quote.saving)}`:'';
 $('#cartItems').innerHTML=S.lines.length?S.lines.map((l,i)=>{const server=S.quote?.lines[i];const names=server?.names||l.ids.map(id=>S.menu.find(d=>d.id===id)?.name||id);return `<div class="cart-line"><div class="cart-line-head"><div>${l.combo?`<span class="badge hit">${E(t('combo'))}</span><br>`:''}${names.map(E).join('<br>')}</div><span>${server?E(money(server.total)):'—'}</span></div><div class="qty-row"><button class="icon-btn" data-qty="${i}" data-delta="-1" aria-label="Уменьшить">${I('minus',13)}</button><span class="mono">${l.qty}</span><button class="icon-btn" data-qty="${i}" data-delta="1" aria-label="Увеличить" ${l.qty>=30?'disabled':''}>${I('plus',13)}</button><button class="text-btn small" data-remove="${i}">${E(t('remove'))}</button></div></div>`;}).join(''):`<p class="empty">${E(t('emptyCart'))}</p>`;
}
function requestQuote(){
 clearTimeout(quoteTimer);quoteController?.abort();S.quote=null;$('#cartStatus').textContent=S.lines.length?t('checking'):'';$('#cartStatus').className='inline-status';renderCart();
 if(!S.lines.length)return;
 const signature=JSON.stringify({lines:S.lines,excludes:S.excludes});
 quoteTimer=setTimeout(async()=>{quoteController=new AbortController();try{const result=await K.api('/api/order/quote',{method:'POST',body:JSON.parse(signature),signal:quoteController.signal});if(signature!==JSON.stringify({lines:S.lines,excludes:S.excludes}))return;S.quote=result;$('#cartStatus').textContent='';renderCart();}catch(e){if(e.name==='AbortError')return;$('#cartStatus').textContent=e.message;$('#cartStatus').className='inline-status error';$('#cartTotal').textContent='—';$('#checkout').disabled=true;}},120);
}
function message(role,text){const el=document.createElement('div');el.className='message '+(role==='user'?'user':'');const p=document.createElement('p');p.textContent=text;el.append(p);$('#messages').append(el);$('#messages').scrollTop=$('#messages').scrollHeight;return el;}
function replyCards(el,result){
 const list=document.createElement('div');list.className='chat-picks';
 list.innerHTML=(result.dishes||[]).map(id=>S.menu.find(d=>d.id===id)).filter(Boolean).map(d=>`<div class="chat-pick"><button class="text-btn" data-focus="${E(d.id)}">${E(d.name)}</button><span>${E(money(d.price))}</span><button class="icon-btn" data-add="${E(d.id)}" aria-label="${E(t('add'))}">${I('plus',13)}</button></div>`).join('');el.append(list);
 if(result.combo){const c=result.combo;const box=document.createElement('div');box.className='combo';box.innerHTML=`<div class="combo-head">${E(t('combo'))}<span>−${c.discount}%</span></div><ul>${c.ids.map(id=>S.menu.find(d=>d.id===id)).filter(Boolean).map(d=>`<li>${E(d.name)}</li>`).join('')}</ul><div class="combo-total"><span>${E(money(c.total))}</span><del>${E(money(c.subtotal))}</del></div><button class="primary lime" data-combo="${E(c.ids.join('|'))}">${I('plus')}${E(t('set'))}</button>`;el.append(box);}
 $('#messages').scrollTop=$('#messages').scrollHeight;
}
async function send(text){
 if(S.busy||!text.trim())return;text=text.trim().slice(0,2000);$('#messageInput').value='';openChat();S.busy=true;$('#send').disabled=true;const generation=langGeneration;
 message('user',text);const typing=message('assistant',t('thinking'));typing.classList.add('typing');
 try{
  const r=await K.api('/api/chat',{method:'POST',body:{message:text,context:{lang:S.lang},history:S.history.slice(-16),excludes:S.excludes}});
  typing.remove();if(generation!==langGeneration)return;
  S.history.push({role:'user',content:text},{role:'assistant',content:r.reply});S.history=S.history.slice(-16);
  S.excludes=r.excludes||S.excludes;saveCart();renderDiet();requestQuote();const el=message('assistant',r.reply);replyCards(el,r);$('#engineLabel').textContent=r.engine==='gemini'?t('gemini'):t('rules');
 }catch(e){typing.remove();if(generation===langGeneration){const box=message('assistant',e.message||t('error'));const retry=document.createElement('button');retry.className='text-btn';retry.style.color='var(--lime)';retry.textContent=t('retry');retry.onclick=()=>send(text);box.append(retry);}}
 finally{S.busy=false;$('#send').disabled=false;}
}
async function loadMenu(){
 $('#loadStatus').hidden=false;$('#loadStatus').textContent='…';
 try{const data=await K.api('/api/menu');S.menu=data.dishes;S.venue=data.venue;$('#venue').textContent=data.venue;$('#loadStatus').hidden=true;applyLanguage();requestQuote();}
 catch(e){$('#loadStatus').innerHTML=`${E(t('load'))} <button class="text-btn" id="reloadMenu">${E(t('retry'))}</button>`;$('#reloadMenu').onclick=loadMenu;}
}
function greet(){
 $('#messages').innerHTML='';const text=t('greet').replace('Gęsi Puch',S.venue)+(lastWeather?.temp!==null&&lastWeather?.temp<12?t('cool'):'');message('assistant',text);
}
function voice(){
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){K.toast(t('voice'));return;}
 const rec=new Recognition();rec.lang={ru:'ru-RU',en:'en-GB',pl:'pl-PL'}[S.lang];let ended=false;$('#mic').disabled=true;$('#mic').classList.add('live');
 const reset=()=>{if(ended)return;ended=true;$('#mic').disabled=false;$('#mic').classList.remove('live');};rec.onresult=e=>{reset();send(e.results[0][0].transcript);};rec.onerror=()=>{reset();K.toast(t('voice'),true);};rec.onend=reset;try{rec.start();}catch{reset();K.toast(t('voice'),true);}
}
function uniqueKey(){return globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}

restoreCart();applyLanguage();openChat(false);
new ResizeObserver(entries=>document.documentElement.style.setProperty('--dock-h',entries[0].target.getBoundingClientRect().height+'px')).observe($('#dock'));
// Keep controls above the software keyboard, including Safari visualViewport resizing.
function keyboard(){const v=window.visualViewport;const offset=v?Math.max(0,innerHeight-v.height-v.offsetTop):0;document.documentElement.style.setProperty('--keyboard',offset+'px');}
window.visualViewport?.addEventListener('resize',keyboard);window.visualViewport?.addEventListener('scroll',keyboard);
$('#toggleChat').onclick=()=>openChat(!S.opened);$('#closeChat').onclick=()=>openChat(false);$('#grab').onclick=()=>openChat(false);
let startY=0;$('#grab').addEventListener('pointerdown',e=>{startY=e.clientY;$('#grab').setPointerCapture(e.pointerId);});$('#grab').addEventListener('pointerup',e=>{if(e.clientY-startY>35)openChat(false);});
$('#messageInput').addEventListener('focus',()=>openChat());$('#composer').onsubmit=e=>{e.preventDefault();send($('#messageInput').value);};$('#mic').onclick=voice;
$('#cartOpen').onclick=()=>{$('#cartDialog').showModal();requestQuote();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#clearCart').onclick=()=>{S.lines=[];saveCart();requestQuote();};$('#clearDiet').onclick=()=>{S.excludes=[];S.history=[];saveCart();renderDiet();requestQuote();greet();};
document.addEventListener('click',e=>{
 const add=e.target.closest('[data-add]');if(add){addLine([add.dataset.add]);return;}
 const combo=e.target.closest('[data-combo]');if(combo){addLine(combo.dataset.combo.split('|'),true);combo.disabled=true;combo.innerHTML=I('check')+' '+E(t('add'));return;}
 const cat=e.target.closest('[data-cat]');if(cat){S.cat=cat.dataset.cat;applyLanguage();return;}
 const filter=e.target.closest('[data-filter]');if(filter){const f=filter.dataset.filter;S.filters.has(f)?S.filters.delete(f):S.filters.add(f);applyLanguage();return;}
 const focus=e.target.closest('[data-focus]');if(focus){openChat(false);S.cat='all';S.filters.clear();applyLanguage();const card=[...document.querySelectorAll('[data-dish]')].find(x=>x.dataset.dish===focus.dataset.focus);if(card){card.classList.add('highlight');card.scrollIntoView({behavior:'smooth',block:'center'});}return;}
 const quick=e.target.closest('[data-quick]');if(quick){send(t('quick')[Number(quick.dataset.quick)]);return;}
 const lang=e.target.closest('[data-lang]');if(lang){if(S.busy){K.toast(t('thinking'));return;}langGeneration++;S.lang=lang.dataset.lang;K.save('konomi-lang',S.lang);S.history=[];applyLanguage();greet();return;}
 const qty=e.target.closest('[data-qty]');if(qty){const i=Number(qty.dataset.qty);S.lines[i].qty+=Number(qty.dataset.delta);S.lines=S.lines.filter(l=>l.qty>0);saveCart();requestQuote();return;}
 const remove=e.target.closest('[data-remove]');if(remove){S.lines.splice(Number(remove.dataset.remove),1);saveCart();requestQuote();}
});
$('#checkout').onclick=async()=>{
 if(!S.quote)return;$('#checkout').disabled=true;S.idempotency ||= uniqueKey();
 try{const r=await K.api('/api/orders',{method:'POST',body:{lines:S.lines,excludes:S.excludes,idempotency_key:S.idempotency}});$('#receipt').innerHTML=`<p class="small subtle">${E(S.venue)} · ${E(new Date(r.created_at).toLocaleString(S.lang))}</p>${r.lines.map(l=>`<div class="cart-line-head"><span>${l.qty} × ${l.names.map(E).join(' + ')}</span><span>${E(money(l.total))}</span></div>`).join('')}<div class="total-row"><span>${E(t('total'))}</span><span>${E(money(r.total))}</span></div>${r.saving?`<p class="small subtle">${E(t('saving'))}: ${E(money(r.saving))}</p>`:''}<div class="checkout-code"><span class="small">${E(t('show'))}</span><strong>${E(r.code)}</strong></div><p class="small subtle">${E(t('notice'))}</p>`;$('#cartDialog').close();$('#receiptDialog').showModal();}catch(e){K.toast(e.message,true);}finally{$('#checkout').disabled=!S.quote;}
};
(async()=>{await loadMenu();try{lastWeather=await K.api('/api/weather');$('#weather').innerHTML=I(lastWeather.condition==='clear'?'sun':['rain','drizzle'].includes(lastWeather.condition)?'rain':'cloud')+E(lastWeather.temp===null?lastWeather.city:`${lastWeather.city} ${lastWeather.temp}°C`);if(lastWeather.stale)$('#weather').title='Weather data unavailable or stale';}catch{$('#weather').textContent='Łódź';}greet();})();
