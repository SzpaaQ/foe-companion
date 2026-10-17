(function(root){
 'use strict';
 const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
 const entities=s=>new Map((s?.map?.entities||[]).filter(e=>!e.cityentity_id?.includes('Impediment')).map(e=>[e.id,e]));
 function changes(before,after){
  const a=entities(before),b=entities(after),out=[];
  for(const [id,e] of b){const old=a.get(id);
   if(!old)out.push({kind:'added',id,building:e.cityentity_id});
   else if(old.cityentity_id!==e.cityentity_id||old.level!==e.level)out.push({kind:'changed',id,building:e.cityentity_id});
   else if(old.state?.__class__==='ConstructionState'&&e.state?.__class__!=='ConstructionState')out.push({kind:'completed',id,building:e.cityentity_id});
   else if(old.connected!==e.connected)out.push({kind:'connection',id,building:e.cityentity_id});
  }
  for(const [id,e] of a)if(!b.has(id))out.push({kind:'removed',id,building:e.cityentity_id});
  const areas=s=>new Set((s?.map?.unlocked_areas||[]).map(a=>JSON.stringify([a.x,a.y,a.width,a.length])));
  const oldAreas=areas(before);for(const area of areas(after))if(!oldAreas.has(area))out.push({kind:'expansion',area:JSON.parse(area)});
  return out;
 }
 function database(){
  let opening;
  const open=()=>opening||=(new Promise((resolve,reject)=>{
   const request=indexedDB.open('foe-companion-quantum-history',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('profiles');
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }));
  async function transact(key,value,write){const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('profiles',write?'readwrite':'readonly'),store=tx.objectStore('profiles');
   const request=write?store.put(value,key):store.get(key);
   tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Przerwany zapis'));
  });}
  return {load:key=>transact(key),save:(key,value)=>transact(key,value,true)};
 }
 function create({storage=database(),world=location.host,now=()=>Date.now()}={}){
  let queue=Promise.resolve(),profile=null,doc=null,error='',onchange=()=>{};
  const enqueue=fn=>{queue=queue.then(fn).catch(e=>{error='Nie udało się zapisać lub odczytać historii: '+e.message;onchange();});return queue;};
  async function save(){await storage.save(profile,copy(doc));error='';onchange();}
  function observe(data,before,after){
   if(!after?.map)return queue;
   // Clone immediately: persistence is asynchronous but the game keeps updating.
   const b=copy(before),a=copy(after),responses=copy((Array.isArray(data)?data:[data]).filter(r=>r?.requestClass==='CityProductionService'&&['pickupProduction','pickupAll'].includes(r.requestMethod))),at=now();
   a.calculationVersion=root.FoeQuantum.calculationVersion;if(b)b.calculationVersion=root.FoeQuantum.calculationVersion;
   return enqueue(async()=>{
    const player=a.map.entities.find(e=>e.player_id!=null)?.player_id;
    if(player==null)return;
    const key=world+':'+player;
    let first=false;
    if(profile!==key){const loaded=await storage.load(key);doc=loaded||{schemaVersion:1,world,playerId:player,events:[]};profile=key;first=true;}
    const run=String(a.summary?.raid?.endsAt||a.map.entities.find(e=>e.type==='main_building')?.id||'unknown');
    const diff=b?.map?changes(b,a):[];
    const pickup=responses.filter(r=>r?.requestClass==='CityProductionService'&&['pickupProduction','pickupAll'].includes(r.requestMethod)&&r.responseData&&!r.responseData.error);
    const touched=new Set();
    function walk(v){if(!v||typeof v!=='object')return;if(v.__class__==='CityMapEntity'&&v.cityentity_id?.includes('GuildRaids'))touched.add(v.id);for(const child of Object.values(v))if(child&&typeof child==='object')walk(child);}
    pickup.forEach(r=>walk(r.responseData));
    const old=entities(b),current=entities(a);
    const stateKey=e=>JSON.stringify([e.state?.__class__,e.state?.next_state_transition_at,e.state?.productionOption]);
    const collected=[...touched].filter(id=>old.has(id)&&current.has(id)&&stateKey(old.get(id))!==stateKey(current.get(id)));
    const items=(b?.summary?.groups||[]).flatMap(g=>g.items).filter(i=>collected.includes(i.id));
    let cycle=null;
    if(items.length){
     const previous=[...doc.events].reverse().find(e=>e.run===run&&e.kind==='collection');
     const due=Math.min(...items.map(i=>Number(old.get(i.id)?.state?.next_state_transition_at)||at/1000));
     const alreadyCollected=previous&&doc.events.some(e=>e.run===run&&e.kind==='collection'&&e.cycle===previous.cycle&&items.some(i=>e.collected?.includes(i.id)));
     const same=previous&&Math.abs(due-(previous.cycleDue??previous.due))<=3600&&at-(previous.cycleAt??previous.at)<10*3600*1000&&!alreadyCollected;
     cycle=same?previous.cycle:(previous?.cycle||0)+1;
     const estimate=Object.fromEntries(root.FoeQuantum.KEYS.map(k=>[k,items.reduce((sum,i)=>sum+(i.production?.[k]||0),0)]));
     doc.events.push({id:crypto.randomUUID(),at,run,kind:'collection',cycle,due,cycleDue:same?(previous.cycleDue??previous.due):due,cycleAt:same?(previous.cycleAt??previous.at):at,collected:items.map(i=>i.id),estimate,changes:diff,before:b,after:a});
    }else if(first||!b?.map||diff.length||collected.length){
     doc.events.push({id:crypto.randomUUID(),at,run,kind:first||!b?.map?'baseline':'change',changes:diff,collected,before:first?null:b,after:a});
    }else return;
    await save();
   });
  }
  return {observe,ready:()=>queue,get error(){return error;},get document(){return copy(doc);},set onChange(fn){onchange=fn;},
   export(){return JSON.stringify({exportedAt:new Date(now()).toISOString(),...copy(doc)},null,2);},
   relabel(id,split){return enqueue(async()=>{
    const event=doc?.events.find(e=>e.id===id);if(!event||event.kind!=='collection')return;
    const list=doc.events.filter(e=>e.run===event.run&&e.kind==='collection'),i=list.indexOf(event),prev=list[i-1];if(!prev)return;
    const delta=(split?prev.cycle+1:prev.cycle)-event.cycle;
    for(let n=i;n<list.length;n++)list[n].cycle+=delta;
    const anchors=new Map();for(const e of list){if(!anchors.has(e.cycle))anchors.set(e.cycle,e);const anchor=anchors.get(e.cycle);e.cycleDue=anchor.due;e.cycleAt=anchor.at;}
    event.manuallyGrouped=true;await save();
   });}
  };
 }
 const labels={added:'Dodano budynek',removed:'Usunięto budynek',changed:'Zmieniono budynek',completed:'Ukończono budowę',connection:'Zmieniono połączenie z drogą',expansion:'Powiększono osadę'};
 function mount({root:host,button,history}){
  const el=(tag,parent,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent?.append(n);return n;};
  const dialog=el('dialog',host);dialog.setAttribute('aria-label','Historia zbiorów');
  dialog.style.cssText='color:#e7eeee;background:#102126;border:1px solid #56727b;padding:18px;width:min(900px,90vw);max-height:85vh;overflow:auto;pointer-events:auto;font:13px/1.5 system-ui';
  const top=el('div',dialog);top.style.cssText='display:flex;gap:12px;align-items:center;flex-wrap:wrap';el('h2',top,'Historia zbiorów');
  const download=el('button',top,'Eksport JSON'),close=el('button',top,'Zamknij');close.onclick=()=>dialog.close();
  const status=el('p',dialog),list=el('div',dialog);let limit=30;
  const num=v=>Number.isFinite(v)?v.toLocaleString('pl-PL'):'—';
  const resources={guild_raids_money:'🪙 Monety',guild_raids_supplies:'🔨 Zaopatrzenie',guild_raids_chrono_alloy:'🔩 Stop',guild_raids_rope:'➰ Liny',guild_raids_happiness:'😊 Zadowolenie',guild_raids_population:'👥 Populacja',guild_raids_action_points_collection:'⚡ Akcje/h',guild_raids_action_points_capacity:'Pojemność akcji',att_def_boost_attacker:'Atak',att_def_boost_defender:'Obrona'};
  function table(parent,title,rows,keys,totals){
   el('h4',parent,title);const t=el('table',parent);t.style.cssText='width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums';
   const head=el('tr',t);for(const label of ['Budynek',...keys.map(k=>resources[k]||k)])el('th',head,label);
   for(const r of [...rows,...(totals?[{name:'Suma',values:totals}]:[])]){
    const tr=el('tr',t);if(r.dim)tr.style.opacity='.5';
    el('td',tr,(r.dim?'🚧 ':'')+(r.count?r.count+'× ':'')+r.name);
    for(const k of keys){const cell=el('td',tr,num(r.values?.[k]??0));cell.style.cssText='text-align:right;padding:3px 7px;border-bottom:1px solid #29434b';}
   }
  }
  function snapshot(parent,snap){
   if(!snap)return;const s=snap.summary;if(!s){el('p',parent,'Brak podsumowania');return;}
   const q=root.FoeQuantum;
   el('p',parent,'Najazd: '+(s.raid?.name||'—')+' · Trudność: '+(s.raid?.difficulty??'—')+' · Koniec: '+(s.raid?.endsAt?new Date(s.raid.endsAt*1000).toLocaleString('pl-PL'):'—'));
   el('p',parent,Object.entries(s.wallet||{}).map(([k,v])=>(resources[k]||k)+': '+num(v)).join(' · '));
   el('p',parent,'Bonus monet: '+s.bonuses.coins+'% · Zaopatrzenie: '+s.bonuses.supplies+'% · Akcje/h: '+num(s.actionsPerHour)+' · Walki/h: '+num(s.actionsPerHour/3500)+' · Możliwe liny: '+num(s.ropeCapacity));
   el('p',parent,'Populacja: '+num(s.currentBonuses.population)+' · Zadowolenie: '+num(s.currentBonuses.happiness)+' · Euforia: '+(s.currentBonuses.euphoria?'150%':s.currentBonuses.unhappy?'niska':'100%'));
   if(s.missing.length)el('p',parent,'Niepełne definicje budynków: '+s.missing.length);
   for(const g of s.groups)table(parent,'Zbiory — prognoza na '+new Date(g.at*1000).toLocaleString('pl-PL'),q.groupedBuildings(g.items).map(r=>({...r,values:r.production})),q.KEYS,g.production);
   const builds=q.groupedBuildings(s.builds.filter(b=>b.hasProduction)).map(r=>({...r,dim:true,values:r.production}));
   table(parent,'Zestawienie',q.groupedBuildings(s.groups.flatMap(g=>g.items)).map(r=>({...r,values:r.production})).concat(builds),q.KEYS,s.totals);
   if(builds.length)table(parent,'Suma z budową',[{name:'Suma z budową',dim:true,values:Object.fromEntries(q.KEYS.map(k=>[k,s.totals[k]+builds.reduce((sum,b)=>sum+(b.values[k]||0),0)]))}],q.KEYS);
   const extras=q.groupedExtras(s.extras),future=q.groupedExtras(s.builds.filter(b=>!b.hasProduction));
   const totals=Object.fromEntries(q.EXTRA_KEYS.map(k=>[k,extras.reduce((sum,b)=>sum+(b.effects[k]||0),0)]));
   table(parent,'Pozostałe budynki',extras.map(r=>({...r,values:r.effects})).concat(future.map(r=>({...r,dim:true,values:r.effects}))),q.EXTRA_KEYS,totals);
   if(future.length)table(parent,'Suma pozostałych z budową',[{name:'Suma z budową',dim:true,values:Object.fromEntries(q.EXTRA_KEYS.map(k=>[k,totals[k]+future.reduce((sum,b)=>sum+(b.effects[k]||0),0)]))}],q.EXTRA_KEYS);
   if(s.builds.length){el('h4',parent,'W budowie');for(const b of s.builds)el('p',parent,b.name+' · '+(b.at?new Date(b.at*1000).toLocaleString('pl-PL'):'—')+' · '+b.benefits);}
   const raw=el('details',parent);el('summary',raw,'Pełny zapis stanu i układu');el('pre',raw,JSON.stringify(snap,null,2)).style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
  }
  function paint(){
   if(!dialog.open)return;const doc=history.document;list.replaceChildren();
   status.textContent=history.error||'Historia lokalna. Pierwszy zapis jest punktem odniesienia; działań sprzed uruchomienia nie odtwarzamy. Przesunięcia nie tworzą wpisów. Kwoty zbiorów są prognozą z zapisanego stanu. Odbiory partiami mają ten sam numer zbioru.';
   download.disabled=!doc?.events.length;
   if(!doc?.events.length){el('p',list,'Brak historii. Otwórz osadę kwantową w grze.');return;}
   const last=doc.events.at(-1),cycles=doc.events.filter(e=>e.run===last.run&&e.kind==='collection');
   el('p',list,'Licznik zbiorów bieżącego najazdu: '+(cycles.at(-1)?.cycle||0)+' · Zapisane działania: '+doc.events.length);
   for(const event of doc.events.slice(-limit).reverse()){
    const details=el('details',list);details.style.cssText='border-top:1px solid #345058;padding:10px 0';
    const title=event.kind==='collection'?'Zbiór '+event.cycle:event.kind==='baseline'?'Początek obserwacji':'Zmiany osady';
    el('summary',details,title+' · '+new Date(event.at).toLocaleString('pl-PL'));
    details.addEventListener('toggle',()=>{if(!details.open||details.dataset.built)return;details.dataset.built='1';
     const savedItems=[...(event.after?.summary?.groups||[]).flatMap(g=>g.items),...(event.before?.summary?.groups||[]).flatMap(g=>g.items),...(event.after?.summary?.extras||[]),...(event.before?.summary?.extras||[]),...(event.after?.summary?.builds||[]),...(event.before?.summary?.builds||[])];
     for(const change of event.changes||[])el('p',details,(labels[change.kind]||change.kind)+(change.building?' · '+(savedItems.find(i=>i.cityentity_id===change.building)?.name||change.building):''));
     if(event.collected?.length)el('p',details,'Odbiór z budynków: '+event.collected.join(', '));
     if(event.estimate)el('p',details,'Prognoza odebranej produkcji: '+Object.entries(event.estimate).map(([k,v])=>(resources[k]||k)+' '+num(v)).join(' · '));
     if(event.kind==='collection')for(const [label,split] of [['Połącz z poprzednim zbiorem',false],['Rozpocznij nowy zbiór',true]]){const b=el('button',details,label);b.onclick=()=>history.relabel(event.id,split);}
     for(const [label,snap] of [['Przed działaniem',event.before],['Po działaniu',event.after]])if(snap){const d=el('details',details);el('summary',d,label);d.addEventListener('toggle',()=>{if(d.open&&!d.dataset.built){d.dataset.built='1';snapshot(d,snap);}});}
    });
   }
   if(doc.events.length>limit){const more=el('button',list,'Pokaż starsze');more.onclick=()=>{limit+=30;paint();};}
  }
  button.onclick=async()=>{dialog.showModal();status.textContent='Wczytywanie historii…';await history.ready();paint();};
  dialog.addEventListener('close',()=>button.focus());history.onChange=paint;
  download.onclick=async()=>{await history.ready();const blob=new Blob([history.export()],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=el('a',dialog);link.href=url;link.download='najazdy-kwantowe-historia-'+new Date().toISOString().slice(0,10)+'.json';link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 root.FoeQuantumHistory={create,changes,mount};if(typeof module!=='undefined')module.exports=root.FoeQuantumHistory;
})(globalThis);
