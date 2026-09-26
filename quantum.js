(function(root){
 const KEYS=['guild_raids_money','guild_raids_supplies','guild_raids_chrono_alloy'];
 const empty=()=>Object.fromEntries(KEYS.map(k=>[k,0]));
 const categoryOrder=['main_building','residential','production','goods','culture','decoration'];
 function groupedBuildings(items){const groups=new Map();for(const item of items){const key=item.cityentity_id||item.name;let g=groups.get(key);if(!g){g={name:item.name,category:item.category,count:0,production:empty()};groups.set(key,g);}g.count++;for(const k of KEYS)g.production[k]+=item.production[k];}return [...groups.values()].sort((a,b)=>(categoryOrder.indexOf(a.category)<0?99:categoryOrder.indexOf(a.category))-(categoryOrder.indexOf(b.category)<0?99:categoryOrder.indexOf(b.category))||a.name.localeCompare(b.name,'pl'));}
 function isSettlementResponse(data){return (Array.isArray(data)?data:[data]).some(r=>r?.requestClass==='CityMapService'&&r.requestMethod==='getCityMap'&&r.responseData?.gridId==='guild_raids');}
 function walk(data,fn){const q=[data];for(let i=0;i<q.length&&i<250000;i++){const v=q[i];if(!v||typeof v!=='object')continue;fn(v);for(const c of Object.values(v))if(c&&typeof c==='object')q.push(c);}}
 function products(option){const sum=empty();for(const p of option?.products||[]){const r=p.playerResources?.resources;if(r)for(const k of KEYS)sum[k]+=Number(r[k])||0;}return sum;}
 function createTracker(){
  const definitions=new Map();let map=null,raid=null,wallet={},version=0;
  function consume(data,{fallback=false}={}){
   walk(data,v=>{
    if(v.__class__==='GenericCityEntity'&&typeof v.id==='string'&&v.components){if(!fallback||!definitions.has(v.id))definitions.set(v.id,v);version++;}
    if(v.gridId==='guild_raids'&&Array.isArray(v.entities)){map=v;version++;}
    if(v.__class__==='GuildRaidsRunningState'){raid={name:v.raidInstance?.raidName,difficulty:v.raidInstance?.difficultyLevel,endsAt:v.endsAt};version++;}
    if(v.__class__==='ResourceBag'){
     const r=v.resources?.resources||v.resources;
     if(r&&KEYS.some(k=>Object.hasOwn(r,k))){for(const [k,n] of Object.entries(r))if(k.startsWith('guild_raids_')&&typeof n==='number')wallet[k]=n;version++;}
    }
   });
   // Known entities may be replaced by typed updates; a fresh map handles removals.
   if(map)walk(data,v=>{if(v.__class__==='CityMapEntity'&&typeof v.cityentity_id==='string'&&v.cityentity_id.includes('GuildRaids')){
    const i=map.entities.findIndex(e=>e.id===v.id);if(i>=0&&map.entities[i]!==v){map={...map,entities:map.entities.map((e,n)=>n===i?{...e,...v}:e)};version++;}
   }});
   return version;
  }
  function component(e){return definitions.get(e.cityentity_id)?.components?.AllAge;}
  function summary(now=Date.now()/1000){
   if(!map)return null;
   const missing=new Set(),items=[],builds=[];
   for(const e of map.entities){
    if(e.cityentity_id.includes('Impediment'))continue;
    const def=definitions.get(e.cityentity_id),c=component(e),s=e.state||{},name=e.cityentity_id==='H_GuildRaidsEarlyMiddleAge_Townhall'||e.type==='main_building'?'Ratusz':def?.name||e.cityentity_id;
    if(!def&&e.type!=='main_building')missing.add(e.cityentity_id);
    if(s.__class__==='ConstructionState'){builds.push({name,at:s.next_state_transition_at||null});continue;}
    const ready=s.__class__==='ProductionFinishedState'||s.__class__==='ProductionReadyState';
    if(s.__class__!=='ProducingState'&&!ready)continue;
    let raw=products(s.productionOption);
    if(!KEYS.some(k=>raw[k])){
     const r=s.current_product?.product?.resources;
     if(r)raw=Object.fromEntries(KEYS.map(k=>[k,Number(r[k])||0]));
     else {const options=c?.production?.options||[];if(options.length===1)raw=products(options[0]);}
    }
    if(!KEYS.some(k=>raw[k]))continue;
    if(e.connected===0)continue;
    const at=ready?now:Number(s.next_state_transition_at);
    if(!Number.isFinite(at))continue;
    items.push({id:e.id,name,cityentity_id:e.cityentity_id,category:e.type==='main_building'?'main_building':c?.constructionMenu?.category,at:Math.max(now,at),raw,hall:e.type==='main_building',x:e.x,y:e.y});
   }
   items.sort((a,b)=>a.at-b.at);
   const groups=[];
   for(const item of items){let group=groups.at(-1);if(!group||item.at-group.at>3600){group={at:item.at,items:[],production:empty()};groups.push(group);}group.at=item.at;group.items.push(item);}
   function bonuses(at){let population=0,happiness=0,coins=0,supplies=0;
    for(const e of map.entities){if(e.connected===0)continue;const c=component(e);if(!c)continue;
     if(e.state?.__class__==='ConstructionState'&&(!e.state.next_state_transition_at||e.state.next_state_transition_at>at))continue;
     const r=c.staticResources?.resources?.resources||{};population+=Math.max(0,Number(r.guild_raids_population)||0);happiness+=Number(r.guild_raids_happiness)||0;
     for(const b of c.boosts?.boosts||[]){if(b.type==='guild_raids_coins_production')coins+=b.value;if(b.type==='guild_raids_supplies_production')supplies+=b.value;}
    }
    // 100% is the conservative base below euphoria; severe unhappiness is flagged.
    return {population,happiness,coins,supplies,euphoria:happiness>=population*2,multiplier:happiness>=population*2?1.5:1,unhappy:happiness<population};
   }
   const totals=empty();
   for(const g of groups){g.bonuses=bonuses(g.at);for(const item of g.items){item.production=empty();for(const k of KEYS){
    const boost=k===KEYS[0]?g.bonuses.coins:k===KEYS[1]?g.bonuses.supplies:0;
    // Production boosts and the +50% euphoria bonus add to the base.
    const value=item.hall?item.raw[k]:Math.round(item.raw[k]*(g.bonuses.multiplier+boost/100));
    item.production[k]=value;g.production[k]+=value;totals[k]+=value;
   }}}
   let actionsPerHour=5000;
   for(const e of map.entities){if(e.connected===0)continue;for(const b of component(e)?.boosts?.boosts||[])if(b.type==='guild_raids_action_points_collection')actionsPerHour+=Number(b.value)||0;}
   return {groups,totals,builds,missing:[...missing],actionsPerHour,raid,wallet:{...wallet},bonuses:bonuses(groups.at(-1)?.at||now),entityCount:map.entities.filter(e=>!e.cityentity_id.includes('Impediment')).length};
  }
  return {consume,summary,definitions,get map(){return map;}};
 }
 const api={createTracker,KEYS,groupedBuildings,isSettlementResponse,calculationVersion:2};root.FoeQuantum=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
