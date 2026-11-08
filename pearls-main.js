(function(root){
 'use strict';
 // Fallback: game metadata, perla-maraton.har, 2026-11-05. Live metadata takes precedence.
 const tierCatalog={
  "X_FutureEra_Landmark1":{"name":"Arka","maxTier":"gold"},
  "X_ArcticFuture_Landmark3":{"name":"Bank Nasion","maxTier":"gold"},
  "X_ArcticFuture_Landmark2":{"name":"Arktyczna Oranżeria","maxTier":"gold"},
  "X_SpaceAgeSpaceHub_Landmark1":{"name":"Gwiezdny okręt wojenny","maxTier":"copper"},
  "X_ProgressiveEra_Landmark2":{"name":"Château Frontenac","maxTier":"gold"},
  "X_OceanicFuture_Landmark3":{"name":"Błękitna Galaktyka","maxTier":"gold"},
  "X_AllAge_Expedition":{"name":"Świątynia Reliktów","maxTier":"copper"},
  "X_VirtualFuture_Landmark2":{"name":"Zamek Himeji","maxTier":"gold"},
  "X_AllAge_EasterBonus4":{"name":"Obserwatorium","maxTier":"gold"},
  "X_AllAge_Oracle":{"name":"Wyrocznia Delficka","maxTier":"copper"},
  "X_ArcticFuture_Landmark1":{"name":"Gaja","maxTier":"copper"},
  "X_BronzeAge_Landmark1":{"name":"Wieża Babel","maxTier":"copper"},
  "X_BronzeAge_Landmark2":{"name":"Posąg Zeusa","maxTier":"gold"},
  "X_ColonialAge_Landmark1":{"name":"Drezdeński Kościół Mariacki","maxTier":"copper"},
  "X_ColonialAge_Landmark2":{"name":"Zamek z Deal","maxTier":"gold"},
  "X_ContemporaryEra_Landmark1":{"name":"Świątynia Lotosu","maxTier":"gold"},
  "X_ContemporaryEra_Landmark2":{"name":"Wieża Innowacji","maxTier":"copper"},
  "X_EarlyMiddleAge_Landmark1":{"name":"Hagia Sophia","maxTier":"copper"},
  "X_EarlyMiddleAge_Landmark2":{"name":"Katedra Akwizgrańska","maxTier":"gold"},
  "X_EarlyMiddleAge_Landmark3":{"name":"Wieża Galaty","maxTier":"copper"},
  "X_FutureEra_Landmark2":{"name":"Strażnik Żywiołów","maxTier":"copper"},
  "X_HighMiddleAge_Landmark1":{"name":"Bazylika św. Marka","maxTier":"gold"},
  "X_HighMiddleAge_Landmark3":{"name":"Notre Dame","maxTier":"copper"},
  "X_IndustrialAge_Landmark1":{"name":"Royal Albert Hall","maxTier":"gold"},
  "X_IndustrialAge_Landmark2":{"name":"Kapitol","maxTier":"copper"},
  "X_IronAge_Landmark1":{"name":"Koloseum","maxTier":"gold"},
  "X_IronAge_Landmark2":{"name":"Latarnia z Faros","maxTier":"copper"},
  "X_LateMiddleAge_Landmark1":{"name":"Cerkiew Wasyla Błogosławionego","maxTier":"copper"},
  "X_LateMiddleAge_Landmark3":{"name":"Castel del Monte","maxTier":"gold"},
  "X_ModernEra_Landmark1":{"name":"Space Needle","maxTier":"copper"},
  "X_ModernEra_Landmark2":{"name":"Atomium","maxTier":"copper"},
  "X_OceanicFuture_Landmark1":{"name":"Muzeum Atlantydy","maxTier":"copper"},
  "X_OceanicFuture_Landmark2":{"name":"Kraken","maxTier":"gold"},
  "X_PostModernEra_Landmark1":{"name":"Przylądek Canaveral","maxTier":"copper"},
  "X_PostModernEra_Landmark2":{"name":"Habitat","maxTier":"copper"},
  "X_ProgressiveEra_Landmark1":{"name":"Alcatraz","maxTier":"gold"},
  "X_SpaceAgeAsteroidBelt_Landmark1":{"name":"Kosmiczny Transporter","maxTier":"gold"},
  "X_SpaceAgeJupiterMoon_Landmark1":{"name":"Rdzeń SI","maxTier":"copper"},
  "X_SpaceAgeMars_Landmark1":{"name":"Tropiciel Gwiazd","maxTier":"copper"},
  "X_SpaceAgeMars_Landmark2":{"name":"Projekt Virgo","maxTier":"gold"},
  "X_SpaceAgeSpaceHub_Landmark2":{"name":"Kosmiczny katalizator","maxTier":"copper"},
  "X_SpaceAgeTitan_Landmark1":{"name":"Saturn VI: wrota CENTAUR","maxTier":"copper"},
  "X_SpaceAgeTitan_Landmark2":{"name":"Saturn VI: wrota PEGAZ","maxTier":"copper"},
  "X_SpaceAgeTitan_Landmark3":{"name":"Saturn VI: wrota HYDRA","maxTier":"copper"},
  "X_SpaceAgeVenus_Landmark1":{"name":"Latająca Wyspa","maxTier":"copper"},
  "X_StellarAgeDiscovery_Landmark1":{"name":"Kolektor rozbitego horyzontu","maxTier":"gold"},
  "X_TomorrowEra_Landmark1":{"name":"Voyager V1","maxTier":"copper"},
  "X_TomorrowEra_Landmark2":{"name":"Truce Tower","maxTier":"copper"},
  "X_VirtualFuture_Landmark1":{"name":"Terakotowa Armia","maxTier":"gold"},
 };
 function tierValue(value){const tier=value?.value??value;return ['copper','gold'].includes(tier)?tier:null;}
 function resolveTier(entity,definitions={}){
  const direct=tierValue(entity?.currentTier);if(direct)return direct;
  const level=entity?.level;if(!Number.isSafeInteger(level)||level<0)return null;
  const definition=definitions[entity?.cityentity_id]??tierCatalog[entity?.cityentity_id];
  const max=tierValue(definition?.maxTier);
  if(max==='copper')return 'copper';
  if(max==='gold')return level>=101?'gold':'copper';
  return level<=100?'copper':null;
 }
 function marathonRows(construction,rows,tolerance=0){
  if(!Array.isArray(construction?.rankings))return [];
  tolerance=Number.isSafeInteger(Number(tolerance))&&Number(tolerance)>=0?Number(tolerance):0;
  let balance=0,allowance=0;
  return rows.map(row=>{
   const record=construction.rankings.find(r=>r.rank===row.rank&&r.player?.player_id!==construction.target?.playerId);
   const paid=record?.forge_points??0;
   const delta=Number.isSafeInteger(row.amount)?paid-row.amount:null;
   balance=delta===null?NaN:balance+delta;
   if(paid>0)allowance+=tolerance;
   return {...row,paid,delta,balance,complete:!construction.rankingsStale&&paid>0&&Number.isFinite(balance)&&balance>=-allowance};
  });
 }

 function walk(payload,visit){
  const queue=[payload];
  for(let i=0;i<queue.length && i<200000;i++){
   const value=queue[i];if(!value||typeof value!=='object')continue;
   visit(value);
   for(const child of Object.values(value))if(child&&typeof child==='object')queue.push(child);
  }
 }
 function findConstruction(payload){
  let found=null;
  walk(payload,value=>{if(value.__class__==='GreatBuildingConstruction' && Array.isArray(value.rankings))found=value;});
  return found;
 }
 function pearlAmounts(construction,multiplier,minusOne=false){
  const text=String(multiplier).trim().replace(',','.');
  if(!/^\d{1,2}(?:\.\d{1,4})?$/.test(text)||Number(text)<=0||Number(text)>10)return null;
  const scale=10**(text.split('.')[1]||'').length,numerator=Math.round(Number(text)*scale);
  const ranks=[...new Set((construction?.rankings??[]).filter(r=>Number.isSafeInteger(r.rank)&&r.rank>0&&r.reward).map(r=>r.rank))].sort((a,b)=>a-b);
  const rows=ranks.map(rank=>{
   const record=construction.rankings.find(r=>r.rank===rank&&r.reward),base=record?.reward?.strategy_point_amount??(record?.reward?.__class__==='GreatBuildingRankingRowReward'?0:null);
   return {rank,base:Number.isSafeInteger(base)&&base>=0?base:null,amount:Number.isSafeInteger(base)&&base>=0?Math.max(1,Math.ceil(base*numerator/scale)):null};
  });
  const cost=construction?.forge_points_for_level_up;
  const totalCost=Number.isSafeInteger(cost)&&cost>0?cost:null;
  const sum=rows.every(r=>r.amount!==null)?rows.reduce((n,r)=>n+r.amount,0):null;
  const ownerAmount=totalCost!==null&&sum!==null?Math.max(0,totalCost-sum-(minusOne?1:0)):null;
  return {rows,totalCost,ownerAmount,sum};
 }
 function arcProfit(base,amount,bonus){
  const text=String(bonus).trim().replace(',','.');
  if(!/^\d{1,4}(?:\.\d{1,4})?$/.test(text)||Number(text)>1000||!Number.isSafeInteger(base)||base<0||!Number.isSafeInteger(amount)||amount<0)return null;
  const scale=10**(text.split('.')[1]||'').length,denominator=100*scale,numerator=denominator+Math.round(Number(text)*scale);
  const reward=Math.floor((base*numerator+denominator/2)/denominator);
  return {reward,profit:reward-amount,multiplier:numerator/denominator};
 }
 function createTracker(){
  const entities=new Map(),definitions={};let opened=null;
  function consume(payload,methods=[]){
   const responses=[];
   // Zbieramy CityMapEntity z tego samego payloadu — potrzebne jako fallback dla target.
   const seenEntities=[];
   walk(payload,value=>{
    if(value.id&&value.maxTier&&(!value.__class__||value.__class__==='CityEntityGreatBuilding'))definitions[value.id]={maxTier:value.maxTier};
    if(value.__class__==='GreatBuildingContributionRow'&&Number.isSafeInteger(value.entity_id)&&Number.isSafeInteger(value.player?.player_id)&&tierValue(value.currentTier)){
     const key=`${value.player.player_id}:${value.entity_id}`,old=entities.get(key);
     if(opened?.target&&key===`${opened.target.playerId}:${opened.target.entityId}`&&old?.level!=null&&value.level!==old.level)opened=null;
     if(opened?.target&&key===`${opened.target.playerId}:${opened.target.entityId}`&&Number.isSafeInteger(value.current_progress)&&value.current_progress!==opened.rankings.reduce((sum,r)=>sum+(r.forge_points??0),0))opened={...opened,rankingsStale:true};
     entities.set(key,{...old,id:value.entity_id,player_id:value.player.player_id,cityentity_id:value.city_entity_id,level:value.level,currentTier:value.currentTier,forge_points_for_level_up:value.max_progress??old?.forge_points_for_level_up});
    }
    if(value.__class__==='CityMapEntity' && value.type==='greatbuilding' && Number.isSafeInteger(value.id)&&Number.isSafeInteger(value.player_id)){
     const key=`${value.player_id}:${value.id}`,old=entities.get(key);
     const cost=value.state?.forge_points_for_level_up;
     const invested=value.state?.invested_forge_points;
     if(opened?.target&&key===`${opened.target.playerId}:${opened.target.entityId}`&&Number.isSafeInteger(invested)&&invested!==opened.rankings.reduce((sum,r)=>sum+(r.forge_points??0),0))opened={...opened,rankingsStale:true};
     if(opened?.target && key===`${opened.target.playerId}:${opened.target.entityId}` && old?.level!=null && value.level!=null && old.level!==value.level)opened=null;
     entities.set(key,{id:value.id,player_id:value.player_id,level:value.level??old?.level,
      cityentity_id:value.cityentity_id??old?.cityentity_id,
      currentTier:value.currentTier??(value.level==null||value.level===old?.level?old?.currentTier:null),
      forge_points_for_level_up:Number.isSafeInteger(cost)&&cost>0?cost:(value.level==null||value.level===old?.level?old?.forge_points_for_level_up:null)??null});
     seenEntities.push({entityId:value.id,playerId:value.player_id});
    }
    if(value.requestClass==='GreatBuildingsService' && value.responseData && typeof value.responseData==='object')responses.push(value);
   });
   for(const response of responses){
    if(!['getConstruction','contributeForgePoints'].includes(response.requestMethod))continue;
    // Dopasowanie po requestId — jeśli nie pasuje dokładnie, szukamy dowolnego pasującego
    // po klasie i metodzie (requestId jest tylko iteratorem, może się różnić).
    const request=
     methods.find(m=>m.requestClass===response.requestClass&&m.requestMethod===response.requestMethod&&m.requestId===response.requestId) ||
     methods.find(m=>m.requestClass===response.requestClass&&m.requestMethod===response.requestMethod);
    let target=request?.target??null;
    // Fallback: jeśli nadal brak target, użyj CityMapEntity z tego samego payloadu.
    // Przy perlach cudzych gracz w response to właściciel — bierzemy pierwszą encję.
    if(!target && seenEntities.length===1)target={...seenEntities[0]};
    const construction=findConstruction(response.responseData);
    if(construction){
     opened={...construction,target:target?{...target}:null,rankingsAt:Date.now(),rankingsStale:false};
    }else if(response.requestMethod==='contributeForgePoints'&&Array.isArray(response.responseData)&&opened?.target&&target&&opened.target.entityId===target.entityId&&opened.target.playerId===target.playerId){
     opened={...opened,rankings:response.responseData,rankingsAt:Date.now(),rankingsStale:false};
    }
   }
   if(!responses.length){const construction=findConstruction(payload);if(construction)opened={...construction,target:null,rankingsAt:Date.now(),rankingsStale:false};}
   return current();
  }
  function current(){
   if(!opened)return null;
   const entity=opened.target?entities.get(`${opened.target.playerId}:${opened.target.entityId}`):null;
   return {...opened,tier:resolveTier({...entity,currentTier:opened.currentTier??entity?.currentTier},definitions),forge_points_for_level_up:entity?.forge_points_for_level_up??null,level:entity?.level??null,cityentity_id:entity?.cityentity_id??null};
  }
  return {consume,current,entities};
 }
 function contributionRequest(construction,amount,requestId){
  const target=construction?.target,level=construction?.level;
  if(!target || !Number.isSafeInteger(target.entityId)||!Number.isSafeInteger(target.playerId)||!Number.isSafeInteger(level)||level<0)throw new Error('Brak identyfikatora lub aktualnego poziomu perły');
  if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(requestId)||requestId<0)throw new Error('Nieprawidłowa kwota lub numer żądania');
  return {__class__:'ServerRequest',requestClass:'GreatBuildingsService',requestMethod:'contributeForgePoints',requestData:[target.entityId,target.playerId,level,amount,false],requestId};
 }
 // Progi łącznej wpłaty właściciela, przy kolejnych wpłatach P1 → P5.
 // Pozostała pula może zrównać się z wpłatą inwestora, ale nie może jej przebić.
 function lockAmounts(total,rows){
  if(!Number.isSafeInteger(total)||total<0)return null;
  let previous=0;
  return rows.map(row=>{
   if(!Number.isSafeInteger(row.amount)||row.amount<0){previous=NaN;return null;}
   const block=Number.isFinite(previous)?Math.max(0,total-previous-2*row.amount):null;
   previous+=row.amount;
   return block;
  });
 }
 function ownerContribution(construction){
  const rankings=construction?.rankings;
  if(!Array.isArray(rankings))return null;
  const ownerId=construction.target?.playerId;
  const row=rankings.find(r=>ownerId!=null&&r.player?.player_id===ownerId)
   ||rankings.find(r=>r.rank===0&&(ownerId==null||r.player?.player_id==null||r.player.player_id===ownerId));
  // W odczytanym rankingu gracz bez wpłaty nie ma własnego wiersza.
  if(!row)return Number.isSafeInteger(ownerId)?0:null;
  const amount=row.forge_points??0;
  return Number.isSafeInteger(amount)&&amount>=0?amount:null;
 }
 function lockStages(total,rows,ownerPaid=0){
  const thresholds=lockAmounts(total,rows);
  if(!thresholds||!Number.isSafeInteger(ownerPaid)||ownerPaid<0)return null;
  let paid=ownerPaid;
  return thresholds.map(threshold=>{
   if(threshold===null)return null;
   const cumulative=Math.max(paid,threshold),additional=cumulative-paid;
   paid=cumulative;
   return {additional,cumulative};
  });
 }
 function liveLocks(total,rows,construction){
  const paid=ownerContribution(construction),rankings=construction?.rankings;
  if(!Number.isSafeInteger(total)||total<0||paid===null||!Array.isArray(rankings))return null;
  if(rankings.some(r=>!Number.isSafeInteger(r.forge_points??0)||(r.forge_points??0)<0))return null;
  let remaining=Math.max(0,total-rankings.reduce((sum,r)=>sum+(r.forge_points??0),0));
  const investors=rankings.filter(r=>r.rank!==0&&r.player?.player_id!==construction.target?.playerId).map(r=>r.forge_points??0).sort((a,b)=>b-a);
  return rows.map(row=>{
   const actual=investors[row.rank-1]??0;
   if(!Number.isSafeInteger(row.amount)||row.amount<0)return null;
   // Zaniżona wpłata nie zajmuje planowanego miejsca: nowy inwestor
   // wpłaci pełną kwotę, a dotychczasowy spadnie niżej (jego PR zostają).
   const occupied=actual>=row.amount&&actual>0;
   const additional=Math.max(0,remaining-(occupied?actual:2*row.amount-actual));
   if(!occupied){
    remaining=Math.max(0,remaining-row.amount);
    investors.push(row.amount);investors.sort((a,b)=>b-a);
   }
   return {additional,cumulative:paid+additional};
  });
 }
 const api={resolveTier,marathonRows,tierCatalog,findConstruction,pearlAmounts,arcProfit,createTracker,contributionRequest,lockAmounts,lockStages,liveLocks,ownerContribution};root.FoePearls=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
