const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Live=require('./battleground-live.js');
async function run({closed=true,running=null,missing=false,disconnected=false}={}){
 const live=Live.createTracker();live.setConnected(true);const province={id:7,ownerId:2,conquestProgress:[{participantId:1,progress:4,maxProgress:132}]};
 live.consume({currentParticipantId:1,endsAt:1000,map:{id:'m',provinces:[province]}});
 const handlers=[],calls=[],messages=[];class XHR{open(){}setRequestHeader(){}send(){}addEventListener(){}}
 const window={addEventListener:(t,f)=>handlers.push(f),postMessage:m=>messages.push(m),fetch:async(url,opts)=>{
  const [req]=JSON.parse(opts.body);calls.push(req.requestMethod);let data;
  if(req.requestMethod==='startNegotiation')data={__class__:'NegotiationGame',context:'guildBattleground',possibleCosts:{resources:{a:1}}};
  if(req.requestMethod==='getPlayerResourceBag')data={resources:{negotiation_game_turn:3,a:100}};
  if(req.requestMethod==='submitTurn'){
   if(closed)live.consume({requestClass:'GuildBattlegroundService',requestMethod:'getProvince',responseData:{...province,ownerId:3,lockedUntil:Date.now()/1000+3600}},'socket');
   if(disconnected)live.setConnected(false);
   return {ok:true,status:200,json:async()=>[{__class__:'Error'}]};
  }
  if(req.requestMethod==='getRunning'){if(missing)return {ok:true,json:async()=>[]};data=running;}
  if(req.requestMethod==='giveUp')data={__class__:'Success'};
  return {ok:true,status:200,json:async()=>[{...req,responseData:data}]};
 }};
 const ctx={window,document:{querySelectorAll:()=>[]},MutationObserver:class{observe(){}},location:{origin:'https://t.test',href:'https://t.test/'},XMLHttpRequest:XHR,URL,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout,FoeRequestSignature:{sign:()=> 'sig'},FoeBattlegroundLive:{createTracker:()=>live,observeSockets(){}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/capture.js','utf8'),ctx);const xhr=new XHR();xhr.open('POST','https://t.test/game/json?h=test');xhr.setRequestHeader('Signature','sig');xhr.send('[]');
 await Promise.all(handlers.map(fn=>fn({source:window,origin:'https://t.test',data:{channel:'foe-negotiate',token:'n',provinceId:7,turnDelay:{min:0,max:0}}})));
 return {result:messages.filter(m=>m.channel==='foe-negotiate-result').at(-1),calls};
}
test('captured province and explicit null running negotiation allow skipping without a win or loss',async()=>{
 const {result,calls}=await run();assert.equal(result.sectorClosed,true);assert.equal(result.negotiationEnded,true);assert.equal(result.continueAuto,true);assert.equal(result.won,undefined);assert.equal(calls.filter(x=>x==='submitTurn').length,1);assert.ok(!calls.includes('giveUp'));
});
test('confirmed surrender on captured province allows continuing',async()=>{const h=await run({running:{__class__:'RunningNegotiationGame',state:'ongoing',game:{context:'guildBattleground'}}});assert.equal(h.result.sectorClosed,true);assert.ok(h.calls.includes('giveUp'));});
test('same generic Error without closure, missing response, foreign negotiation or disconnected socket stops',async()=>{
 for(const opts of [{closed:false},{missing:true},{running:{state:'ongoing',game:{context:'quest'}}},{disconnected:true}]){const {result}=await run(opts);assert.equal(result.stopAuto,true);assert.equal(result.sectorClosed,undefined);}
});
