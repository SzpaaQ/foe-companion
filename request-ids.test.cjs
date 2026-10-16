const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const signer=require('./request-signature.js');
function setup(){
 const sent=[];
 function reply(body,headers){
  assert.equal(headers.signature,signer.sign('test',body));
  const batch=JSON.parse(body);sent.push(...batch.map(r=>r.requestId));
  return batch.map(r=>({...r,responseData:{requestId:999,value:true}}));
 }
 class XHR{
  constructor(){this.responseType='';this.handlers=[];this.readyState=0;}
  open(){this.headers={};this.readyState=1;}
  setRequestHeader(k,v){k=k.toLowerCase();this.headers[k]=this.headers[k]?this.headers[k]+', '+v:v;}
  addEventListener(t,fn){if(t==='load')this.handlers.push(fn);}
  get responseText(){return this.raw;}
  get response(){return this.responseType==='json'?JSON.parse(this.raw):this.raw;}
  send(body){this.raw=JSON.stringify(reply(body,this.headers));this.readyState=4;for(const fn of this.handlers)fn();this.handlers=[];}
 }
 const window={addEventListener(){},postMessage(){},fetch:async(url,o)=>new Response(JSON.stringify(reply(o.body,Object.fromEntries(new Headers(o.headers)))))};
 vm.runInNewContext(fs.readFileSync(__dirname+'/capture.js','utf8'),{document:{querySelectorAll:()=>[]},MutationObserver:class{observe(){}},window,location:{origin:'https://test.local',href:'https://test.local/'},XMLHttpRequest:XHR,FoeRequestSignature:signer,URL,Request,Response,Headers,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout});
 const body=ids=>JSON.stringify(ids.map(requestId=>({__class__:'ServerRequest',requestId,requestClass:'TestService',requestMethod:'getData',requestData:[]})));
 const url='https://test.local/game/json?h=test';
 return {sent,XHR,url,body,async fetch(ids){const text=body(ids);return (await window.fetch(url,{method:'POST',body:text,headers:{Signature:signer.sign('test',text)}})).json();}};
}
test('fetch remaps a reused batch ID, restores response IDs, preserves payload fields',async()=>{
 const h=setup();await h.fetch([36]);const response=await h.fetch([21,22]);
 assert.deepEqual(h.sent,[36,37,38]);assert.deepEqual(response.map(r=>r.requestId),[21,22]);assert.equal(response[0].responseData.requestId,999);
});
test('XHR restores both getters before earlier game listeners; signs exactly once; reuse works',async()=>{
 const h=setup();await h.fetch([36]);const xhr=new h.XHR();
 for(const [index,type] of ['', 'json'].entries()){
  const id=21+index,text=h.body([id]);xhr.open('POST',h.url);xhr.responseType=type;xhr.setRequestHeader('Signature',signer.sign('test',text));
  xhr.addEventListener('load',()=>{
   assert.equal(JSON.parse(xhr.responseText)[0].requestId,id);
   assert.equal((type==='json'?xhr.response:JSON.parse(xhr.response))[0].requestId,id);
  });
  xhr.send(new TextEncoder().encode(text).buffer);
 }
 assert.deepEqual(h.sent,[36,37,38]);
});
test('unsigned game request with colliding ID is bumped above extension IDs without replacing Signature',async()=>{
 // After extension uses IDs 21-36 (remapped from 36), the game sends an unsigned request with ID 21.
 // The extension must bump the ID above 36 to prevent server-side duplicate-ID rejection.
 // The game's own callback must still see the original ID 21 (restoreGameResponse).
 const sent=[];
 class XHR{
  constructor(){this.responseType='';this.handlers=[];this.readyState=0;}
  open(){this.headers={};this.readyState=1;}
  setRequestHeader(k,v){k=k.toLowerCase();this.headers[k]=this.headers[k]?this.headers[k]+', '+v:v;}
  addEventListener(t,fn){if(t==='load')this.handlers.push(fn);}
  get responseText(){return this.raw;}
  get response(){return this.responseType==='json'?JSON.parse(this.raw):this.raw;}
  send(body){
   const batch=JSON.parse(body);sent.push(...batch.map(r=>r.requestId));
   // Echo back as a valid ServerResponse (no signature check — unsigned path)
   this.raw=JSON.stringify(batch.map(r=>({...r,responseData:true})));
   this.readyState=4;for(const fn of this.handlers)fn();this.handlers=[];
  }
 }
 const window={addEventListener(){},postMessage(){},fetch:async(url,o)=>{
  const b=JSON.parse(o.body);sent.push(...b.map(r=>r.requestId));
  return new Response(JSON.stringify(b.map(r=>({...r,responseData:true}))),{headers:{'content-type':'application/json'}});
 }};
 vm.runInNewContext(fs.readFileSync(__dirname+'/capture.js','utf8'),{document:{querySelectorAll:()=>[]},MutationObserver:class{observe(){}},window,location:{origin:'https://test.local',href:'https://test.local/'},XMLHttpRequest:XHR,FoeRequestSignature:signer,URL,Request,Response,Headers,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout});
 const url='https://test.local/game/json?h=test';
 const signedBody=JSON.stringify([{__class__:'ServerRequest',requestId:36,requestClass:'TestService',requestMethod:'getData',requestData:[]}]);
 // Step 1: signed fetch — extension sees ID 36, lastRequestId becomes 36
 await window.fetch(url,{method:'POST',body:signedBody,headers:{Signature:signer.sign('test',signedBody)}});
 assert.equal(sent[0],36,'signed request: ID 36 used as-is (no collision with initial lastRequestId=0)');
 sent.length=0;
 // Step 2: unsigned XHR with colliding ID 21 (< 36) — must be bumped to 37
 const unsignedBody=JSON.stringify([{__class__:'ServerRequest',requestId:21,requestClass:'GuildService',requestMethod:'getState',requestData:[]}]);
 const gameSeenId=await new Promise(resolve=>{
  const xhr=new XHR();
  xhr.open('POST',url);xhr.responseType='';
  // No Signature header — simulates game's own unsigned request
  xhr.addEventListener('load',()=>resolve(JSON.parse(xhr.responseText)[0].requestId));
  xhr.send(unsignedBody);
 });
 assert.ok(sent[0]>36,'unsigned colliding ID must be bumped above 36, got '+sent[0]);
 assert.equal(gameSeenId,21,'game callback must see original ID 21 restored');
});
