(function(root){
 'use strict';
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
  const rows=Array.from({length:5},(_,index)=>{
   const rank=index+1,record=construction?.rankings?.find(r=>r.rank===rank),base=record?.reward?.strategy_point_amount;
   return {rank,base:Number.isSafeInteger(base)&&base>=0?base:null,amount:Number.isSafeInteger(base)&&base>0?Math.ceil(base*numerator/scale):1};
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
  const entities=new Map();let opened=null;
  function consume(payload,methods=[]){
   const responses=[];
   // Zbieramy CityMapEntity z tego samego payloadu — potrzebne jako fallback dla target.
   const seenEntities=[];
   walk(payload,value=>{
    if(value.__class__==='CityMapEntity' && value.type==='greatbuilding' && Number.isSafeInteger(value.id)&&Number.isSafeInteger(value.player_id)){
     const key=`${value.player_id}:${value.id}`,old=entities.get(key);
     const cost=value.state?.forge_points_for_level_up;
     if(opened?.target && key===`${opened.target.playerId}:${opened.target.entityId}` && old?.level!=null && value.level!=null && old.level!==value.level)opened=null;
     entities.set(key,{id:value.id,player_id:value.player_id,level:value.level??old?.level,
      cityentity_id:value.cityentity_id??old?.cityentity_id,
      forge_points_for_level_up:Number.isSafeInteger(cost)&&cost>0?cost:null});
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
    if(!target && seenEntities.length>1){
     // Spróbuj dopasować po player_id z rankingów w response.
     const ownerRow=Array.isArray(response.responseData?.rankings)
      ?response.responseData.rankings.find(r=>r.player?.player_id)
      :(Array.isArray(response.responseData)?response.responseData.find(r=>r.player?.player_id):null);
     const ownerId=ownerRow?.player?.player_id;
     if(Number.isSafeInteger(ownerId)){
      const match=seenEntities.find(e=>e.playerId===ownerId);
      if(match)target={...match};
     }
    }
    const construction=findConstruction(response.responseData);
    if(construction){
     opened={...construction,target:target?{...target}:null};
    }else if(response.requestMethod==='contributeForgePoints'&&Array.isArray(response.responseData)&&opened?.target&&target&&opened.target.entityId===target.entityId&&opened.target.playerId===target.playerId){
     opened={...opened,rankings:response.responseData};
    }
   }
   if(!responses.length){const construction=findConstruction(payload);if(construction)opened={...construction,target:null};}
   return current();
  }
  function current(){
   if(!opened)return null;
   const entity=opened.target?entities.get(`${opened.target.playerId}:${opened.target.entityId}`):null;
   return {...opened,forge_points_for_level_up:entity?.forge_points_for_level_up??null,level:entity?.level??null,cityentity_id:entity?.cityentity_id??null};
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
 const api={findConstruction,pearlAmounts,arcProfit,createTracker,contributionRequest,lockAmounts,lockStages,liveLocks,ownerContribution};root.FoePearls=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
