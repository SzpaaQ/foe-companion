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
    if(profile!==key){const loaded=await storage.load(key);doc=loaded||{schemaVersion:1,world,playerId:player,events:[]};profile=key;}
    const run=String(a.summary?.raid?.endsAt||a.map.entities.find(e=>e.type==='main_building')?.id||'unknown');
    const diff=b?.map?changes(b,a).filter(c=>c.kind!=='completed'):[];
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
    }else if(diff.length){
     doc.events.push({id:crypto.randomUUID(),at,run,kind:'change',changes:diff,collected,before:b,after:a});
    }else return;
    await save();
   });
  }
  return {observe,ready:()=>queue,get error(){return error;},get document(){return copy(doc);},set onChange(fn){onchange=fn;},
   export(){return JSON.stringify({exportedAt:new Date(now()).toISOString(),...copy(doc)},null,2);},
   remove(ids){return enqueue(async()=>{if(!doc)return;const selected=new Set(ids);doc.events=doc.events.filter(e=>!selected.has(e.id));await save();});},
   editRows(refs,note){return enqueue(async()=>{
    for(const ref of refs){const e=doc?.events.find(e=>e.id===ref.id);if(e)(e.notes||={})[ref.key]=String(note).slice(0,2000);}
    if(doc)await save();
   });},
   removeRows(refs){return enqueue(async()=>{
    for(const ref of refs){const e=doc?.events.find(e=>e.id===ref.id);if(e){e.hiddenRows||=[];if(!e.hiddenRows.includes(ref.key))e.hiddenRows.push(ref.key);}}
    if(doc){doc.events=doc.events.filter(e=>actionRows([e]).length);await save();}
   });},
   merge(id){return enqueue(async()=>{
    if(!doc)return;const groups=groupEvents(doc.events),index=groups.findIndex(g=>g.id===id),selected=groups[index];
    if(!selected)return;
    const previous=groups.slice(0,index).reverse().find(g=>g.run===selected.run&&g.kind==='collection');
    if(!previous)return;
    const groupId=previous.groupId||previous.id,start=groups.indexOf(previous);
    const ids=new Set(groups.slice(start,index+1).filter(g=>g.run===selected.run).flatMap(g=>g.actions.map(e=>e.id)));
    const delta=selected.kind==='collection'?selected.cycle-previous.cycle:0;
    for(const e of doc.events){
     if(ids.has(e.id)){e.groupId=groupId;e.manuallyGrouped=true;if(e.kind==='collection')e.cycle=previous.cycle;}
     else if(delta>0&&e.run===selected.run&&e.kind==='collection'&&e.at>selected.endAt)e.cycle-=delta;
    }
    await save();
   });},
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
 // Group only the presentation; the export retains every observed action.
 function groupEvents(events){
  const groups=[];
  for(const e of events){
   const previous=groups.at(-1);
   const near=previous&&e.run===previous.run&&e.at-previous.endAt<=30*60*1000&&e.at-previous.at<2*3600*1000;
   const explicit=previous&&e.run===previous.run&&e.groupId&&e.groupId===previous.groupId;
   const same=explicit||(near&&(!e.groupId||!previous.groupId||e.groupId===previous.groupId)&&e.kind!=='baseline'&&previous.kind!=='baseline'&&(e.kind==='change'||(e.kind==='collection'&&previous.kind==='collection'&&e.cycle===previous.cycle)));
   if(!same){groups.push({...e,endAt:e.at,changes:[...(e.changes||[])],actions:[e]});continue;}
   previous.endAt=e.at;previous.after=e.after;previous.changes.push(...(e.changes||[]));previous.actions.push(e);
  }
  return groups;
 }
 const labels={added:'Dodano budynek',removed:'Usunięto budynek',changed:'Zmieniono budynek',completed:'Ukończono budowę',connection:'Zmieniono połączenie z drogą',expansion:'Kupuję rozszerzenie'};
 // Stable per-building row keys preserve notes when adjacent actions are grouped.
 function actionRows(actions){
  const rows=[];
  for(const action of actions){
   if(action.kind==='baseline')continue;
   const snaps=[action.before,action.after];
   const items=snaps.flatMap(s=>[...(s?.summary?.groups||[]).flatMap(g=>g.items),...(s?.summary?.builds||[]),...(s?.summary?.extras||[])]);
   const maps=snaps.flatMap(s=>s?.map?.entities||[]);
   const entries=(action.changes||[]).flatMap((c,i)=>c.kind==='completed'?[]:[{...c,key:'change:'+i}]);
   for(const id of action.collected||[]){const entity=maps.find(e=>e.id===id),item=items.find(e=>e.id===id);const building=entity?.cityentity_id||item?.cityentity_id;
    if(building)entries.push({kind:'collection',id,building,key:'collection:'+id});
   }
   for(const entry of entries){
    if(action.hiddenRows?.includes(entry.key))continue;
    const name=items.find(i=>i.cityentity_id===entry.building)?.name||entry.building||labels[entry.kind]||entry.kind;
    const note=action.notes?.[entry.key]||'';
    const previous=rows.at(-1),ref={id:action.id,key:entry.key};
    if(previous&&previous.run===action.run&&previous.kind===entry.kind&&previous.building===entry.building&&entry.building&&previous.note===note&&action.at-previous.endAt<=120000){previous.count++;previous.endAt=action.at;previous.refs.push(ref);}
    else rows.push({kind:entry.kind,building:entry.building,name,note,at:action.at,endAt:action.at,run:action.run,count:1,refs:[ref]});
   }
  }
  return rows;
 }
 // Collapse uninterrupted runs of the same operation, aggregating all building types.
 function actionRuns(actions){
  const runs=[];
  for(const row of actionRows(actions)){
   let run=runs.at(-1);
   if(!run||run.run!==row.run||run.kind!==row.kind){
    run={kind:row.kind,run:row.run,at:row.at,endAt:row.endAt,buildings:[],refs:[],notes:[]};runs.push(run);
   }
   run.endAt=row.endAt;run.refs.push(...row.refs);
   if(row.note&&!run.notes.includes(row.note))run.notes.push(row.note);
   const building=run.buildings.find(b=>b.building===row.building&&b.name===row.name);
   if(building){building.count+=row.count;building.refs.push(...row.refs);}
   else run.buildings.push({building:row.building,name:row.name,count:row.count,refs:[...row.refs]});
  }
  return runs.map(run=>({...run,note:run.notes.join(' · ')}));
 }
 function mount({root:host,button,history,getWidth=()=>350}){
  const el=(tag,parent,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent?.append(n);return n;};
  const dialog=el('dialog',host);dialog.setAttribute('aria-label','Historia zbiorów');
  dialog.style.cssText='color:#e7eeee;background:#102126;border:1px solid #56727b;padding:14px;box-sizing:border-box;width:min(1100px,96vw);max-width:96vw;max-height:85vh;overflow:auto;scrollbar-gutter:stable;pointer-events:auto;font:11px/1.35 system-ui';
  const smallButton=(parent,label,handler)=>{const b=el('button',parent,label);b.style.cssText='font:11px/1.2 system-ui;padding:2px 5px;margin:0 0 0 5px;min-width:0';b.onclick=event=>{event?.preventDefault();event?.stopPropagation();return handler();};return b;};
  const top=el('div',dialog);top.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap';el('h2',top,'Historia zbiorów').style.cssText='font-size:14px;margin:4px 0';
  const download=smallButton(top,'Eksport JSON',()=>{}),close=smallButton(top,'×',()=>dialog.close());
  download.style.marginLeft='auto';close.setAttribute('aria-label','Zamknij historię');close.title='Zamknij historię';close.style.cssText='border:0;background:transparent;color:inherit;font-size:24px;padding:0 5px;cursor:pointer';
  const css=el('style',dialog);css.textContent='.qh-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.qh-compare>div{min-width:0;overflow-wrap:anywhere}@media(max-width:600px){.qh-compare{grid-template-columns:1fr}}';
  const status=el('p',dialog),list=el('div',dialog);let limit=30;
  const num=v=>Number.isFinite(v)?v.toLocaleString('pl-PL'):'—';
  const resources={guild_raids_money:'🪙 Monety',guild_raids_supplies:'🔨 Zaopatrzenie',guild_raids_chrono_alloy:'🔩 Stop',guild_raids_rope:'➰ Liny',guild_raids_happiness:'😊 Zadowolenie',guild_raids_population:'👥 Populacja',guild_raids_action_points_collection:'⚡ Akcje/h',guild_raids_action_points_capacity:'Pojemność akcji',att_def_boost_attacker:'Atak',att_def_boost_defender:'Obrona'};
  function snapshot(parent,snap){
   if(!snap?.summary)return;
   const summary=snap.summary,FoeQuantum=root.FoeQuantum;
   const wrap=el('div',parent);wrap.style.cssText='width:'+Math.round(getWidth()||350)+'px;max-width:100%;box-sizing:border-box;margin:8px auto 0;padding-right:8px;color:#e7eeee;line-height:1.4';
   const stockBox=el('div',wrap),groups=el('div',wrap);
   const $=id=>id==='quantum-summary'?stockBox:groups;
   const text=(parent,value,tag='p')=>el(tag,parent,value);
      const box=$('quantum-summary');box.style.cssText='font-size:13px;line-height:1.4;color:#f0e6d2;margin-bottom:12px';
      const stocks=text(box,'','div');stocks.style.cssText='display:flex;flex-wrap:wrap;gap:10px;font-weight:bold;border-bottom:1px solid #4a3525;padding-bottom:6px;margin-bottom:8px';
      const num=n=>Number.isFinite(n)?n.toLocaleString('pl-PL'):'—';
      for(const [key,icon] of [['guild_raids_money','🪙'],['guild_raids_supplies','🔨'],['guild_raids_chrono_alloy','🔩'],['guild_raids_rope','➰']]){
        const node=text(stocks,icon+' '+num(summary.wallet[key]),'span');
        if(key==='guild_raids_rope')node.title=summary.ropeCapacity===null?'Brak danych do obliczenia produkcji lin.':'Z obecnych zapasów można wyprodukować maksymalnie '+num(summary.ropeCapacity)+' lin, łącząc dostępne paczki. Kalkulacja kosztów, bez kosztu budowy wytwórni.';
      }
      const mood=text(stocks,'✨ '+(summary.currentBonuses.euphoria?'150%':summary.currentBonuses.unhappy?'niska':'100%'),'span');mood.style.color=summary.currentBonuses.euphoria?'#4caf50':'#dfd1b8';
      const hourly=text(box,'🪙 +'+summary.bonuses.coins+'% / 🔨 +'+summary.bonuses.supplies+'% · ⚡ '+num(summary.actionsPerHour)+'/h · ⚔️ '+(summary.actionsPerHour/3500).toLocaleString('pl-PL',{maximumFractionDigits:2})+'/h','div');hourly.style.cssText='text-align:center;font-size:12px;color:#a99885;margin-bottom:8px';
      const table=document.createElement('table');table.style.cssText='background:#0b191e;border-radius:5px;width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px';box.append(table);
      const tr=document.createElement('tr');table.append(tr);text(tr,'Następny zbiór:','th');
      const next=summary.totals;
      for(const [key,icon] of [['guild_raids_money','🪙'],['guild_raids_supplies','🔨'],['guild_raids_chrono_alloy','🔩']]){const cell=text(tr,icon+' '+num(next?.[key]),'td');cell.style.cssText='padding:6px 4px;border-left:1px solid #4a3525;text-align:center;font-weight:bold';}

      const resourceValues=[summary.totals,...summary.groups.map(g=>g.production),...summary.groups.flatMap(g=>g.items.map(i=>i.production))];
      resourceValues.push(Object.fromEntries(FoeQuantum.KEYS.map(k=>[k,(summary.totals[k]||0)+summary.builds.reduce((sum,b)=>sum+(b.production?.[k]||0),0)])));
      const resourceColumns='minmax(0,1fr) '+FoeQuantum.KEYS.map(k=>Math.max(2,...resourceValues.map(v=>num(v[k]||0).length))+'ch').join(' ');
      const buildProduction=FoeQuantum.groupedBuildings(summary.builds.filter(b=>b.hasProduction)).map(item=>({...item,underConstruction:true}));
      const buildExtras=FoeQuantum.groupedExtras(summary.builds.filter(b=>!b.hasProduction&&FoeQuantum.EXTRA_KEYS.some(k=>b.effects[k]))).map(item=>({...item,underConstruction:true}));
      const constructionStyle=';opacity:0.5';
      const addConstructionTotal=(table,keys,totals,pending,field)=>{
        if(!pending.length)return;
        const label=text(table,'🚧 Suma z budową','span');label.style.cssText='font-weight:bold;padding:2px 0'+constructionStyle;
        label.title='Suma bieżących wierszy i budynków w budowie. Produkcja według bonusów zestawienia; bez przeliczania wpływu nowych budynków na pozostałe.';
        for(const key of keys){const value=(totals[key]||0)+pending.reduce((sum,item)=>sum+(item[field][key]||0)-(field==='effects'?(item.activeEffects?.[key]||0):0),0);const cell=text(table,value?num(value):'—','span');cell.style.cssText='text-align:right;font-weight:bold;padding:2px 0'+constructionStyle;}
      };
      // Zestawienie budynków i sumarycznej produkcji (domyślnie rozwinięte)
      if(summary.groups.length||buildProduction.length){
        const allItems=summary.groups.flatMap(g=>g.items);
        const grouped=[...FoeQuantum.groupedBuildings(allItems),...buildProduction];
        const sec=document.createElement('details');sec.open=true;sec.style.cssText='';
        const hrZ=document.createElement('hr');hrZ.style.cssText='border:none;border-top:1px solid #2e4450;margin:10px 0 6px';$('quantum-groups').append(hrZ);
        $('quantum-groups').append(sec);
        const secLabel=document.createElement('summary');secLabel.style.cssText='font-weight:bold;font-size:12px;cursor:pointer;color:#8fcfcf;margin-bottom:4px';secLabel.textContent='Zestawienie';sec.append(secLabel);
        const tbl=document.createElement('div');tbl.style.cssText='display:grid;grid-template-columns:'+resourceColumns+';gap:0 8px;font-size:11px;font-variant-numeric:tabular-nums;';sec.append(tbl);
        // Nagłówki
        for(const h of ['','🪙','🔨','🔩']){const hd=document.createElement('span');hd.textContent=h;hd.style.cssText='font-weight:bold;text-align:right;padding:1px 0;border-bottom:1px solid #4a3525';tbl.append(hd);}
        for(const item of grouped){
          const nameCell=document.createElement('span');const b=document.createElement('strong');b.textContent=item.count+'×';nameCell.append(b,' '+item.name+(item.underConstruction?' 🚧':''));nameCell.style.cssText='padding:1px 0'+(item.underConstruction?constructionStyle:'');if(item.underConstruction)nameCell.title='W budowie — bieżąca suma obejmuje tylko aktywne efekty.';tbl.append(nameCell);
          for(const k of FoeQuantum.KEYS){const c=document.createElement('span');c.textContent=item.production[k]?item.production[k].toLocaleString('pl-PL'):'—';c.style.cssText='text-align:right;padding:1px 0;color:'+(item.production[k]?'#f0e6d2':'#6a7a7e')+(item.underConstruction?constructionStyle:'');tbl.append(c);}
        }
        // Suma
        const totalsRow=document.createElement('span');totalsRow.textContent='Suma';totalsRow.style.cssText='font-weight:bold;padding:2px 0;border-top:1px solid #4a3525';tbl.append(totalsRow);
        for(const k of FoeQuantum.KEYS){const c=document.createElement('span');c.textContent=summary.totals[k]?summary.totals[k].toLocaleString('pl-PL'):'—';c.style.cssText='text-align:right;font-weight:bold;padding:2px 0;border-top:1px solid #4a3525';tbl.append(c);}
        addConstructionTotal(tbl,FoeQuantum.KEYS,summary.totals,buildProduction,'production');
      }
      // Sekcja: Pozostałe budynki (nieprodukcyjne — stałe efekty)
      if(summary.extras?.length||buildExtras.length){
        const grouped=[...FoeQuantum.groupedExtras(summary.extras||[]),...buildExtras];
        // Ustal dynamicznie które kolumny mają jakiekolwiek wartości != 0
        const extraColDefs=[
          {key:'guild_raids_happiness',    label:'😊', title:'Zadowolenie'},
          {key:'guild_raids_population',   label:'👥', title:'Populacja'},
          {key:'guild_raids_action_points_collection', label:'⚡', title:'Produkcja działań/h'},
          {key:'guild_raids_action_points_capacity',   label:'🔋', title:'Pojemność działań'},
          {key:'att_def_boost_attacker',   label:'🗡️', title:'Bonus ataku atakującego %'},
          {key:'att_def_boost_defender',   label:'🛡️', title:'Bonus obrony obrońcy %'},
        ];
        const activeCols=extraColDefs.filter(col=>grouped.some(g=>g.effects[col.key]!==0));
        if(activeCols.length){
          const sec2=document.createElement('details');sec2.open=true;sec2.style.cssText='';
          const hrP=document.createElement('hr');hrP.style.cssText='border:none;border-top:1px solid #2e4450;margin:10px 0 6px';$('quantum-groups').append(hrP);
          $('quantum-groups').append(sec2);
          const sec2Label=document.createElement('summary');sec2Label.style.cssText='font-weight:bold;font-size:12px;cursor:pointer;color:#8fcfcf;margin-bottom:4px';sec2Label.textContent='Pozostałe budynki';sec2.append(sec2Label);
          const tbl2=document.createElement('div');
          tbl2.style.cssText=`display:grid;grid-template-columns:1fr ${activeCols.map(()=>'auto').join(' ')};gap:0 8px;font-size:11px;font-variant-numeric:tabular-nums;`;
          sec2.append(tbl2);
          // Nagłówki
          const hName=document.createElement('span');hName.style.cssText='font-weight:bold;padding:1px 0;border-bottom:1px solid #4a3525';tbl2.append(hName);
          for(const col of activeCols){const hd=document.createElement('span');hd.textContent=col.label;hd.title=col.title;hd.style.cssText='font-weight:bold;text-align:right;padding:1px 0;border-bottom:1px solid #4a3525';tbl2.append(hd);}
          // Wiersze
          const extTotals=Object.fromEntries(FoeQuantum.EXTRA_KEYS.map(k=>[k,0]));
          for(const item of grouped){
            const nameCell=document.createElement('span');const b=document.createElement('strong');b.textContent=item.count+'×';nameCell.append(b,' '+item.name+(item.underConstruction?' 🚧':''));nameCell.style.cssText='padding:1px 0'+(item.underConstruction?constructionStyle:'');if(item.underConstruction)nameCell.title='W budowie — bieżąca suma obejmuje tylko aktywne efekty.';tbl2.append(nameCell);
            for(const col of activeCols){
              const v=item.effects[col.key]||0;
              const c=document.createElement('span');
              c.textContent=v?(item.count>1&&col.key!=='guild_raids_happiness'&&col.key!=='guild_raids_population'?v.toLocaleString('pl-PL'):v.toLocaleString('pl-PL')):'—';
              c.style.cssText='text-align:right;padding:1px 0;color:'+(v!==0?(v<0?'#e57373':'#f0e6d2'):'#6a7a7e')+(item.underConstruction&&!item.activeEffects?.[col.key]?constructionStyle:'');
              if(item.underConstruction&&item.activeEffects?.[col.key])c.title='Działa już podczas budowy.';
              tbl2.append(c);
              extTotals[col.key]+=item.underConstruction?(item.activeEffects?.[col.key]||0):v;
            }
          }
          // Suma
          const sumName=document.createElement('span');sumName.textContent='Suma';sumName.style.cssText='font-weight:bold;padding:2px 0;border-top:1px solid #4a3525';tbl2.append(sumName);
          for(const col of activeCols){const c=document.createElement('span');const v=extTotals[col.key];c.textContent=v?v.toLocaleString('pl-PL'):'—';c.style.cssText='text-align:right;font-weight:bold;padding:2px 0;border-top:1px solid #4a3525;color:'+(v<0?'#e57373':'#f0e6d2');tbl2.append(c);}
          addConstructionTotal(tbl2,activeCols.map(col=>col.key),extTotals,buildExtras,'effects');
        }
      }
  }
  let views=[];
  const childDetails=node=>Array.from(node.children||[]).flatMap(child=>child.tagName==='DETAILS'?[child]:childDetails(child));
  const remember=node=>({open:node.open,children:childDetails(node).map(remember)});
  function restore(node,state){
   if(!state)return;node.open=state.open;
   if(node.open)node.historyBuild?.();
   childDetails(node).forEach((child,i)=>restore(child,state.children[i]));
  }
  function paint(){
   if(!dialog.open)return;
   if((host.activeElement||document.activeElement)?.dataset?.historyNote==='1')return;
   const scrollTop=dialog.scrollTop,states=new Map();
   for(const view of views){const state=remember(view.node);for(const id of view.ids)states.set(id,state);}
   views=[];const doc=history.document;list.replaceChildren();
   status.textContent=history.error;status.hidden=!history.error;
   download.disabled=!doc?.events.length;
   if(!doc?.events.length){el('p',list,'Brak historii. Otwórz osadę kwantową w grze.');return;}
   const grouped=groupEvents(doc.events).filter(e=>actionRows(e.actions).length);
   for(const event of grouped.slice(-limit).reverse()){
    const details=el('details',list);details.style.cssText='background:#162e35;border:1px solid #345058;padding:5px 7px;margin:4px 0;border-radius:4px';
    views.push({node:details,ids:event.actions.map(e=>e.id)});
    const title=event.kind==='collection'?'Zbiór '+event.cycle:event.kind==='baseline'?'Początek obserwacji':'Żonglowanie';
    const heading=el('summary',details,title+' · '+new Date(event.at).toLocaleString('pl-PL'));
    const remove=smallButton(heading,'×',()=>history.remove(event.actions.map(e=>e.id)));remove.title='Usuń cały wpis';remove.setAttribute('aria-label','Usuń cały wpis');remove.style.float='right';
    const previous=grouped.slice(0,grouped.indexOf(event)).some(g=>g.run===event.run&&g.kind==='collection');
    if(event.kind!=='baseline'){const merge=smallButton(heading,'Połącz z poprzednim zbiorem',()=>history.merge(event.id));merge.disabled=!previous;}
    details.historyBuild=()=>{if(!details.open||details.dataset.built)return;details.dataset.built='1';
     const rows=actionRuns(event.actions).reverse();
     const actions=el('details',details);actions.style.cssText='background:#18333b;padding:6px 9px;margin:6px 0';el('summary',actions,'Działania ('+rows.length+')');
     for(const action of rows){
      const row=el('div',actions);row.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:5px 0;border-bottom:1px solid #29434b';
      el('span',row,new Date(action.at).toLocaleTimeString('pl-PL'));
      const label={added:'Stawiam:',removed:'Sprzedaję:',collection:'Zbieram:',changed:'Zmieniam:',connection:'Połączenie:'}[action.kind]||'';
      const description=el('span',row);description.style.cssText='min-width:0;overflow-wrap:anywhere';
      if(label)el('span',description,label+' ');
      action.buildings.forEach((building,index)=>{
       if(index)el('span',description,' · ');
       el('strong',description,(building.building?building.count+'× ':'')+building.name);
      });
      const input=el('input',row);input.type='text';input.dataset.historyNote='1';input.onblur=()=>Promise.resolve().then(paint);input.value=action.note;input.placeholder='Dopisz uwagę…';input.maxLength=2000;input.setAttribute('aria-label','Uwagi: '+action.buildings.map(b=>b.name).join(', '));
      input.style.cssText='flex:1;min-width:100px;max-width:100%;background:transparent;color:inherit;border:0;border-bottom:1px solid #45636b;font:inherit;padding:4px;text-align:right';
      input.onchange=()=>history.editRows(action.refs,input.value);
      const remove=smallButton(row,'×',()=>history.removeRows(action.refs));remove.title='Usuń działanie';remove.setAttribute('aria-label','Usuń działanie');
     }
     const comparison=el('details',details);el('summary',comparison,'Przed i Po');
     comparison.historyBuild=()=>{if(!comparison.open||comparison.dataset.built)return;comparison.dataset.built='1';const columns=el('div',comparison);columns.className='qh-compare';
      for(const [label,snap] of [['Przed',event.before],['Po',event.after]]){const column=el('div',columns);el('h3',column,label).style.textAlign='center';if(snap)snapshot(column,snap);else el('p',column,'Brak zapisanego stanu.');}
     };comparison.addEventListener('toggle',comparison.historyBuild);
    };
    details.addEventListener('toggle',details.historyBuild);
    restore(details,event.actions.map(e=>states.get(e.id)).find(Boolean));
   }
   if(grouped.length>limit){const more=el('button',list,'Pokaż starsze');more.onclick=()=>{limit+=30;paint();};}
   dialog.scrollTop=scrollTop;
  }
  button.onclick=async()=>{dialog.style.width='min('+Math.max(900,2*(getWidth()||350)+120)+'px,96vw)';dialog.showModal();status.textContent='Wczytywanie historii…';await history.ready();paint();};
  dialog.addEventListener('close',()=>button.focus());history.onChange=paint;
  download.onclick=async()=>{await history.ready();const blob=new Blob([history.export()],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=el('a',dialog);link.href=url;link.download='najazdy-kwantowe-historia-'+new Date().toISOString().slice(0,10)+'.json';link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 root.FoeQuantumHistory={create,changes,groupEvents,actionRows,actionRuns,mount};if(typeof module!=='undefined')module.exports=root.FoeQuantumHistory;
})(globalThis);
