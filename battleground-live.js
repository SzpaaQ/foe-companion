(function(root){
 'use strict';
 function createTracker({now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout}={}){
  let mapId=null,endsAt=null,attrition=null,ignored=new Set();
  let own=null,connected=false,serial=0,epoch=0;const provinces=new Map(),waiters=new Set();
  const snapshot=id=>{const p=provinces.get(id),c=p?.value.conquestProgress?.find(c=>c.participantId===own);
   const limits=(p?.value.conquestProgress||[]).map(c=>c.maxProgress).filter(n=>Number.isFinite(n)&&n>0);
   const maxProgress=Number.isFinite(c?.maxProgress)&&c.maxProgress>0?c.maxProgress:limits.length?Math.min(...limits):undefined;
   return p?{...p,progress:c?.progress??0,maxProgress,own,mapId,endsAt}:null;};
  function flush(){for(const check of [...waiters])check();}
  function consume(data,source='http'){
   // The initial map can be nested in startup/state responses, not only a
   // top-level getBattleground response. Use the same shape as the panel.
   const queue=[data];let initial=null;
   for(let i=0;i<queue.length&&i<5000;i++){
    const value=queue[i];if(!value||typeof value!=='object')continue;
    if(Array.isArray(value.map?.provinces)&&(Number.isSafeInteger(value.currentParticipantId)||Array.isArray(value.battlegroundParticipants))){initial=value;break;}
    for(const [key,child] of Object.entries(value))if(key!=='requestData'&&child&&typeof child==='object')queue.push(child);
   }
   if(initial){
    attrition=initial.currentPlayerParticipant?.attrition?.__class__==='GuildBattlegroundAttrition'?(initial.currentPlayerParticipant.attrition.level??0):null;
    own=initial.currentParticipantId??0;mapId=initial.map.id;endsAt=initial.endsAt;ignored=new Set((initial.battlegroundParticipants?.find(p=>p.participantId===own)?.signals||[]).filter(s=>s.signal==='ignore').map(s=>s.provinceId??0));provinces.clear();
    for(const p of initial.map.provinces)if(p&&Number.isSafeInteger(p.id??0))provinces.set(p.id??0,{value:{...p,lockedUntil:p.lockedUntil??0,conquestProgress:p.conquestProgress??[]},version:++serial,socketVersion:source==='socket'?serial:0,confirmedOpen:source==='socket'&&p.lockedUntil===0&&p.ownerId!==own&&!p.isSpawnSpot,epoch,at:now()});
   }
   for(const r of Array.isArray(data)?data:[data]){
    if(r?.requestClass!=='GuildBattlegroundService')continue;
    const d=r.responseData;let list=[];
    if(r.requestMethod==='getBattleground'&&Array.isArray(d?.map?.provinces)){
     continue; // Already seeded from the complete HTTP response above.
    }else if(['getProvince','getProvinces','getUpdatedProvinces'].includes(r.requestMethod))list=Array.isArray(d)?d:[d];
    for(const p of list){
     if(!p||!Number.isSafeInteger(p.id??0))continue;
     const id=p.id??0,previous=provinces.get(id);
     // Province responses omit default-valued fields (e.g. a removed lock).
     const value={...previous?.value,...p,ownerId:p.ownerId??0,lockedUntil:p.lockedUntil??0,isSpawnSpot:p.isSpawnSpot??false,isAttackBattleType:p.isAttackBattleType??false,gainAttritionChance:p.gainAttritionChance??0,conquestProgress:p.conquestProgress??[]};
     const hasLock=Object.hasOwn(p,'socketHasLockedUntil')?p.socketHasLockedUntil===true:Object.hasOwn(p,'lockedUntil');
     const confirmedOpen=source==='socket'&&hasLock&&Number(p.lockedUntil)===0&&value.ownerId!==own&&!value.isSpawnSpot
      ?true
      :hasLock&&Number(p.lockedUntil)>0||value.ownerId===own||value.isSpawnSpot
       ?false:previous?.confirmedOpen===true;
     provinces.set(id,{value,version:++serial,socketVersion:source==='socket'?serial:previous?.socketVersion??0,confirmedOpen,epoch,at:now()});
    }
   }
   const responses=Array.isArray(data)?data:[data];let attritionUpdated=!!initial;
   for(const r of responses)if(r?.requestClass==='GuildBattlegroundService'&&r.requestMethod==='getPlayerParticipant'){
    const participant=r.responseData;
    if(Number.isSafeInteger(participant?.participantId)&&participant.participantId===own)ignored=new Set((participant.signals??[]).filter(s=>s.signal==='ignore').map(s=>s.provinceId??0));
    const a=participant?.attrition;attrition=a?.__class__==='GuildBattlegroundAttrition'?(a.level??0):null;attritionUpdated=true;
   }
   // A victory can increase attrition. Do not reuse an older value if its update is missing.
   if(!attritionUpdated&&responses.some(r=>r?.requestClass==='NegotiationGameService'&&r.responseData?.state==='won'||r?.requestClass==='BattlefieldService'&&r.responseData?.state?.winnerBit===1))attrition=null;
   const updates=[data];for(let i=0;i<updates.length&&i<5000;i++){
    const v=updates[i];if(!v||typeof v!=='object')continue;
    if(v.participantId===own&&(Array.isArray(v.signals)||(v.__class__==='GuildBattlegroundParticipant'&&!Object.hasOwn(v,'signals'))))ignored=new Set((v.signals??[]).filter(s=>s.signal==='ignore').map(s=>s.provinceId??0));
    for(const [key,child] of Object.entries(v))if(key!=='requestData'&&child&&typeof child==='object')updates.push(child);
   }
   flush();
  }
  function unavailable(message){const error=Error(message);error.code='SECTOR_INELIGIBLE';return error;}
  function isOpen(id){const p=provinces.get(id);return !!p&&(p.confirmedOpen===true||p.value.lockedUntil<=0||p.value.lockedUntil+2<=now()/1000);}
  function socketOpenSnapshot(){return {mapId,endsAt,ids:[...provinces].filter(([,p])=>p.confirmedOpen===true).map(([id])=>id)};}
  function canSkipAttack(id,policy,error){const s=snapshot(id);return !!(error?.code==='SECTOR_INELIGIBLE'&&policy?.kind==='attack'&&connected&&s?.epoch===epoch&&mapId===policy.mapId&&endsAt===policy.endsAt);}
  function check(id,reserve,cost=1){
   const s=snapshot(id),p=s?.value;
   if(!p||own==null)throw Error('Brak danych sektora — otwórz mapę w grze.');
   if(p.isSpawnSpot||p.ownerId===own||!isOpen(id))throw unavailable('Sektor nie jest jeszcze otwarty (blokada serwera lub bufor 2 s).');
   if(Number.isInteger(reserve)&&reserve>=0){
    if(!connected)throw Error('Brak połączenia z aktualizacjami socketu — automat zatrzymany.');
    if(s.epoch!==epoch)throw Error('Po przerwaniu socketu otwórz mapę w grze, aby uzupełnić brakujące aktualizacje.');
    // An untouched guild has no conquest entry (or an entry with omitted zero).
    // Allow its first action; the winning action must still await socket progress.
    // Never invent a limit: once progress is positive the real limit is required.
    const hasLimit=Number.isFinite(s.maxProgress)&&s.maxProgress>0;
    if(!hasLimit&&s.progress!==0)throw Error('Brak potwierdzonego limitu sektora — otwórz sektor w grze.');
    if(hasLimit&&s.maxProgress-s.progress-cost<reserve)throw unavailable('Osiągnięto ustawioną rezerwę walk.');
   }
   return s;
  }
  function checkPolicy(id,policy){
   if(!policy||!['attack','negotiation'].includes(policy.kind)||!Number.isFinite(policy.progress)||policy.progress<=0||policy.progress>100||!Number.isInteger(policy.reserve)||policy.reserve<0)throw Error('Nieprawidłowe warunki automatyzacji.');
   if(policy.guardClosing===true){
    const s=check(id);
    if(mapId!==policy.mapId||endsAt!==policy.endsAt)throw Error('Mapa zmieniona.');
    if(!connected||s.epoch!==epoch)throw Error('Brak aktualnego połączenia z mapą — zamykanie zatrzymane.');
    return s;
   }
   if(policy.closeUntilClosed===true){
    const s=check(id),p=s.value;
    if(mapId!==policy.mapId||endsAt!==policy.endsAt)throw Error('Mapa zmieniona.');
    if(ignored.has(id)&&policy.attackIgnoreGuildSignal!==true)throw unavailable('Sektor oznaczony jako ignorowany.');
    if(policy.kind==='negotiation'&&(!Number.isSafeInteger(attrition)||attrition>policy.maxAttrition||p.gainAttritionChance!==20))throw Error('Negocjacje nie spełniają wymagań oporu.');
    if(policy.kind==='attack'&&(!Number.isFinite(policy.attackChance)||p.gainAttritionChance>policy.attackChance||!(p.isAttackBattleType===true?policy.attack:policy.defense)))throw Error('Walka nie spełnia warunków autoataku.');
    return s;
   }
   const s=check(id,policy.reserve,policy.kind==='negotiation'?2:1),p=s.value;
   if(mapId!==policy.mapId||endsAt!==policy.endsAt)throw Error('Mapa zmieniona.');
   if(ignored.has(id)&&!(policy.attackIgnoreGuildSignal===true))throw unavailable('Sektor oznaczony jako ignorowany.');
   if(Number.isFinite(s.maxProgress)&&s.maxProgress>0&&s.progress/s.maxProgress*100>=policy.progress)throw unavailable('Osiągnięto limit progresu.');
   const firstAttack=policy.kind==='attack'&&s.progress===0&&s.maxProgress==null;
   if(!firstAttack&&(!Number.isFinite(s.maxProgress)||s.maxProgress<=0||s.progress/s.maxProgress*100>=policy.progress))throw Error('Osiągnięto limit progresu lub brak potwierdzonego limitu.');
   if(policy.kind==='negotiation'&&(!Number.isSafeInteger(attrition)||attrition<0||!Number.isSafeInteger(policy.maxAttrition)||attrition>policy.maxAttrition))throw Error('Brak aktualnego oporu lub przekroczono limit — otwórz mapę w grze.');
   if(policy.kind==='negotiation'&&p.gainAttritionChance!==20)throw Error('Szansa wzrostu oporu nie wynosi 20%.');
   if(policy.kind==='attack'&&(!Number.isFinite(policy.attackChance)||policy.attackChance<0||policy.attackChance>100||!Number.isFinite(p.gainAttritionChance)||p.gainAttritionChance<0||p.gainAttritionChance>policy.attackChance))throw Error('Szansa wzrostu oporu przekracza limit autoataku lub brak poprawnych danych.');
   if(policy.kind==='attack'&&!(p.isAttackBattleType===true?policy.attack:policy.defense))throw Error('Typ sektora nie jest wybrany.');
   return s;
  }
  function closedSince(id,before){
   const current=snapshot(id);
   return !!(connected&&before&&current&&before.epoch===epoch&&current.epoch===epoch&&before.mapId===mapId&&before.endsAt===endsAt&&current.version>before.version&&(current.value.ownerId!==before.value.ownerId||current.value.lockedUntil>now()/1000));
  }
  function waitForProgress(id,before,cost=1,timeout=8000){
   if(!before||!connected)return Promise.resolve(false);
   return new Promise(resolve=>{
    let timer;
    const finish=ok=>{waiters.delete(checkUpdate);if(timer!==undefined)cancel(timer);resolve(ok);};
    const checkUpdate=()=>{
     const s=snapshot(id);
     if(!connected)return finish(false);
     if(s&&s.socketVersion>before.version&&(s.value.ownerId!==before.value.ownerId||s.value.lockedUntil>now()/1000||s.progress>=before.progress+cost))finish(true);
    };
    waiters.add(checkUpdate);timer=schedule(()=>finish(false),timeout);checkUpdate();
   });
  }
  return {consume,snapshot,closedSince,check,checkPolicy,canSkipAttack,waitForProgress,isOpen,socketOpenSnapshot,setConnected(value){if(connected&&!value){epoch++;for(const p of provinces.values())p.confirmedOpen=false;}connected=value;flush();}};
 }
 const readers=new WeakMap();
 function createSocketReader(win){
  if(readers.has(win))return readers.get(win);
  const Native=win.WebSocket;if(typeof Native!=='function')return null;
  const sockets=new Set(),subscribers=new Set(),states=new Set();
  const notify=(listeners,value)=>{for(const listener of [...listeners])try{listener(value);}catch{ /* One consumer must not interrupt the game or other consumers. */ }};
  const reader={
   // Passive incoming responses only. No frame history, outgoing messages or polling.
   subscribe(listener){subscribers.add(listener);return ()=>subscribers.delete(listener);},
   onConnection(listener){states.add(listener);notify([listener],sockets.size>0);return ()=>states.delete(listener);},
   get connected(){return sockets.size>0;}
  };
  readers.set(win,reader);
  win.WebSocket=new Proxy(Native,{construct(Target,args,newTarget){
   const socket=Reflect.construct(Target,args,newTarget);
   let url;try{url=new URL(args[0],win.location?.href);}catch{return socket;}
   if(url.protocol!=='wss:'||url.host!==win.location?.host||url.pathname!=='/socket/')return socket;
   socket.addEventListener('open',()=>{sockets.add(socket);notify(states,true);});
   socket.addEventListener('close',()=>{sockets.delete(socket);notify(states,sockets.size>0);});
   socket.addEventListener('message',event=>{
    if(typeof event.data!=='string'||event.data.length>24000000)return;
    try{
     const batch=JSON.parse(event.data);
     const responses=(Array.isArray(batch)?batch:[]).filter(r=>typeof r?.requestClass==='string'&&typeof r.requestMethod==='string');
     if(responses.length)notify(subscribers,responses);
    }catch{ /* Heartbeats and unrelated messages are ignored. */ }
   });
   return socket;
  }});
  return reader;
 }
 function observeSockets(win,receive,status){
  const reader=createSocketReader(win);if(!reader)return false;
  reader.onConnection(status);
  reader.subscribe(batch=>{
   const updates=batch.filter(r=>r.requestClass==='GuildBattlegroundService'&&(['getProvince','getProvinces','getUpdatedProvinces','getPlayerParticipant'].includes(r.requestMethod)||(Array.isArray(r.responseData)?r.responseData:[r.responseData]).some(v=>Array.isArray(v?.signals)||v?.__class__==='GuildBattlegroundParticipant')));
   if(updates.length)receive(updates.map(r=>!['getProvince','getProvinces','getUpdatedProvinces'].includes(r.requestMethod)?r:({...r,responseData:(Array.isArray(r.responseData)?r.responseData:[r.responseData]).filter(p=>p?.__class__==='GuildBattlegroundProvince').map(p=>({...p,ownerId:p.ownerId??0,lockedUntil:p.lockedUntil??0,socketHasLockedUntil:Object.hasOwn(p,'lockedUntil'),isSpawnSpot:p.isSpawnSpot??false,isAttackBattleType:p.isAttackBattleType??false,gainAttritionChance:p.gainAttritionChance??0,conquestProgress:p.conquestProgress??[]}))})));
  });
  return true;
 }
 const api={createTracker,createSocketReader,observeSockets};root.FoeBattlegroundLive=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
