(() => {
  'use strict';
  const LIMIT = 24000000;
  // Dynamiczne wyciąganie soli z pliku JS gry — uruchamia się gdy gra załaduje ForgeHX-*.js
  (function autoUpdateSalt(){
    const extract=async url=>{
      try{
        const text=await fetch(url).then(r=>r.text());
        const m=text.match(/_signatureHash\s*\+\s*"([A-Za-z0-9+/]{40,}={0,2})"\s*\+/);
        if(m&&m[1]&&globalThis.FoeRequestSignature){
          globalThis.FoeRequestSignature.updateSalt(m[1]);
          console.debug('[foe-helper] Sól podpisu zaktualizowana z',url.split('/').pop());
        }
      }catch(e){console.debug('[foe-helper] Nie udało się pobrać soli:',e.message);}
    };
    // Sprawdź skrypty już załadowane
    for(const s of document.querySelectorAll('script[src*="ForgeHX"]'))extract(s.src);
    // Obserwuj nowe
    new MutationObserver(mutations=>{
      for(const m of mutations)for(const node of m.addedNodes){
        if(node.nodeName==='SCRIPT'&&node.src?.includes('ForgeHX'))extract(node.src);
      }
    }).observe(document.documentElement,{childList:true,subtree:true});
  })();
  let collectBusy=false,cityOwner=null;const ownBuildings=new Map(),collectedStates=new Map();
  let transport=null,lastRequestId=0,paymentBusy=false,paymentUncertain=false;
  let battleTransport=null,battleBusy=false,battleUncertain=false,nextWave=null;
  let mapRefreshTimer=null,mapRefreshing=false;
  function scheduleMapRefresh(){
    clearTimeout(mapRefreshTimer);
    mapRefreshTimer=setTimeout(async()=>{
      if(battleBusy||paymentBusy||collectBusy||mapRefreshing){scheduleMapRefresh();return;}
      if(!battleTransport)return;
      mapRefreshing=true;
      try{await battleCall(battleTransport,'GuildBattlegroundService','getBattleground',[]);}
      catch{window.postMessage({channel:'foe-map-refresh-error',message:'Nie odświeżono postępu po walce. Otwórz mapę ponownie.'},location.origin);}
      finally{mapRefreshing=false;}
    },300);
  }
  let battleReason='Nie przechwycono jeszcze podpisanego żądania gry.';
  const captureStats={version:2,requests:0,signed:0,verified:0,bodyType:'—'};
  function bodyText(body){
    if(typeof body==='string')return body;
    if(body instanceof ArrayBuffer)return new TextDecoder().decode(body);
    if(ArrayBuffer.isView(body))return new TextDecoder().decode(new Uint8Array(body.buffer,body.byteOffset,body.byteLength));
    return null;
  }
  function publishBattleState(){window.postMessage({channel:'foe-battle-ready',ready:!!battleTransport&&!battleUncertain,reason:battleUncertain?'Niepewny wynik poprzedniej operacji — odśwież grę.':battleReason,diagnostics:{...captureStats}},location.origin);}
  window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.channel==='foe-battle-state-query')publishBattleState();});
  function observeTransport(url,body,headers={}){
    if(!relevant(url))return;
    if(typeof Blob!=='undefined'&&body instanceof Blob){body.text().then(text=>observeTransport(url,text,headers)).catch(()=>{battleReason='Nie odczytano treści żądania Blob.';publishBattleState();});return;}
    captureStats.requests++;captureStats.bodyType=Object.prototype.toString.call(body);
    body=bodyText(body);
    if(body===null){battleReason='Nieobsługiwany format treści żądania: '+captureStats.bodyType;publishBattleState();return;}
    try{
      const batch=JSON.parse(body);if(!Array.isArray(batch))return;
      for(const request of batch)if(Number.isSafeInteger(request.requestId))lastRequestId=Math.max(lastRequestId,request.requestId);
      const signature=Object.entries(headers).find(([key])=>key.toLowerCase()==='signature')?.[1];
      const endpoint=new URL(url,location.href),h=endpoint.searchParams.get('h');
      if(signature&&h){
        captureStats.signed++;
        const verified=globalThis.FoeRequestSignature?.sign(h,body)===signature;
        if(verified)captureStats.verified++;
        battleTransport=verified?{url:endpoint.href,h,client:Object.entries(headers).find(([key])=>key.toLowerCase()==='client-identification')?.[1]}:null;
        battleReason=verified?'':!globalThis.FoeRequestSignature?'Nie załadowano modułu podpisu. Przeładuj rozszerzenie i grę.':'Podpis gry nie pasuje do obsługiwanej wersji klienta. Potrzebny aktualny plik JS i HAR.';
        publishBattleState();
      }else{
        if(!battleTransport){battleReason=!h?'Żądanie gry nie zawiera parametru sesji h.':'Przechwycono żądanie bez nagłówka Signature.';publishBattleState();}
      }
      if(!batch.some(r=>r.requestClass==='GreatBuildingsService'))return;
      // Kopiujemy nagłówki, ale pomijamy signature/checksum przy wysyłaniu własnych żądań.
      // Serwer nie weryfikuje tych nagłówków kryptograficznie — to kliencka metryka.
      const filteredHeaders={};
      for(const [k,v] of Object.entries(headers)){
        if(!/^(signature|checksum)$/i.test(k))filteredHeaders[k]=v;
      }
      transport={url:new URL(url,location.href).href,headers:filteredHeaders,blocked:false};
      window.postMessage({channel:'foe-payment-state',ready:true,reason:'',headerNames:Object.keys(filteredHeaders)},location.origin);
    }catch{battleReason='Nie udało się odczytać lub sprawdzić podpisu żądania.';publishBattleState();}
  }
  function relevant(url) {
    try { const u = new URL(url, location.href); return u.origin === location.origin && /\/game\/json(?:\?|$)/.test(u.pathname + u.search); } catch { return false; }
  }
  function emit(url, body, data, internal=false) {
    try {
      body=bodyText(body);
      if (typeof data === 'string') { if (data.length > LIMIT) return; data = JSON.parse(data); }
      if (!data || typeof data !== 'object') return;
      observeOpenNegotiation(data,body);
      if(!battleBusy&&(Array.isArray(data)?data:[data]).some(r=>r.requestClass==='BattlefieldService'&&r.requestMethod==='startByBattleType'&&r.responseData?.state?.ranking_data))scheduleMapRefresh();
      const queue=[data];for(let i=0;i<queue.length&&i<200000;i++){
        const v=queue[i];if(!v||typeof v!=='object')continue;
        if(v.requestClass==='StartupService'&&v.responseData?.city_map?.entities){cityOwner=v.responseData.user_data?.player_id;ownBuildings.clear();for(const e of v.responseData.city_map.entities)if(e.player_id===cityOwner)ownBuildings.set(e.id,e);}
        if(v.__class__==='CityMapEntity'&&ownBuildings.has(v.id)&&(v.player_id==null||v.player_id===cityOwner)&&!(/GuildRaids/.test(v.cityentity_id||'')))ownBuildings.set(v.id,{...ownBuildings.get(v.id),...v});
        for(const child of Object.values(v))if(child&&typeof child==='object')queue.push(child);
      }
      // Only method metadata is retained from requests; no cookies, headers or tokens.
      let methods = [];
      if (typeof body === 'string' && body.length < LIMIT) {
        try { const requests = JSON.parse(body); methods = (Array.isArray(requests) ? requests : [requests]).map(r => {
          const method={requestClass:r.requestClass,requestMethod:r.requestMethod,requestId:r.requestId};
          if(r.requestClass==='GreatBuildingsService' && ['getConstruction','contributeForgePoints'].includes(r.requestMethod) && Array.isArray(r.requestData)){
            const [entityId,playerId]=r.requestData;
            if(Number.isSafeInteger(entityId)&&Number.isSafeInteger(playerId))method.target={entityId,playerId};
          }
          return method;
        }); } catch {}
      }
      window.postMessage({channel:'foe-companion-v1', data, methods, internal, at:Date.now()}, location.origin);
    } catch { /* Observation must not interrupt the game. */ }
  }
  const originalFetch = window.fetch;
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-collect')return;
    const {token,entityId}=event.data,answer=(ok,message)=>window.postMessage({channel:'foe-collect-result',token,entityId,ok,message},location.origin);
    if(collectBusy||battleBusy||paymentBusy)return answer(false,'Trwa inne żądanie.');
    if(!battleTransport)return answer(false,'Brak zweryfikowanego podpisu żądań.');
    const e=ownBuildings.get(entityId),s=e?.state,stamp=JSON.stringify(s);
    const ready=['ProductionFinishedState','ProductionReadyState'].includes(s?.__class__)||(s?.__class__==='ProducingState'&&s.next_state_transition_at>0&&s.next_state_transition_at<=Date.now()/1000);
    if(!e||!ready||e.connected===0||collectedStates.get(entityId)===stamp)return answer(false,'Budynek nie jest gotowy lub ten zbiór już wysłano.');
    collectBusy=true;collectedStates.set(entityId,stamp);
    try{
      const data=await battleCall(battleTransport,'CityProductionService','pickupProduction',[[entityId]]);
      answer(true,'Serwer potwierdził odbiór zbioru.');
    }catch{answer(false,'Nie potwierdzono zbioru. Sprawdź budynek w grze; brak automatycznego ponawiania.');}
    finally{collectBusy=false;}
  });
  async function battleCall(connection,requestClass,requestMethod,requestData,responseMethod=requestMethod){
    const item={__class__:'ServerRequest',requestClass,requestMethod,requestData,requestId:++lastRequestId};
    const body=JSON.stringify([item]),headers={'Content-Type':'application/json',Signature:FoeRequestSignature.sign(connection.h,body)};
    if(connection.client)headers['Client-Identification']=connection.client;
    const response=await Reflect.apply(originalFetch,window,[connection.url,{method:'POST',credentials:'same-origin',headers,body,signal:AbortSignal.timeout(20000)}]);
    const data=await response.json();emit(connection.url,body,data,true);
    const list=Array.isArray(data)?data:[data];
    const serverError=list.map(r=>/error/i.test(r?.responseData?.__class__||'')?r.responseData:r).find(r=>/error/i.test(r?.__class__||'')||r?.error);
    if(!response.ok||serverError){
      const code=serverError?.code??serverError?.errorCode??serverError?.__class__??'brak kodu';
      throw Error('Żądanie '+requestMethod+' (ID '+item.requestId+'), HTTP '+response.status+', kod '+String(code).slice(0,100)+'.');
    }
    const result=list.find(r=>r.requestId===item.requestId&&r.requestClass===requestClass&&r.requestMethod===responseMethod)?.responseData;
    if(!result)throw Error('Brak potwierdzenia '+requestMethod+'.');
    return result;
  }
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-quick-battle')return;
    const {token,provinceId,reserve,automatic}=event.data;
    const answer=(ok,message,extra={})=>window.postMessage({channel:'foe-quick-battle-result',token,ok,message,...extra},location.origin);
    if(battleBusy||paymentBusy||collectBusy)return answer(false,'Trwa inne żądanie.');
    if(!battleTransport||battleUncertain)return answer(false,'Brak zweryfikowanego połączenia. Odśwież grę i otwórz mapę.');
    if(!Number.isSafeInteger(provinceId)||provinceId<0)return answer(false,'Nieprawidłowy sektor.');
    if(nextWave&&nextWave.provinceId!==provinceId)return answer(false,'Najpierw zakończ rozpoczętą walkę.');
    battleBusy=true;
    const type=nextWave||{__class__:'BattlegroundBattleType',attackerPlayerId:0,defenderPlayerId:0,type:'battleground',currentWaveId:0,totalWaves:0,provinceId,battlesWon:0,trial:0};
    const connection=battleTransport;let changed=false,fightSent=false,stage='pobranie armii';
    try{
      if(!nextWave){
        if(automatic===true&&Number.isInteger(reserve)&&reserve>=0){
          const fresh=await battleCall(connection,'GuildBattlegroundService','getBattleground',[]);
          let province=fresh.map?.provinces?.find(p=>(p.id??0)===provinceId);
          let conquest=province?.conquestProgress?.find(c=>c.participantId===fresh.currentParticipantId);
          if(!Number.isFinite(conquest?.maxProgress)){
            const detail=await battleCall(connection,'GuildBattlegroundService','getProvince',[provinceId]);
            if(detail?.__class__==='GuildBattlegroundProvince'&&(detail.id??0)===provinceId)province={...province,...detail};
            conquest=province?.conquestProgress?.find(c=>c.participantId===fresh.currentParticipantId);
          }
          const progress=conquest?.progress??0;
          if(!province||province.isSpawnSpot||province.ownerId===fresh.currentParticipantId||province.lockedUntil>Date.now()/1000)throw Error('Sektor nie jest już otwarty do walki.');
          // conquestProgress is an explicit empty array when the sector has never been attacked by our
          // guild — the server does not send maxProgress until there is history. Allow the fight; the
          // reserve guard is skipped because there is nothing to compare against.
          // When the server does send an entry for our participant but maxProgress is missing/invalid,
          // block: that indicates a data error rather than a genuinely new sector.
          if(!Array.isArray(province.conquestProgress))throw Error('Brak potwierdzonego progresu lub limitu sektora.');
          if(conquest&&(!Number.isFinite(conquest.maxProgress)||conquest.maxProgress<=0))throw Error('Brak potwierdzonego progresu lub limitu sektora.');
          if(Number.isFinite(conquest?.maxProgress)&&conquest.maxProgress>0){
            if(conquest.maxProgress-progress<=reserve)throw Error('Osiągnięto ustawiony zapas walk.');
          }
        }
        const context={__class__:'BattlegroundArmyContext',battleType:'battleground',provinceId};
        const army=await battleCall(connection,'ArmyUnitManagementService','getArmyInfo',[context]);
        const pools=FoeBattleArmy.plan(army);
        stage='wymiana armii';
        changed=true;
        const updated=await battleCall(connection,'ArmyUnitManagementService','updatePools',[pools,context],'getArmyInfo');
        stage='potwierdzenie składu';
        if(!FoeBattleArmy.confirmed(updated,pools))throw Error('Skład, liczba lub zdrowie jednostek nie odpowiadają planowi. Walka nie została wysłana.');
      }
      changed=true;
      stage='szybka walka';fightSent=true;
      const realm=await battleCall(connection,'BattlefieldService','startByBattleType',[type,true]);
      if(realm?.__class__!=='BattleRealm'||!realm.state?.ranking_data)throw Error('unconfirmed');
      const more=!!realm.state.ranking_data.nextArmy;
      const returnedType=realm.battleType;
      // Serializacja gry pomija liczbowe zera, w tym provinceId dla sektora 0.
      const returnedProvince=returnedType?.provinceId===undefined?0:returnedType.provinceId;
      if(more&&(!returnedType||returnedProvince!==provinceId)){
        const error=Error('invalid wave');error.invalidWave=true;throw error;
      }
      nextWave=more?{...returnedType,provinceId:returnedProvince}:null;
      const winner=realm.state.winnerBit;
      const won=winner===1?true:winner===2?false:null;
      let refreshed=false;
      if(!more){
        clearTimeout(mapRefreshTimer);
        try{
          const fresh=await battleCall(connection,'GuildBattlegroundService','getBattleground',[]);
          refreshed=Array.isArray(fresh.map?.provinces)&&fresh.currentParticipantId!=null;
        }catch{}
      }
      answer(true,more?'Fala zakończona — pozostała kolejna.':(won===true?'Wygrana.':won===false?'Przegrana.':'Nie rozpoznano wyniku walki.')+(refreshed?' Progres odświeżony.':' Nie potwierdzono aktualnego progresu — autoatak zatrzymany.'),{provinceId,nextWave:more,won,refreshed,battleId:realm.battleId});
    }catch(error){
      const invalidWave=error.invalidWave===true;
      if(invalidWave)nextWave=null;
      battleUncertain=fightSent&&!invalidWave;
      answer(false,'Etap: '+stage+'. '+error.message+(invalidWave?' Nie udało się powiązać kolejnej fali. Autoatak zatrzymany; możesz ręcznie rozpocząć kolejną walkę.':fightSent?' Nie potwierdzono wyniku wysłanej walki. Sprawdź stan w grze przed kolejną próbą.':' Walka nie została wysłana; można spróbować ponownie.'),{uncertain:battleUncertain,invalidWave});
    }finally{battleBusy=false;}
  });
  // Wire IDs share one sequence. Restore the game's IDs before its callbacks read a response.
  // We also remap unsigned game requests so that the game's own counter never reuses IDs
  // already sent by the extension — otherwise the server rejects them as duplicates.
  function prepareGameRequest(url,body,headers){
    try{
      const text=bodyText(body);if(!text||!relevant(url))return null;
      const h=new URL(url,location.href).searchParams.get('h');
      const signature=Object.entries(headers).find(([key])=>key.toLowerCase()==='signature')?.[1];
      const batch=JSON.parse(text);
      if(!Array.isArray(batch)||!batch.length||!batch.every(r=>Number.isSafeInteger(r.requestId)&&r.requestId>0))return null;
      // Unsigned requests: bump IDs that would collide with IDs already used by the extension,
      // but do not re-sign (no h or signature available / not ours to sign).
      if(!h||!signature||FoeRequestSignature.sign(h,text)!==signature){
        const needsBump=batch.some(r=>r.requestId<=lastRequestId);
        if(!needsBump)return null;
        // Shift every request above our lastRequestId while preserving relative order.
        const ids=new Map();let changed=false;
        const mapped=batch.map(r=>{
          const id=Math.max(lastRequestId+1,r.requestId);lastRequestId=id;
          ids.set(id,r.requestId);changed ||= id!==r.requestId;
          return {...r,requestId:id};
        });
        if(!changed)return null;
        // Return without a new signature — caller must re-sign or skip signature update.
        return {body:JSON.stringify(mapped),signature:null,ids};
      }
      const ids=new Map();let changed=false;
      const mapped=batch.map(r=>{
        const id=Math.max(lastRequestId+1,r.requestId);lastRequestId=id;
        ids.set(id,r.requestId);changed ||= id!==r.requestId;
        return {...r,requestId:id};
      });
      if(!changed)return null;
      const wire=JSON.stringify(mapped);
      return {body:wire,signature:FoeRequestSignature.sign(h,wire),ids};
    }catch{return null;}
  }
  function restoreGameResponse(value,mapping){
    if(!mapping)return value;
    const restore=r=>r&&typeof r==='object'&&mapping.ids.has(r.requestId)?{...r,requestId:mapping.ids.get(r.requestId)}:r;
    return Array.isArray(value)?value.map(restore):restore(value);
  }
  window.fetch = function (...args) {
    const url=args[0] instanceof Request?args[0].url:String(args[0]);
    if(!relevant(url))return Reflect.apply(originalFetch,this,args);
    const receiver=this;
    return (async()=>{
      const body=args[1]?.body??(args[0] instanceof Request?await args[0].clone().text():undefined);
      const text=typeof Blob!=='undefined'&&body instanceof Blob?await body.text():body;
      const headers=new Headers(args[1]?.headers||(args[0] instanceof Request?args[0].headers:{}));
      const mapping=prepareGameRequest(url,text,Object.fromEntries(headers));
      observeTransport(url,text,Object.fromEntries(headers));
      if(mapping){if(mapping.signature!=null)headers.set('Signature',mapping.signature);args[1]={...args[1],headers,body:mapping.body};}
      const response=await Reflect.apply(originalFetch,receiver,args);
      if(mapping){
        const raw=await response.text();let restored=raw;
        try{const data=restoreGameResponse(JSON.parse(raw),mapping);restored=JSON.stringify(data);emit(url,text,data);}catch{}
        const responseHeaders=new Headers(response.headers);responseHeaders.delete('content-length');responseHeaders.delete('content-encoding');
        return new Response(restored,{status:response.status,statusText:response.statusText,headers:responseHeaders});
      }
      response.clone().text().then(data=>emit(url,text,data)).catch(()=>{});
      return response;
    })();
  };
  const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
  const urls=new WeakMap(),requestHeaders=new WeakMap(),translations=new WeakMap();
  const setHeader=XMLHttpRequest.prototype.setRequestHeader;
  const textDescriptor=Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype,'responseText');
  const responseDescriptor=Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype,'response');
  if(setHeader)XMLHttpRequest.prototype.setRequestHeader=function(name,value){const headers=requestHeaders.get(this)||{};headers[name]=value;requestHeaders.set(this,headers);if(relevant(urls.get(this))&&name.toLowerCase()==='signature')return;return Reflect.apply(setHeader,this,[name,value]);};
  XMLHttpRequest.prototype.open=function(...args){
    urls.set(this,String(args[1]));requestHeaders.set(this,{});translations.delete(this);
    return Reflect.apply(open,this,args);
  };
  XMLHttpRequest.prototype.send=function(...args){
    const url=urls.get(this),originalBody=args[0],headers=requestHeaders.get(this)||{};
    // Install getters before sending: they also work for onload/onreadystatechange registered by the game earlier.
    let canTranslate=false;
    if(relevant(url)&&textDescriptor?.get&&responseDescriptor?.get){
      try{
        Object.defineProperty(this,'responseText',{configurable:true,get(){
          const raw=textDescriptor.get.call(this),mapping=translations.get(this);
          if(!mapping||this.readyState!==4)return raw;
          try{return JSON.stringify(restoreGameResponse(JSON.parse(raw),mapping));}catch{return raw;}
        }});
        Object.defineProperty(this,'response',{configurable:true,get(){
          const raw=responseDescriptor.get.call(this),mapping=translations.get(this);
          if(!mapping||this.readyState!==4)return raw;
          if(this.responseType==='json')return restoreGameResponse(raw,mapping);
          if(this.responseType===''||this.responseType==='text'){try{return JSON.stringify(restoreGameResponse(JSON.parse(raw),mapping));}catch{}}
          return raw;
        }});
        canTranslate=this.responseType===''||this.responseType==='text'||this.responseType==='json';
      }catch{}
    }
    const mapping=canTranslate?prepareGameRequest(url,originalBody,headers):null;
    observeTransport(url,originalBody,headers);
    if(mapping){translations.set(this,mapping);args[0]=mapping.body;}
    const signature=mapping?.signature??Object.entries(headers).find(([key])=>key.toLowerCase()==='signature')?.[1];
    if(relevant(url)&&signature)Reflect.apply(setHeader,this,['Signature',signature]);
    if(relevant(url))this.addEventListener('load',()=>{
      try{emit(url,originalBody,this.responseType==='json'?this.response:this.responseType===''||this.responseType==='text'?this.responseText:null);}catch{}
    },{once:true});
    return Reflect.apply(send,this,args);
  };
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-contribute')return;
    const {token,request,desiredTotal,lock}=event.data;
    const answer=(ok,message)=>window.postMessage({channel:'foe-contribution-result',token,ok,message},location.origin);
    if(paymentBusy||battleBusy||collectBusy||negBusy)return answer(false,'Trwa inne żądanie. Nie wysłano wpłaty.');
    if(paymentUncertain)return answer(false,'Poprzednia wpłata niepotwierdzona. Sprawdź stan i odśwież grę.');
    if(!battleTransport||battleUncertain)return answer(false,'Brak podpisanego połączenia do wpłaty. Otwórz perłę ponownie.');
    const values=request?.requestData;
    if(request?.requestClass!=='GreatBuildingsService'||request?.requestMethod!=='contributeForgePoints'||!Array.isArray(values)||values.length!==5||!values.slice(0,4).every(Number.isSafeInteger)||values[0]<0||values[1]<=0||values[2]<0||values[3]<=0||values[4]!==false)return answer(false,'Nieprawidłowa wpłata.');
    paymentBusy=true;
    let sent=false;
    try{
      if(!Number.isSafeInteger(cityOwner)||!Number.isSafeInteger(desiredTotal)||desiredTotal<=0)throw Error('Brak danych do sprawdzenia Twojej wpłaty. Otwórz miasto i perłę.');
      const fresh=await battleCall(battleTransport,'GreatBuildingsService','getConstruction',values.slice(0,2));
      if(!Array.isArray(fresh?.rankings))throw Error('Nie odczytano bieżących wpłat.');
      const paid=fresh.rankings.find(r=>r.player?.player_id===cityOwner)?.forge_points??0;
      if(!Number.isSafeInteger(paid)||paid<0)throw Error('Nieprawidłowy stan Twojej wpłaty.');
      let remaining=Math.max(0,desiredTotal-paid);
      if(lock){
        if(values[1]!==cityOwner||![lock.total,lock.rank,lock.amount].every(Number.isSafeInteger)||lock.total<0||lock.rank<1||lock.rank>5||lock.amount<0)throw Error('Nieprawidłowe dane bloku.');
        if(fresh.rankings.some(r=>!Number.isSafeInteger(r.forge_points??0)||(r.forge_points??0)<0))throw Error('Nieprawidłowy ranking.');
        const rest=Math.max(0,lock.total-fresh.rankings.reduce((sum,r)=>sum+(r.forge_points??0),0));
        const actual=fresh.rankings.find(r=>r.rank===lock.rank&&r.player?.player_id!==cityOwner)?.forge_points??0;
        remaining=Math.max(0,rest-(actual>0?actual:2*lock.amount));
      }
      if(!remaining){answer(true,'Docelowa kwota jest już wpłacona. Nie wysłano wpłaty.');return;}
      if(remaining>values[3])throw Error('Stan wpłat zmienił się. Sprawdź aktualne kwoty przed ponowieniem.');
      const updated=[...values];updated[3]=remaining;sent=true;
      const result=await battleCall(battleTransport,'GreatBuildingsService','contributeForgePoints',updated);
      if(!Array.isArray(result))throw Error('Nieoczekiwane potwierdzenie wpłaty.');
      answer(true,'Serwer potwierdził wpłatę '+remaining+' PR.');
    }catch(error){if(sent)paymentUncertain=true;answer(false,sent?'Nie udało się potwierdzić wpłaty. Sprawdź stan w grze i odśwież kartę przed ponowieniem.':error.message);}
    finally{paymentBusy=false;}
  });

  // ─── Negocjacje Pól Chwały ────────────────────────────────────────────────
  // Solver Mastermind dla NegotiationGame:
  //   5 slotów (graczy), N dostępnych towarów (z possibleCosts).
  //   Każda tura: serwer odpowiada per slot: correct / wrong_person / not_needed.
  //   Tylko nierozwiązane sloty są wysyłane ponownie.

  // feedback_for(secret, guess) → ['correct'|'wrong_person'|'not_needed', ...]
  // Port logiki z foe_negotiation_trainer.py (funkcja feedback_for).
  function negFeedback(secret, guess) {
    // Oferty są oceniane niezależnie: wrong_person oznacza obecność towaru
    // u nadal nierozwiązanej osoby. Najpierw usuwamy trafienia correct,
    // ale nie zużywamy wystąpień podczas oceny kolejnych wrong_person.
    const unresolved=secret.filter((resource,i)=>guess[i]!==resource);
    return guess.map((resource,i)=>resource===secret[i]?'correct':unresolved.includes(resource)?'wrong_person':'not_needed');
  }

  // Buduje listę wszystkich kombinacji (goods^5) — kandydatów.
  function negAllCandidates(goods) {
    const result = [];
    const n = goods.length;
    const total = n ** 5;
    if(total>200000)throw Error('Zbyt wiele kombinacji dla lokalnego solvera.');
    for (let i = 0; i < total; i++) {
      let x = i;
      const c = new Array(5);
      for (let s = 4; s >= 0; s--) { c[s] = goods[x % n]; x = Math.floor(x / n); }
      result.push(c);
    }
    return result;
  }

  // Filtruje kandydatów na podstawie feedbacku jednej tury.
  // slots: [{slotId, resourceId, state}] — tylko wysłane sloty tej tury.
  // guess: pełna tablica 5 elementów (z locked dla rozwiązanych, null dla nieobecnych).
  function negFilter(candidates, guess, slots) {
    return candidates.filter(secret => {
      for (const {slotId, resourceId, state} of slots) {
        const actual = negFeedback(secret, guess)[slotId??0];
        if (actual !== state) return false;
      }
      return true;
    });
  }

  // Wybiera najlepszy następny ruch minimizując oczekiwany worst-case.
  // Szybka wersja: próbkuje do 500 kandydatów jako ruchy jeśli pula duża.
  function negBestGuess(candidates, goods, locked) {
    // Pewne rozwiązanie: dla każdego slotu wszyscy kandydaci mają ten sam towar.
    const certain = new Array(5).fill(null);
    let allCertain = true;
    for (let s = 0; s < 5; s++) {
      if (locked[s] !== null) { certain[s] = locked[s]; continue; }
      const vals = new Set(candidates.map(c => c[s]));
      if (vals.size === 1) certain[s] = [...vals][0];
      else allCertain = false;
    }
    if (allCertain) return certain;

    // Wygeneruj dozwolone ruchy: respektuj locked i nie powtarzaj odrzuconych.
    const moves = candidates.length <= 64 ? candidates : candidates.filter((_, i) => i % Math.ceil(candidates.length / 64) === 0);

    const sample=candidates.length<=256?candidates:candidates.filter((_,i)=>i%Math.ceil(candidates.length/256)===0);
    let best = null, bestScore = Infinity;
    for (const guess of moves) {
      // Zastąp zablokowane sloty ich wartościami.
      const g = guess.map((v, i) => locked[i] !== null ? locked[i] : v);
      const buckets = new Map();
      for (const secret of sample) {
        const key = negFeedback(secret, g).join(',');
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      const worst = Math.max(...buckets.values());
      if (worst < bestScore) { bestScore = worst; best = g; }
    }
    return best;
  }

  let negBusy = false;
  let openNegotiation=null;
  let questNegotiation=null;
  const questStates=new Map();
  function questNegotiationStatus(){
    if(!questNegotiation||questNegotiation.type!=='quest')return '';
    const quest=questStates.get(questNegotiation.id);
    if(!quest)return '';
    if(quest.state==='collectReward')return 'Misja ukończona — odbierz nagrodę w grze.';
    if(['closed','expired','aborted'].includes(quest.state))return 'Ta misja nie jest już aktywna. Otwórz nową negocjację.';
    const condition=quest.conditions.find(c=>c.id===questNegotiation.condition);
    if(condition&&condition.maxProgress>0&&condition.currentProgress>=condition.maxProgress)return 'Warunek negocjacji ukończony. Wybierz kolejne zadanie w grze.';
    return '';
  }
  function observeOpenNegotiation(data,body){
    let requests=[];try{requests=JSON.parse(body||'[]');if(!Array.isArray(requests))requests=[];}catch{}
    const responses=Array.isArray(data)?data:[data];
    for(const response of responses){
      if(response?.requestClass==='QuestService'&&response.requestMethod==='getUpdates'&&Array.isArray(response.responseData)){
        for(const quest of response.responseData){
          if(!Number.isSafeInteger(quest?.id))continue;
          questStates.set(quest.id,{state:quest.state,conditions:(quest.successConditions||[]).map(c=>({id:c.id,currentProgress:c.currentProgress??0,maxProgress:c.maxProgress}))});
        }
      }
    }
    for(const response of responses){
      const value=response?.responseData;
      const game=value?.__class__==='NegotiationGame'?value:value?.game;
      if(game?.__class__==='NegotiationGame'){
        if(response.requestClass==='QuestService'&&response.requestMethod==='startNegotiation'){
          const request=requests.find(r=>r.requestClass==='QuestService'&&r.requestMethod==='startNegotiation'&&r.requestId===response.requestId);
          const args=request?.requestData;
          questNegotiation=Array.isArray(args)?{id:args[0],condition:args[1],type:args[2]}:null;
        }else if(game.context!=='quest')questNegotiation=null;
        const reason=game.context==='quest'?questNegotiationStatus():'';
        const active=!reason&&game.context&&game.context!=='guildBattleground'&&(!value.state||value.state==='ongoing');
        const changed=openNegotiation?.context!==game.context||value===game;
        openNegotiation=active?game:null;
        window.postMessage({channel:'foe-open-negotiation',game:openNegotiation,detected:active&&changed,reason},location.origin);
      }else if(response?.requestClass==='NegotiationGameService'&&((response.requestMethod==='giveUp'&&value?.__class__==='Success')||['won','out_of_turns'].includes(value?.state))){
        openNegotiation=null;window.postMessage({channel:'foe-open-negotiation',game:null},location.origin);
      }
    }
    const reason=questNegotiationStatus();
    if(reason){openNegotiation=null;window.postMessage({channel:'foe-open-negotiation',game:null,reason},location.origin);}
  }
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin)return;
    if(event.data?.channel==='foe-open-negotiation-query'){
      window.postMessage({channel:'foe-open-negotiation',game:openNegotiation,reason:questNegotiationStatus()},location.origin);return;
    }
    if(event.data?.channel!=='foe-open-negotiate')return;
    const {token}=event.data;
    const send=(kind,extra)=>window.postMessage({channel:'foe-open-nego-'+kind,token,...extra},location.origin);
    if(questNegotiationStatus())return send('result',{message:questNegotiationStatus()});
    if(negBusy||battleBusy||paymentBusy||collectBusy)return send('result',{message:'Trwa inne żądanie.'});
    if(!battleTransport||battleUncertain)return send('result',{message:'Brak zweryfikowanego połączenia. Odśwież grę.'});
    negBusy=true;
    const connection=battleTransport;
    let context=null;
    const surrender=async()=>{
      const current=await battleCall(connection,'NegotiationGameService','getRunning',[]);
      if(current?.game?.context!==context||!['ongoing','out_of_turns'].includes(current.state))return;
      const result=await battleCall(connection,'NegotiationGameService','giveUp',[]);
      if(result?.__class__!=='Success')throw Error('Nie potwierdzono poddania.');
    };
    try{
      const running=await battleCall(connection,'NegotiationGameService','getRunning',[]);
      const game=running?.game;
      if(!game?.context||game.context==='guildBattleground'||running.state!=='ongoing')throw Error('Otwórz aktywną negocjację poza Polami Chwały.');
      const goods=Object.keys(game.possibleCosts?.resources||{});
      if(!goods.length||goods.length>10||!Array.isArray(running.history))throw Error('Nieobsługiwany format negocjacji.');
      let candidates=negAllCandidates(goods),locked=Array(5).fill(null);
      const apply=feedback=>{
        const guess=[...locked];
        for(const slot of feedback){
          const id=slot.slotId??0;
          if(!Number.isInteger(id)||id<0||id>4||!goods.includes(slot.resourceId)||!['correct','wrong_person','not_needed'].includes(slot.state))throw Error('Nieobsługiwany wynik tury.');
          guess[id]=slot.resourceId;
        }
        if(guess.some(v=>v===null))throw Error('Niepełna historia negocjacji.');
        candidates=negFilter(candidates,guess,feedback.map(s=>({...s,slotId:s.slotId??0})));
        for(const s of feedback)if(s.state==='correct')locked[s.slotId??0]=s.resourceId;
      };
      for(const turn of running.history)apply(turn.slots||[]);
      context=game.context;
      send('started',{goods,context,history:running.history});
      for(let turn=running.history.length+1;turn<=10;turn++){
        await new Promise(resolve=>setTimeout(resolve,0));
        const guess=negBestGuess(candidates,goods,locked);
        if(!Array.isArray(guess))throw Error('Brak zgodnego rozwiązania.');
        const slots=guess.map((resourceId,slotId)=>({__class__:'NegotiationGameSlot',slotId,resourceId})).filter(s=>locked[s.slotId]===null);
        send('turn',{turn,guess});
        const result=await battleCall(connection,'NegotiationGameService','submitTurn',[slots,turn]);
        if(result?.__class__!=='NegotiationGameResult')throw Error('Nieoczekiwany wynik tury.');
        send('feedback',{turn,feedback:result.turnResult?.slots||[],state:result.state});
        if(result.state==='won'){
          // Dla misji (quest): automatycznie odbierz nagrodę i wykryj następną
          if(context==='quest'&&questNegotiation){
            const qid=questNegotiation.id;
            try{
              const item={__class__:'ServerRequest',requestClass:'QuestService',requestMethod:'advanceQuest',requestData:[qid],requestId:++lastRequestId};
              const body=JSON.stringify([item]),headers={'Content-Type':'application/json',Signature:FoeRequestSignature.sign(connection.h,body)};
              if(connection.client)headers['Client-Identification']=connection.client;
              const resp=await Reflect.apply(originalFetch,window,[connection.url,{method:'POST',credentials:'same-origin',headers,body,signal:AbortSignal.timeout(20000)}]);
              const batch=await resp.json();emit(connection.url,body,batch,true);
              const list=Array.isArray(batch)?batch:[batch];
              const updates=list.find(r=>r.requestClass==='QuestService'&&r.requestMethod==='getUpdates')?.responseData;
              let nextQuest=null;
              if(Array.isArray(updates)){
                for(const q of updates){
                  if(!Number.isSafeInteger(q?.id)||q.id===qid||q.state!=='accepted')continue;
                  const negCond=(q.successConditions||[]).find(c=>c.flags?.includes('negotiate_condition')&&(c.currentProgress??0)<(c.maxProgress??1));
                  if(negCond){nextQuest={id:q.id,condition:negCond.id,title:q.title||String(q.id)};break;}
                }
              }
              send('result',{won:true,message:'Wygrana. Nagroda odebrana.',nextQuest});
            }catch(advErr){
              send('result',{won:true,message:'Wygrana. Nie udało się odebrać nagrody: '+advErr.message});
            }
          }else{
            send('result',{won:true,message:'Wygrana.'});
          }
          return;
        }
        if(result.state==='out_of_turns'){await surrender();send('result',{won:false,message:'Przegrana — negocjacja poddana.'});return;}
        if(result.state!=='ongoing')throw Error('Nieznany stan negocjacji.');
        apply(result.turnResult?.slots||[]);
      }
      throw Error('Osiągnięto limit tur.');
    }catch(error){
      let cleanup='';
      if(context)try{await surrender();cleanup=' Negocjacja zamknięta.';}catch{cleanup=' Sprawdź stan negocjacji w grze.';}
      send('result',{message:error.message+cleanup});
    }finally{negBusy=false;}
  });
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'foe-negotiate') return;
    const {token, provinceId, reserve} = event.data;
    const answer = (ok, message, extra = {}) =>
      window.postMessage({channel: 'foe-negotiate-result', token, ok, message, ...extra}, location.origin);

    if (negBusy || battleBusy || paymentBusy || collectBusy) return answer(false, 'Trwa inne żądanie.');
    if (!battleTransport || battleUncertain) return answer(false, 'Brak zweryfikowanego połączenia. Odśwież grę i otwórz mapę.');
    if (!Number.isSafeInteger(provinceId) || provinceId < 0) return answer(false, 'Nieprawidłowy sektor.');

    negBusy = true;
    const connection = battleTransport;let started=false;
    try {
      // 1. Pobierz mapę — sprawdź czy sektor jest otwarty i negocjowalny.
      const fresh = await battleCall(connection, 'GuildBattlegroundService', 'getBattleground', []);
      const province = fresh.map?.provinces?.find(p => (p.id ?? 0) === provinceId);
      if (!province || province.isSpawnSpot || province.ownerId === fresh.currentParticipantId || province.lockedUntil > Date.now() / 1000)
        throw Error('Sektor nie jest już otwarty do negocjacji.');
      // isAttackBattleType określa atak/obronę; oba typy pozwalają negocjować.

      if(Number.isInteger(reserve)&&reserve>=0){
        let progress=province.conquestProgress?.find(p=>p.participantId===fresh.currentParticipantId);
        if(!Number.isFinite(progress?.maxProgress)){
          const detail=await battleCall(connection,'GuildBattlegroundService','getProvince',[provinceId]);
          progress=detail?.conquestProgress?.find(p=>p.participantId===fresh.currentParticipantId);
        }
        if(!Number.isFinite(progress?.maxProgress))throw Error('Brak potwierdzonego limitu sektora — auto-negocjacja zatrzymana.');
        if(progress.maxProgress-(progress.progress??0)-2<reserve)throw Error('Osiągnięto zapas: pozostaw '+reserve+' walk. Negocjacja może dodać 2 punkty progresu.');
      }
      // 2. Rozpocznij negocjację.
      started=true;
      const game = await battleCall(connection, 'GuildBattlegroundService', 'startNegotiation', [provinceId]);
      if (game?.__class__ !== 'NegotiationGame') throw Error('Nie uruchomiono negocjacji.');

      const goods = Object.keys(game.possibleCosts?.resources || {});
      if (!goods.length) throw Error('Brak listy towarów w negocjacji.');

      // Wyślij dane gry do panelu.
      window.postMessage({channel: 'foe-negotiate-started', token, provinceId, goods, costs: game.possibleCosts.resources}, location.origin);

      // 3. Solver Mastermind.
      let candidates = negAllCandidates(goods);
      const locked = new Array(5).fill(null); // locked[slotId] = resourceId po correct
      let turnNumber = 1;
      const MAX_TURNS = 10; // bezpiecznik — serwer sam zwróci out_of_turns

      while (turnNumber <= MAX_TURNS) {
        // Wyznacz ruch.
        const guess = negBestGuess(candidates, goods, locked);
        if(!Array.isArray(guess)){
          const surrendered=await battleCall(connection,'NegotiationGameService','giveUp',[]);
          if(surrendered?.__class__!=='Success')throw Error('Nie potwierdzono poddania negocjacji. Sprawdź jej stan w grze.');
          answer(false,'Solver nie znalazł zgodnego rozwiązania. Negocjacja poddana; automatyzacja zatrzymana.',{won:false,surrendered:true});
          return;
        }
        // Wyślij tylko nierozwiązane sloty.
        const slots = guess
          .map((r, i) => ({__class__: 'NegotiationGameSlot', slotId: i, resourceId: r}))
          .filter((_, i) => locked[i] === null);

        // Poinformuj panel o proponowanym ruchu.
        window.postMessage({channel: 'foe-negotiate-turn', token, turn: turnNumber, guess, slots}, location.origin);

        const result = await battleCall(connection, 'NegotiationGameService', 'submitTurn', [slots, turnNumber]);
        if (result?.__class__ !== 'NegotiationGameResult') throw Error('Nieoczekiwana odpowiedź serwera.');

        const feedback = (result.turnResult?.slots || []).map(slot=>({...slot,slotId:slot.slotId??0}));
        // Poinformuj panel o wyniku tury.
        window.postMessage({channel: 'foe-negotiate-feedback', token, turn: turnNumber, state: result.state, feedback}, location.origin);

        if (result.state === 'won') {
          // Odśwież mapę po wygranej.
          let refreshed = false;
          try {
            await battleCall(connection, 'GuildBattlegroundService', 'getBattleground', []);
            refreshed = true;
          } catch {}
          answer(true, 'Negocjacja zakończona sukcesem w ' + turnNumber + ' ' + (turnNumber === 1 ? 'turze' : turnNumber < 5 ? 'turach' : 'turach') + '.', {won: true, turns: turnNumber, refreshed});
          return;
        }
        if (result.state === 'out_of_turns') {
          const surrendered=await battleCall(connection,'NegotiationGameService','giveUp',[]);
          if(surrendered?.__class__!=='Success')throw Error('Nie potwierdzono poddania przegranej negocjacji. Sprawdź jej stan w grze.');
          answer(false, 'Wyczerpano limit tur. Negocjacja poddana.', {won: false, turns: turnNumber,surrendered:true,continueAuto:true});
          return;
        }

        // Aktualizuj locked i filtruj kandydatów.
        const fullFeedback = [...feedback]; // tylko wysłane sloty
        for (const fb of feedback) {
          if (fb.state === 'correct') locked[fb.slotId] = fb.resourceId;
        }
        // Odbuduj pełny guess (z locked) dla filtrowania.
        candidates = negFilter(candidates, guess, feedback);
        turnNumber++;
      }
      answer(false, 'Osiągnięto wewnętrzny limit bezpieczeństwa tur.', {won: false});
    } catch (error) {
      let cleanup='';
      if(started){
        try{
          const running=await battleCall(connection,'NegotiationGameService','getRunning',[]);
          if(running?.game?.context==='guildBattleground'&&['ongoing','out_of_turns'].includes(running.state)){
            const result=await battleCall(connection,'NegotiationGameService','giveUp',[]);
            if(result?.__class__!=='Success')throw Error('brak potwierdzenia');
            cleanup=' Aktywna negocjacja została poddana.';
          }
        }catch{cleanup=' Nie potwierdzono zamknięcia negocjacji — sprawdź ją w grze.';}
      }
      answer(false, error.message+cleanup+' Auto-negocjacje zatrzymane. Sprawdź dostępność towarów przed ponownym uruchomieniem.',{stopAuto:true});
    } finally {
      negBusy = false;
    }
  });

  // Auto-negocjacja: odpowiednik auto-ataku, ale dla negocjacji.
  // Panel wysyła foe-negotiate-auto z {token, provinceId} żeby uruchomić jeden cykl.
  // Po zakończeniu (wygrana/porażka) panel decyduje czy kontynuować.
  // (Cykl = jedna kompletna negocjacja prowincji, identyczna z foe-negotiate.)

  // ─── Automisje powtarzalne ────────────────────────────────────────────────
  // Wykonuje misje generyczne z warunkami wpłaty monet/zaopatrzenia (pay_condition).
  // Misje z innymi warunkami są przerywane. Pętla trwa dopóki są zasoby lub panel nie zatrzyma.
  let questAutoBusy=false,questAutoAbort=false;
  function questBatchCall(conn,requestClass,requestMethod,requestData){
    const item={__class__:'ServerRequest',requestClass,requestMethod,requestData,requestId:++lastRequestId};
    const body=JSON.stringify([item]),headers={'Content-Type':'application/json',Signature:FoeRequestSignature.sign(conn.h,body)};
    if(conn.client)headers['Client-Identification']=conn.client;
    return Reflect.apply(originalFetch,window,[conn.url,{method:'POST',credentials:'same-origin',headers,body,signal:AbortSignal.timeout(20000)}])
      .then(r=>r.json().then(data=>{emit(conn.url,body,data,true);return {ok:r.ok,list:Array.isArray(data)?data:[data]};}));
  }
  function questFindError(list){
    return list.map(r=>/error/i.test(r?.responseData?.__class__||'')?r.responseData:r).find(r=>/error/i.test(r?.__class__||'')||r?.error);
  }
  function questGetUpdates(list){
    return list.find(r=>r.requestClass==='QuestService'&&r.requestMethod==='getUpdates')?.responseData;
  }
  function questGetResources(list){
    const bag=list.find(r=>r.requestClass==='ResourceService'&&r.requestMethod==='getPlayerResourceBag')?.responseData;
    return bag?.resources?.resources||bag?.resources||null;
  }
  function questRewardLabel(rewards){
    // Akumuluje nagrody do mapy subType→{name,amount} — używana do zbierania sum
    if(!Array.isArray(rewards))return;
    // (zastąpiona przez questAccumRewards — zachowana jako stub)
  }
  function questAccumRewards(acc,rewards){
    // acc: Map subType → {name, amount}
    if(!Array.isArray(rewards))return;
    for(const r of rewards){
      if(!r||r.flags?.includes('hidden')||!r.subType)continue;
      const key=r.subType;
      if(acc.has(key)){acc.get(key).amount+=Number(r.amount)||0;}
      else{acc.set(key,{name:r.name||r.subType,amount:Number(r.amount)||0,iconAssetName:r.iconAssetName||''});}
    }
  }
  window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.channel==='foe-quest-auto-stop')questAutoAbort=true;});
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-quest-auto')return;
    const {token,minMoney,minSupplies}=event.data;
    const upd=(status,log,done=false,rewards=null)=>window.postMessage({channel:'foe-quest-auto-update',token,status,log,done,...(rewards?{rewards:Object.fromEntries(rewards)}:{})},location.origin);
    if(questAutoBusy||battleBusy||paymentBusy||collectBusy||negBusy)return upd('Trwa inne żądanie.',null,true);
    if(!battleTransport||battleUncertain)return upd('Brak zweryfikowanego połączenia. Odśwież grę.',null,true);
    questAutoBusy=true;questAutoAbort=false;
    const conn=battleTransport;
    try{
      // Pobierz listę misji
      let quests=[];
      {
        const {ok,list}=await questBatchCall(conn,'QuestService','getUpdates',[]);
        if(!ok||questFindError(list))throw Error('Nie udało się pobrać listy misji.');
        const raw=questGetUpdates(list);
        if(!Array.isArray(raw))throw Error('Nieoczekiwany format getUpdates.');
        quests=raw.filter(q=>q?.type==='generic'&&q?.state==='accepted');
        upd(`Pobrano ${quests.length} misji powtarzalnych.`);
      }
      // Pobierz zasoby osobnym żądaniem — getUpdates nie zawiera ResourceService w odpowiedzi
      let money=0,supplies=0;
      {
        const {ok,list}=await questBatchCall(conn,'ResourceService','getPlayerResourceBag',[]);
        if(!ok||questFindError(list))throw Error('Nie udało się odczytać zasobów gracza.');
        const res=questGetResources(list);
        if(!res)throw Error('Nieoczekiwany format zasobów gracza.');
        money=Number(res.money)||0;supplies=Number(res.supplies)||0;
        upd(`Zasoby: 🪙 ${money.toLocaleString('pl-PL')} · 🔨 ${supplies.toLocaleString('pl-PL')}`);
      }
      let done=0,aborted=0;
      const rewardsAcc=new Map();
      // Pętla misji
      outer: while(quests.length&&!questAutoAbort){
        const quest=quests[0];
        quests=quests.slice(1);
        const conds=quest.successConditions||[];
        // Sprawdź czy wszystkie warunki to pay_condition z money/supplies
        const payable=conds.every(c=>c.flags?.includes('pay_condition')&&c.payload?.some(p=>p.type==='pay'&&(p.cost?.resources?.money||p.cost?.resources?.supplies)));
        if(!payable){
          upd(`Pomijam: ${quest.title||quest.id}`,`⏭️ ${quest.title||quest.id}`);
          const {ok,list}=await questBatchCall(conn,'QuestService','abortQuest',[quest.id]);
          if(!ok||questFindError(list))throw Error('Błąd przy pomijaniu misji '+quest.id+'.');
          aborted++;
          // Zaktualizuj listę misji z odpowiedzi
          const fresh=questGetUpdates(list);
          if(Array.isArray(fresh)){const ids=new Set(quests.map(q=>q.id));quests=[...quests,...fresh.filter(q=>q?.type==='generic'&&q?.state==='accepted'&&!ids.has(q.id))];}
          continue;
        }
        // Sprawdź czy mamy wystarczająco zasobów
        let totalMoney=0,totalSupplies=0;
        for(const c of conds){for(const p of c.payload||[])if(p.type==='pay'){totalMoney+=p.cost?.resources?.money||0;totalSupplies+=p.cost?.resources?.supplies||0;}}
        if(money-totalMoney<minMoney||supplies-totalSupplies<minSupplies){
          upd(`Zatrzymano — niewystarczające zasoby (${quest.title||quest.id}).`,null,true);
          return;
        }
        upd(`Wykonuję: ${quest.title||quest.id} (🪙 ${totalMoney} · 🔨 ${totalSupplies})`);
        // Wykonaj warunki pay_condition — nagroda pojawia się po ostatnim paySuccessCondition
        let lastPayList=null;
        for(const c of conds){
          if(questAutoAbort)break outer;
          const {ok,list}=await questBatchCall(conn,'QuestService','paySuccessCondition',[quest.id,c.id,'quest']);
          if(!ok||questFindError(list))throw Error('Błąd paySuccessCondition misja '+quest.id+' warunek '+c.id+'.');
          lastPayList=list;
        }
        // Zbierz nagrodę z odpowiedzi ostatniego paySuccessCondition (stan collectReward)
        {
          const fresh=questGetUpdates(lastPayList);
          const doneQuest=Array.isArray(fresh)?fresh.find(q=>q?.id===quest.id&&q?.state==='collectReward'):null;
          questAccumRewards(rewardsAcc,doneQuest?.genericRewards);
        }
        // Odbierz nagrodę
        {
          const {ok,list}=await questBatchCall(conn,'QuestService','advanceQuest',[quest.id]);
          if(!ok||questFindError(list))throw Error('Błąd advanceQuest misja '+quest.id+'.');
          money-=totalMoney;supplies-=totalSupplies;done++;
          const fresh=questGetUpdates(list);
          if(Array.isArray(fresh)){const ids=new Set(quests.map(q=>q.id));quests=[...quests,...fresh.filter(q=>q?.type==='generic'&&q?.state==='accepted'&&!ids.has(q.id))];}
          upd(`Wykonano: ${quest.title||quest.id}`,`✅ ${quest.title||quest.id}`,false);
        }
      }
      upd(`Zakończono. Wykonano: ${done}, pominięto: ${aborted}.`,null,true,rewardsAcc);
    }catch(err){
      upd('Błąd: '+err.message,null,true);
    }finally{questAutoBusy=false;questAutoAbort=false;}
  });

  // Rozpoczęcie kolejnej misji-negocjacji po odebraniu nagrody (przycisk NEXT w panelu Nego)
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-quest-next')return;
    const {token,quest}=event.data;
    const answer=(ok,message,extra={})=>window.postMessage({channel:'foe-quest-next-result',token,ok,message,...extra},location.origin);
    if(!Number.isSafeInteger(quest?.id)||!Number.isSafeInteger(quest?.condition))return answer(false,'Brak danych kolejnej misji.');
    if(negBusy||battleBusy||paymentBusy||collectBusy)return answer(false,'Trwa inne żądanie.');
    if(!battleTransport||battleUncertain)return answer(false,'Brak połączenia. Odśwież grę.');
    negBusy=true;
    const conn=battleTransport;
    try{
      const item={__class__:'ServerRequest',requestClass:'QuestService',requestMethod:'startNegotiation',requestData:[quest.id,quest.condition,'quest'],requestId:++lastRequestId};
      const body=JSON.stringify([item]),headers={'Content-Type':'application/json',Signature:FoeRequestSignature.sign(conn.h,body)};
      if(conn.client)headers['Client-Identification']=conn.client;
      const resp=await Reflect.apply(originalFetch,window,[conn.url,{method:'POST',credentials:'same-origin',headers,body,signal:AbortSignal.timeout(20000)}]);
      const batch=await resp.json();emit(conn.url,body,batch,true);
      const list=Array.isArray(batch)?batch:[batch];
      const serverError=list.map(r=>/error/i.test(r?.responseData?.__class__||'')?r.responseData:r).find(r=>/error/i.test(r?.__class__||'')||r?.error);
      if(!resp.ok||serverError){const code=serverError?.code??serverError?.__class__??'brak kodu';throw Error('HTTP '+resp.status+', kod '+String(code).slice(0,80)+'.');}
      const game=list.find(r=>r.requestClass==='QuestService'&&r.requestMethod==='startNegotiation')?.responseData;
      if(game?.__class__!=='NegotiationGame')throw Error('Nieoczekiwana odpowiedź startNegotiation.');
      answer(true,'Kolejna misja-negocjacja rozpoczęta.',{game});
    }catch(err){answer(false,'Nie udało się rozpocząć kolejnej misji: '+err.message);}
    finally{negBusy=false;}
  });

  // Rozpoczęcie kolejnej misji-negocjacji po odebraniu nagrody (przycisk NEXT w panelu Nego)
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-quest-next')return;
    const {token,quest}=event.data;
    const answer=(ok,message,extra={})=>window.postMessage({channel:'foe-quest-next-result',token,ok,message,...extra},location.origin);
    if(!Number.isSafeInteger(quest?.id)||!Number.isSafeInteger(quest?.condition))return answer(false,'Brak danych kolejnej misji.');
    if(negBusy||battleBusy||paymentBusy||collectBusy)return answer(false,'Trwa inne żądanie.');
    if(!battleTransport||battleUncertain)return answer(false,'Brak połączenia. Odśwież grę.');
    negBusy=true;
    const conn=battleTransport;
    try{
      const item={__class__:'ServerRequest',requestClass:'QuestService',requestMethod:'startNegotiation',requestData:[quest.id,quest.condition,'quest'],requestId:++lastRequestId};
      const body=JSON.stringify([item]),headers={'Content-Type':'application/json',Signature:FoeRequestSignature.sign(conn.h,body)};
      if(conn.client)headers['Client-Identification']=conn.client;
      const resp=await Reflect.apply(originalFetch,window,[conn.url,{method:'POST',credentials:'same-origin',headers,body,signal:AbortSignal.timeout(20000)}]);
      const batch=await resp.json();emit(conn.url,body,batch,true);
      const list=Array.isArray(batch)?batch:[batch];
      const serverError=list.map(r=>/error/i.test(r?.responseData?.__class__||'')?r.responseData:r).find(r=>/error/i.test(r?.__class__||'')||r?.error);
      if(!resp.ok||serverError){const code=serverError?.code??serverError?.__class__??'brak kodu';throw Error('HTTP '+resp.status+', kod '+String(code).slice(0,80)+'.');}
      const game=list.find(r=>r.requestClass==='QuestService'&&r.requestMethod==='startNegotiation')?.responseData;
      if(game?.__class__!=='NegotiationGame')throw Error('Nieoczekiwana odpowiedź startNegotiation.');
      answer(true,'Kolejna misja-negocjacja rozpoczęta.',{game});
    }catch(err){answer(false,'Nie udało się rozpocząć kolejnej misji: '+err.message);}
    finally{negBusy=false;}
  });
})();
