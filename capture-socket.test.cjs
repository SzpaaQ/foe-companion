const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Live=require('./battleground-live.js');
function setup(){
 const listeners=[],messages=[],calls=[];let progress=10;
 const province=()=>({__class__:'GuildBattlegroundProvince',id:7,ownerId:2,conquestProgress:[{participantId:1,progress,maxProgress:100}]});
 class Socket{constructor(){this.handlers={};}addEventListener(t,f){(this.handlers[t]??=[]).push(f);}fire(t,data){for(const f of this.handlers[t]||[])f({data});}send(){assert.fail('Observer must not send socket messages');}}
 class XHR{open(){}setRequestHeader(){}send(){}addEventListener(){}}
 const location={origin:'https://pl1.forgeofempires.com',href:'https://pl1.forgeofempires.com/game/index',host:'pl1.forgeofempires.com'};
 const window={location,WebSocket:Socket,addEventListener:(t,f)=>listeners.push(f),postMessage:m=>messages.push(m)};
 let socket;
 const push=()=>socket.fire('message',JSON.stringify([{requestClass:'GuildBattlegroundService',requestMethod:'getProvinces',responseData:[province()]}]));
 window.fetch=async(url,options)=>{
  const [r]=JSON.parse(options.body);calls.push(r.requestMethod);let data={};
  if(['getBattleground','getProvince','getProvinces','getUpdatedProvinces'].includes(r.requestMethod))assert.fail('Unwanted map polling');
  if(r.requestMethod==='startByBattleType'){progress++;push();data={__class__:'BattleRealm',battleId:5,battleType:{provinceId:7},state:{winnerBit:1,ranking_data:{}}};}
  if(r.requestMethod==='startNegotiation')data={__class__:'NegotiationGame',possibleCosts:{resources:{stone:1}}};
  if(r.requestMethod==='getPlayerResourceBag')data={resources:{negotiation_game_turn:3,stone:100}};
  if(r.requestMethod==='submitTurn'){progress+=2;push();data={__class__:'NegotiationGameResult',state:'won',turnResult:{slots:[]}};}
  return {ok:true,json:async()=>[{...r,requestMethod:r.requestMethod==='updatePools'?'getArmyInfo':r.requestMethod,responseData:data}]};
 };
 const ctx={window,location,document:{querySelectorAll:()=>[]},MutationObserver:class{observe(){}},XMLHttpRequest:XHR,URL,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout,FoeRequestSignature:{sign:()=> 'valid'},FoeBattleArmy:{plan:()=>[],confirmed:()=>true},FoeBattlegroundLive:Live};
 const source=fs.readFileSync(__dirname+'/capture.js','utf8').replace('  const originalFetch = window.fetch;','  globalThis.emitTest=emit;\n  const originalFetch = window.fetch;');
 vm.runInNewContext(source,ctx);socket=new window.WebSocket('wss://pl1.forgeofempires.com/socket/');socket.fire('open');
 ctx.emitTest(location.origin+'/game/json','[]',[{requestClass:'GuildBattlegroundService',requestMethod:'getBattleground',responseData:{currentParticipantId:1,map:{provinces:[province()]}}}]);
 const xhr=new XHR();xhr.open('POST',location.origin+'/game/json?h=test');xhr.setRequestHeader('Signature','valid');xhr.send('[]');
 return {calls,messages,socket,async action(channel){await Promise.all(listeners.map(f=>f({source:window,origin:location.origin,data:{channel,provinceId:7,token:'test',automatic:true,reserve:3}})));}};
}
test('auto battle observes progress over the existing socket without extra map requests',async()=>{
 const h=setup();assert.equal(h.calls.length,0);await h.action('foe-quick-battle');
 assert.deepEqual(h.calls,['getArmyInfo','updatePools','startByBattleType']);
 const result=h.messages.find(m=>m.channel==='foe-quick-battle-result');assert.equal(result.ok,true);assert.equal(result.refreshed,true);
 assert.ok(h.messages.some(m=>m.channel==='foe-companion-v1'&&m.data[0]?.requestMethod==='getProvinces'&&m.internal));
});
test('auto negotiation keeps the free-turn check and confirms socket progress without map polling',async()=>{
 const h=setup();await h.action('foe-negotiate');assert.deepEqual(h.calls,['startNegotiation','getPlayerResourceBag','submitTurn']);
 const result=h.messages.find(m=>m.channel==='foe-negotiate-result');assert.equal(result.ok,true);assert.equal(result.refreshed,true);
});
test('socket disconnected before an automatic action prevents any outgoing API request',async()=>{
 const h=setup();h.socket.fire('close');await h.action('foe-quick-battle');await h.action('foe-negotiate');assert.deepEqual(h.calls,[]);
});
