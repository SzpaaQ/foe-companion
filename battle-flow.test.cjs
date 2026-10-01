const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

function harness({progress=196,max=200,winner=1,waves=false,refreshFails=false,attackType,lockedUntil=0}={}){
  const listeners=[],messages=[],calls=[];let battleCount=0;
  class XHR{open(){}setRequestHeader(){}send(){}addEventListener(){}}
  const window={addEventListener:(type,fn)=>listeners.push(fn),postMessage:m=>messages.push(m)};
  const map=()=>({currentParticipantId:1,map:{provinces:[{id:7,ownerId:2,isAttackBattleType:attackType,lockedUntil,conquestProgress:max==='empty'?[]:[{participantId:1,progress,maxProgress:max}]}]}});
  window.fetch=async(url,options)=>{
    const [r]=JSON.parse(options.body);calls.push(r.requestMethod);
    let data={};
    if(r.requestMethod==='getBattleground'){
      if(refreshFails&&battleCount)throw Error('offline');data=map();
    }
    if(r.requestMethod==='startByBattleType'){
      battleCount++;const more=waves&&battleCount===1;
      if(!more&&winner===1)progress++;
      data={__class__:'BattleRealm',battleId:battleCount,battleType:{provinceId:7},state:{winnerBit:winner,ranking_data:more?{nextArmy:{units:[{}]}}:{}}};
    }
    return {ok:true,json:async()=>[{...r,requestMethod:r.requestMethod==='updatePools'?'getArmyInfo':r.requestMethod,responseData:data}]};
  };
  const ctx={window,location:{origin:'https://example.test',href:'https://example.test/game'},XMLHttpRequest:XHR,URL,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout,FoeRequestSignature:{sign:()=> 'valid'},FoeBattleArmy:{plan:()=>[],confirmed:()=>true}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/capture.js','utf8'),ctx);
  const xhr=new XHR();xhr.open('POST','https://example.test/game/json?h=test');xhr.setRequestHeader('Signature','valid');xhr.send('[]');
  return {calls,messages,async negotiate(){await Promise.all(listeners.map(fn=>fn({source:window,origin:ctx.location.origin,data:{channel:'foe-negotiate',token:'n',provinceId:7}})));},async fight(reserve){await Promise.all(listeners.map(fn=>fn({source:window,origin:ctx.location.origin,data:{channel:'foe-quick-battle',token:'t',provinceId:7,reserve}})));return messages.filter(m=>m.channel==='foe-quick-battle-result').at(-1);}};
}
test('fresh reserve check: 196/200 fights once; 197/200 stops without army mutation',async()=>{
  const h=harness();const first=await h.fight(3);assert.equal(first.won,true);assert.equal(first.refreshed,true);
  assert.deepEqual(h.calls,['getBattleground','getArmyInfo','updatePools','startByBattleType','getBattleground']);
  const second=await h.fight(3);assert.equal(second.ok,false);assert.equal(second.uncertain,false);assert.equal(h.calls.filter(x=>x==='startByBattleType').length,1);
});
test('two waves replace army only once, refresh after final result',async()=>{
  const h=harness({waves:true});assert.equal((await h.fight(3)).nextWave,true);assert.equal((await h.fight(3)).nextWave,false);
  assert.equal(h.calls.filter(x=>x==='updatePools').length,1);assert.equal(h.calls.filter(x=>x==='startByBattleType').length,2);
});
test('defeat is a confirmed result, failed refresh blocks continuation signal',async()=>{
  const h=harness({winner:2,refreshFails:true});const r=await h.fight();assert.equal(r.ok,true);assert.equal(r.won,false);assert.equal(r.refreshed,false);
});
test('unknown progress does not start auto battle',async()=>{
  const h=harness({max:null});assert.equal((await h.fight(3)).ok,false);assert.deepEqual(h.calls,['getBattleground','getProvince']);
});
test('new sector with empty conquestProgress allows fight without reserve guard',async()=>{
  // Server returns conquestProgress:[] for a province never attacked by our guild.
  // The extension must not block the fight even when reserve is set.
  const h=harness({max:'empty'});const result=await h.fight(3);
  assert.equal(result.ok,true,'fight must proceed on a brand-new sector');
  assert.equal(result.won,true);
  // Army exchange + fight + refresh — no getProvince needed since conquestProgress is clearly []
  assert.ok(h.calls.includes('startByBattleType'),'startByBattleType must have been called');
});

function controller(){
  const elements=new Map(),listeners=[],timers=new Map(),sent=[];let seq=0;
  const element=()=>({value:'',textContent:'',hidden:false,style:{},onclick:null,disabled:false,title:'',setAttribute(){},getAttribute(){return null;},append(){},before(){},after(){}});
  const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const window={addEventListener:(type,fn)=>listeners.push(fn),postMessage:m=>sent.push(m)};
  const context=vm.createContext({$,window,location:{origin:'test'},document:{createElement:element},localStorage:{getItem:()=>null,setItem(){}},battle:{},FoeModel:{rows:()=>({rows:[{id:7,until:0,sector:'A1M'}]})},crypto:{randomUUID:()=>String(++seq)},paintOpenSectors(){},setInterval(){},setTimeout:(fn,delay)=>{const id=++seq;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
  const source=fs.readFileSync(__dirname+'/panel.js','utf8');
  vm.runInContext(source.slice(source.indexOf("    const autoKey="),source.indexOf('    function paintOpenSectors()'))+`;globalThis.control={start(){battleReady=true;autoSector=7;lossStreak=0;startFight(7)},stop(){stopAuto()},state(){return {autoSector,fights,wins,lossStreak}}};`,context);
  return {context,timers,sent,result(won,extra={}){const token=sent.filter(m=>m.channel==='foe-quick-battle').at(-1).token;listeners.forEach(fn=>fn({source:window,origin:'test',data:{channel:'foe-quick-battle-result',token,ok:true,provinceId:7,nextWave:false,refreshed:true,won,...extra}}));},tick(){const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();}};
}
test('controller stops after three consecutive losses and counts manual fights',()=>{
  const h=controller();h.context.control.start();
  h.result(false);assert.equal(h.timers.size,1);assert.ok([...h.timers.values()][0].delay>=300&&[...h.timers.values()][0].delay<=400);
  h.tick();h.result(false);h.tick();h.result(false);
  assert.equal(h.context.control.state().autoSector,null);assert.equal(h.context.control.state().fights,3);assert.equal(h.timers.size,0);
  vm.runInContext('startFight(7)',h.context);h.result(true);
  assert.equal(h.context.control.state().wins,1);assert.equal(h.context.control.state().fights,4);
});
test('waves do not count; stop cancels next scheduled request',()=>{
  const h=controller();h.context.control.start();h.result(true,{nextWave:true});
  assert.equal(h.context.control.state().fights,0);h.context.control.stop();assert.equal(h.timers.size,0);
});
test('missing live progress stops auto even after a win',()=>{
  const h=controller();h.context.control.start();h.result(true,{refreshed:false});
  assert.equal(h.context.control.state().autoSector,null);assert.equal(h.timers.size,0);assert.equal(h.context.control.state().wins,1);
});

test('negotiation starts for attack, defense and omitted battle type; locked sectors remain blocked',async()=>{
 for(const attackType of [true,false,undefined]){
  const h=harness({attackType});await h.negotiate();
  assert.deepEqual(h.calls,['getBattleground','startNegotiation']);
 }
 const h=harness({attackType:true,lockedUntil:Date.now()/1000+3600});await h.negotiate();
 assert.deepEqual(h.calls,['getBattleground']);
});
