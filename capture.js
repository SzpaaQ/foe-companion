(() => {
  'use strict';
  const LIMIT = 24000000;
  let collectBusy=false,cityOwner=null;const ownBuildings=new Map(),collectedStates=new Map();
  let transport=null,lastRequestId=0,paymentBusy=false;
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
    const {token,provinceId,reserve}=event.data;
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
        if(Number.isInteger(reserve)&&reserve>=0){
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
      nextWave=more?realm.battleType:null;
      if(more&&(!nextWave||nextWave.provinceId!==provinceId))throw Error('invalid wave');
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
      battleUncertain=fightSent;
      answer(false,'Etap: '+stage+'. '+error.message+(fightSent?' Nie potwierdzono wyniku wysłanej walki. Sprawdź stan w grze przed kolejną próbą.':' Walka nie została wysłana; można spróbować ponownie.'),{uncertain:fightSent});
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
    const {token,request}=event.data;
    const answer=(ok,message)=>window.postMessage({channel:'foe-contribution-result',token,ok,message},location.origin);
    if(paymentBusy||battleBusy||collectBusy)return answer(false,'Trwa inne żądanie. Nie wysłano wpłaty.');
    if(!transport||transport.blocked)return answer(false,'Brak gotowego połączenia do wpłaty. Otwórz perłę ponownie.');
    const values=request?.requestData;
    if(request?.requestClass!=='GreatBuildingsService'||request?.requestMethod!=='contributeForgePoints'||!Array.isArray(values)||values.length!==5||!values.slice(0,4).every(Number.isSafeInteger)||values[0]<0||values[1]<=0||values[2]<0||values[3]<=0||values[4]!==false)return answer(false,'Nieprawidłowa wpłata.');
    paymentBusy=true;
    const item={__class__:'ServerRequest',requestClass:'GreatBuildingsService',requestMethod:'contributeForgePoints',requestData:values,requestId:++lastRequestId};
    try{
      const headers={...transport.headers};if(!Object.keys(headers).some(k=>k.toLowerCase()==='content-type'))headers['Content-Type']='application/json';
      const response=await Reflect.apply(originalFetch,window,[transport.url,{method:'POST',headers,credentials:'same-origin',body:JSON.stringify([item])}]);
      const data=await response.json();emit(transport.url,JSON.stringify([item]),data);
      const list=Array.isArray(data)?data:[data];
      const error=list.find(r=>/error/i.test(r?.__class__||'')||r?.error);
      const accepted=list.some(r=>r?.requestId===item.requestId && r.requestClass==='GreatBuildingsService' && r.requestMethod==='contributeForgePoints' && r.responseData!==false && r.responseData!=null);
      answer(response.ok&&!error&&accepted,response.ok&&!error&&accepted?'Serwer potwierdził wpłatę.':'Brak jednoznacznego potwierdzenia. Sprawdź stan w grze przed ponowną wpłatą.');
    }catch{answer(false,'Nie udało się potwierdzić wpłaty. Sprawdź stan w grze; nie ponawiam automatycznie.');}
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
    const n = secret.length;
    const result = new Array(n).fill(null);
    const remaining = new Map();
    // Krok 1: blokuj dokładne trafienia (correct).
    for (let i = 0; i < n; i++) {
      if (guess[i] === secret[i]) { result[i] = 'correct'; }
      else { remaining.set(secret[i], (remaining.get(secret[i]) || 0) + 1); }
    }
    // Krok 2: wrong_person lub not_needed.
    for (let i = 0; i < n; i++) {
      if (result[i] !== null) continue;
      const g = guess[i];
      if ((remaining.get(g) || 0) > 0) {
        result[i] = 'wrong_person';
        remaining.set(g, remaining.get(g) - 1);
      } else {
        result[i] = 'not_needed';
      }
    }
    return result;
  }

  // Buduje listę wszystkich kombinacji (goods^5) — kandydatów.
  function negAllCandidates(goods) {
    const result = [];
    const n = goods.length;
    const total = n ** 5;
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
        const actual = negFeedback(secret, guess)[slotId];
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
    const moves = candidates.length <= 500 ? candidates : candidates.filter((_, i) => i % Math.ceil(candidates.length / 500) === 0);

    let best = null, bestScore = Infinity;
    for (const guess of moves) {
      // Zastąp zablokowane sloty ich wartościami.
      const g = guess.map((v, i) => locked[i] !== null ? locked[i] : v);
      const buckets = new Map();
      for (const secret of candidates) {
        const key = negFeedback(secret, g).join(',');
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      const worst = Math.max(...buckets.values());
      if (worst < bestScore) { bestScore = worst; best = g; }
    }
    return best;
  }

  let negBusy = false;
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'foe-negotiate') return;
    const {token, provinceId} = event.data;
    const answer = (ok, message, extra = {}) =>
      window.postMessage({channel: 'foe-negotiate-result', token, ok, message, ...extra}, location.origin);

    if (negBusy || battleBusy || paymentBusy || collectBusy) return answer(false, 'Trwa inne żądanie.');
    if (!battleTransport || battleUncertain) return answer(false, 'Brak zweryfikowanego połączenia. Odśwież grę i otwórz mapę.');
    if (!Number.isSafeInteger(provinceId) || provinceId < 0) return answer(false, 'Nieprawidłowy sektor.');

    negBusy = true;
    const connection = battleTransport;
    try {
      // 1. Pobierz mapę — sprawdź czy sektor jest otwarty i negocjowalny.
      const fresh = await battleCall(connection, 'GuildBattlegroundService', 'getBattleground', []);
      const province = fresh.map?.provinces?.find(p => (p.id ?? 0) === provinceId);
      if (!province || province.isSpawnSpot || province.ownerId === fresh.currentParticipantId || province.lockedUntil > Date.now() / 1000)
        throw Error('Sektor nie jest już otwarty do negocjacji.');
      // isAttackBattleType określa atak/obronę; oba typy pozwalają negocjować.

      // 2. Rozpocznij negocjację.
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
        // Wyślij tylko nierozwiązane sloty.
        const slots = guess
          .map((r, i) => ({__class__: 'NegotiationGameSlot', slotId: i, resourceId: r}))
          .filter((_, i) => locked[i] === null);

        // Poinformuj panel o proponowanym ruchu.
        window.postMessage({channel: 'foe-negotiate-turn', token, turn: turnNumber, guess, slots}, location.origin);

        const result = await battleCall(connection, 'NegotiationGameService', 'submitTurn', [slots, turnNumber]);
        if (result?.__class__ !== 'NegotiationGameResult') throw Error('Nieoczekiwana odpowiedź serwera.');

        const feedback = result.turnResult?.slots || [];
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
          answer(false, 'Wyczerpano limit tur negocjacji.', {won: false, turns: turnNumber});
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
      answer(false, error.message);
    } finally {
      negBusy = false;
    }
  });

  // Auto-negocjacja: odpowiednik auto-ataku, ale dla negocjacji.
  // Panel wysyła foe-negotiate-auto z {token, provinceId} żeby uruchomić jeden cykl.
  // Po zakończeniu (wygrana/porażka) panel decyduje czy kontynuować.
  // (Cykl = jedna kompletna negocjacja prowincji, identyczna z foe-negotiate.)
})();
