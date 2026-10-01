(function(root){
 const expectations=new WeakMap();
 function units(info){
  if(info?.__class__!=='ArmyInfo'||!Array.isArray(info.units))throw Error('Brak danych armii.');
  const all=new Map();
  for(const u of info.units)for(const id of u.unitIds||[u.unitId]){
   if(Number.isSafeInteger(id))all.set(id,{...u,unitId:id});
  }
  return [...all.values()];
 }
 function plan(info){
  const all=units(info),current=all.filter(u=>u.is_attacking);
  const templates=(info.templates||[]).filter(t=>t.unitTypeIds?.length===8);
  const wanted=current.length===8?current.map(u=>u.unitTypeId):templates.length===1?templates[0].unitTypeIds:null;
  if(!wanted)throw Error('Ustaw pełny skład w grze lub jednoznaczny szablon ośmiu jednostek.');
  const available=all.filter(u=>u.currentHitpoints===10&&!u.is_defending&&!u.isArenaDefending).sort((a,b)=>Number(!!a.is_attacking)-Number(!!b.is_attacking));
  const selected=[];
  for(const type of wanted){const index=available.findIndex(u=>u.unitTypeId===type);if(index<0)throw Error('Brakuje zdrowych jednostek typu '+type+'. Nie rozpoczęto walki.');selected.push(available.splice(index,1)[0].unitId);}
  const pools=[{__class__:'ArmyPool',type:'attacking',units:selected},{__class__:'ArmyPool',type:'defending',units:all.filter(u=>u.is_defending).map(u=>u.unitId)},{__class__:'ArmyPool',type:'arena_defending',units:all.filter(u=>u.isArenaDefending).map(u=>u.unitId)}];
  expectations.set(pools,pools.map(p=>p.units.map(id=>{const u=all.find(u=>u.unitId===id);return JSON.stringify([u.unitTypeId,u.currentHitpoints]);}).sort()));
  return pools;
 }
 function confirmed(info,pools){
  const all=units(info),expected=expectations.get(pools);if(!expected)return false;
  return pools.every((p,i)=>{
   const flag={attacking:'is_attacking',defending:'is_defending',arena_defending:'isArenaDefending'}[p.type],actual=all.filter(u=>u[flag]);
   if(actual.length!==p.units.length||p.type==='attacking'&&(actual.length!==8||actual.some(u=>u.currentHitpoints!==10)))return false;
   const composition=actual.map(u=>JSON.stringify([u.unitTypeId,u.currentHitpoints])).sort();
   return composition.every((value,n)=>value===expected[i][n]);
  });
 }
 const api={plan,confirmed};root.FoeBattleArmy=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
