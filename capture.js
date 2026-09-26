(() => {
  'use strict';
  const LIMIT = 24000000;
  let transport=null,lastRequestId=0,paymentBusy=false;
  function observeTransport(url,body,headers={}){
    if(!relevant(url)||typeof body!=='string')return;
    try{
      const batch=JSON.parse(body);if(!Array.isArray(batch))return;
      for(const request of batch)if(Number.isSafeInteger(request.requestId))lastRequestId=Math.max(lastRequestId,request.requestId);
      if(!batch.some(r=>r.requestClass==='GreatBuildingsService'))return;
      // Kopiujemy nagłówki, ale pomijamy signature/checksum przy wysyłaniu własnych żądań.
      // Serwer nie weryfikuje tych nagłówków kryptograficznie — to kliencka metryka.
      const filteredHeaders={};
      for(const [k,v] of Object.entries(headers)){
        if(!/^(signature|checksum)$/i.test(k))filteredHeaders[k]=v;
      }
      transport={url:new URL(url,location.href).href,headers:filteredHeaders,blocked:false};
      window.postMessage({channel:'foe-payment-state',ready:true,reason:'',headerNames:Object.keys(filteredHeaders)},location.origin);
    }catch{}
  }
  function relevant(url) {
    try { const u = new URL(url, location.href); return u.origin === location.origin && /\/game\/json(?:\?|$)/.test(u.pathname + u.search); } catch { return false; }
  }
  function emit(url, body, data) {
    try {
      if (typeof data === 'string') { if (data.length > LIMIT) return; data = JSON.parse(data); }
      if (!data || typeof data !== 'object') return;
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
      window.postMessage({channel:'foe-companion-v1', data, methods, at:Date.now()}, location.origin);
    } catch { /* Observation must not interrupt the game. */ }
  }
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = args[0] instanceof Request ? args[0].url : String(args[0]);
    let requestBody=Promise.resolve(args[1]?.body);
    if(relevant(url) && args[0] instanceof Request && args[1]?.body===undefined){
      try{requestBody=args[0].clone().text().catch(()=>undefined);}catch{}
    }
    requestBody.then(body=>{try{observeTransport(url,body,Object.fromEntries(new Headers(args[1]?.headers||(args[0] instanceof Request?args[0].headers:{}))));}catch{}});
    const result = Reflect.apply(originalFetch, this, args);
    if (relevant(url)) result.then(response => {
      const copy = response.clone();
      if (Number(copy.headers.get('content-length')) > LIMIT) return;
      Promise.all([copy.text(),requestBody]).then(([data,body]) => emit(url, body, data)).catch(() => {});
    }).catch(() => {});
    return result;
  };
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  const urls = new WeakMap();
  const requestHeaders=new WeakMap(),setHeader=XMLHttpRequest.prototype.setRequestHeader;
  if(setHeader)XMLHttpRequest.prototype.setRequestHeader=function(name,value){const headers=requestHeaders.get(this)||{};headers[name]=value;requestHeaders.set(this,headers);return Reflect.apply(setHeader,this,[name,value]);};
  XMLHttpRequest.prototype.open = function (...args) { urls.set(this, String(args[1]));requestHeaders.set(this,{}); return Reflect.apply(open, this, args); };
  XMLHttpRequest.prototype.send = function (...args) {
    const url = urls.get(this);
    observeTransport(url,args[0],requestHeaders.get(this));
    if (relevant(url)) this.addEventListener('load', () => {
      try { emit(url, args[0], this.responseType === 'json' ? this.response : this.responseType === '' || this.responseType === 'text' ? this.responseText : null); } catch {}
    }, {once:true});
    return Reflect.apply(send, this, args);
  };
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-contribute')return;
    const {token,request}=event.data;
    const answer=(ok,message)=>window.postMessage({channel:'foe-contribution-result',token,ok,message},location.origin);
    if(paymentBusy)return answer(false,'Trwa już wpłata. Nie wysłano kolejnej.');
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
})();
