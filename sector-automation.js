(function(root){
 'use strict';
 const defaults={attackProgress:50,negProgress:50,negWins:3,maxAttrition:0,attack:true,defense:false};
 function settings(value={}){
  if(!value||typeof value!=='object')value={};
  const out={...defaults};
  for(const key of ['attackProgress','negProgress'])if(Number.isFinite(value[key])&&value[key]>0&&value[key]<=100)out[key]=value[key];
  for(const key of ['negWins','maxAttrition'])if(Number.isSafeInteger(value[key])&&value[key]>=(key==='negWins'?1:0))out[key]=value[key];
  for(const key of ['attack','defense'])if(typeof value[key]==='boolean')out[key]=value[key];
  return out;
 }
 function eligible(row,kind,config,now,reserve=0){
  if(!row||row.ignored||row.color==='⚪'||row.until>now||!Number.isFinite(row.progress)||row.progress<0||!Number.isFinite(row.maxProgress)||row.maxProgress<=0)return false;
  const cost=kind==='negotiation'?2:1,limit=kind==='negotiation'?config.negProgress:config.attackProgress;
  if(row.progress/row.maxProgress*100>=limit||row.maxProgress-row.progress-cost<reserve)return false;
  return kind==='negotiation'?row.gainAttritionChance===20:(row.isAttackBattleType===true?config.attack:row.isAttackBattleType===false?config.defense:false);
 }
 function create({storage,now=()=>Date.now(),onChange=()=>{}}={}){
  const key='foe-companion.openSectorLedger.v1';let ledger={};
  try{ledger=JSON.parse(storage?.getItem(key)||'{}');if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))ledger={};}catch{}
  let scope=null,active=null,attack=false,negotiation=false,losses=0,nextAt=0,status='Wyłączone',fatal=false,guardsPaused=false;
  function save(){try{storage?.setItem(key,JSON.stringify(ledger));return true;}catch{attack=negotiation=false;fatal=true;status='Nie udało się zapisać liczników. Automaty zatrzymane.';return false;}}
  function changed(){onChange();}
  function stop(kind,message='Zatrzymano. Trwająca akcja zostanie dokończona.'){
   if(!kind||kind==='attack')attack=false;if(!kind||kind==='negotiation')negotiation=false;status=message;changed();
  }
  function enable(kind,value){if(fatal||(value&&active))return false;if(value)guardsPaused=true;if(kind==='attack'){attack=value;if(value)losses=0;}else negotiation=value;status=value?'Oczekiwanie na pasujący sektor.':'Wyłączono tryb.';changed();return true;}
  function sync(currentScope,rows){
   if(!currentScope)return false;
   if(scope&&scope!==currentScope){stop(null,'Zmieniła się mapa lub gracz — uruchom ponownie.');}
   scope=currentScope;let dirty=false;
   ledger[scope]||={openings:{},counts:{}};
   const state=ledger[scope];
   if(!state||typeof state.openings!=='object'||!state.openings||typeof state.counts!=='object'||!state.counts||Array.isArray(state.openings)||Array.isArray(state.counts)){fatal=true;stop(null,'Uszkodzony zapis liczników — automaty zatrzymane.');return false;}
   for(const row of rows){
    const old=state.openings[row.id],lock=row.until||0;
    if(!old||old.owner!==row.ownerId||(lock>0&&lock!==old.lock)){
     state.openings[row.id]={owner:row.ownerId,lock,serial:(old?.serial||0)+1};dirty=true;
    }
   }
   if(dirty&&!save())return false;return true;
  }
  function opening(id){const o=ledger[scope]?.openings[id];return o?scope+':'+id+':'+o.serial:null;}
  function tick({scope:currentScope,allRows,rows,config,attrition,ready,busy,reserve,delay,send}){
   if(!sync(currentScope,allRows)||fatal)return;
   if(active||(!attack&&!negotiation))return;
   if(!ready){stop(null,'Brak gotowego połączenia — uruchom ponownie po odświeżeniu danych.');return;}
   if(negotiation&&Number.isFinite(attrition)&&attrition>config.maxAttrition)stop('negotiation','Opór przekracza limit negocjacji.');
   if(busy||now()<nextAt)return;
   const sorted=[...rows].sort((a,b)=>a.until-b.until||a.id-b.id);
   for(const kind of ['negotiation','attack']){
    if(!(kind==='attack'?attack:negotiation))continue;
    if(kind==='negotiation'&&!Number.isSafeInteger(attrition)){status='Oczekiwanie na odczyt oporu z mapy.';continue;}
    const row=sorted.find(r=>{
     if(!eligible(r,kind,config,now()/1000,reserve))return false;
     const count=ledger[scope].counts[opening(r.id)];return kind==='attack'||(!count?.pending&&(count?.wins||0)<config.negWins);
    });
    if(!row)continue;
    const identity=opening(row.id);if(!identity)continue;
    active={kind,id:row.id,scope,identity,delay,policy:{mapId:row.mapId,endsAt:row.endsAt,kind,progress:kind==='attack'?config.attackProgress:config.negProgress,maxAttrition:config.maxAttrition,attack:config.attack,defense:config.defense,reserve}};
    if(kind==='negotiation'){const count=ledger[scope].counts[identity]||={wins:0};count.pending=true;if(!save()){active=null;changed();return;}}
    status=(kind==='attack'?'⚔️ ':'🤝 ')+row.sector+' · '+(kind==='attack'?'porażki z rzędu: '+losses+'/3':'sukcesy: '+(ledger[scope].counts[identity]?.wins||0)+'/'+config.negWins);
    changed();if(send(kind,row.id,active.policy)===false)result({ok:false,notStarted:true,message:'Nie udało się rozpocząć akcji.'});return;
   }
   if(negotiation&&!attack&&!Number.isSafeInteger(attrition)){status='Oczekiwanie na odczyt oporu z mapy.';changed();return;}
   if(attack||negotiation){status='Oczekiwanie na pasujący sektor'+(negotiation?' (niepotwierdzone wcześniejsze negocjacje są pomijane)':'')+'.';changed();}
  }
  function result(data){
   if(!active)return false;
   if(active.scope!==scope){active=null;stop(null,'Zmieniła się mapa lub gracz — sprawdź stan gry przed wznowieniem.');return true;}
   if(active.kind==='attack'&&data.ok&&data.nextWave)return 'wave';
   const previous=active;active=null;nextAt=now()+previous.delay;
   const confirmed=previous.kind==='attack'?data.ok&&typeof data.won==='boolean'&&(data.won===false||data.refreshed):data.won===true&&data.ok&&data.refreshed||data.won===false&&data.continueAuto&&data.surrendered;
   if(previous.kind==='negotiation'){
    const count=ledger[previous.scope]?.counts[previous.identity];
    if(count&&confirmed){count.pending=false;if(data.won)count.wins++;save();}
    else if(count&&data.notStarted){count.pending=false;save();}
   }
   if(!confirmed){stop(null,data.message||'Niepotwierdzony wynik — automaty zatrzymane.');return true;}
   if(previous.kind==='attack'){losses=data.won?0:losses+1;if(losses>=3)stop('attack','Autoatak zatrzymany po 3 porażkach z rzędu.');}
   changed();return true;
  }
  return {enable,stop,tick,result,resumeGuards(){if(!active&&!attack&&!negotiation)guardsPaused=false;},get guardsPaused(){return guardsPaused;},get active(){return active;},get state(){return {attack,negotiation,losses,status,active:active?{...active}:null};},get engaged(){return attack||negotiation||!!active;}};
 }
 const api={defaults,settings,eligible,create};root.FoeSectorAutomation=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
