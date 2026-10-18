const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const elements=new Map(),listeners=[],timers=new Map(),sent=[];let seq=0;
 const element=()=>({value:'',textContent:'',style:{},setAttribute(){},append(){},before(){},after(){},querySelectorAll(){return [];}});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const window={addEventListener:(t,f)=>listeners.push(f),postMessage:m=>sent.push(m)};
 const ctx=vm.createContext({$,window,playerAttrition:null,paintAttrition(){},location:{origin:'test'},document:{createElement:element},localStorage:{getItem:()=>null,setItem(){}},battle:{},FoeModel:{rows:()=>({rows:[{id:7,until:0,sector:'A1M'}]})},crypto:{randomUUID:()=>String(++seq)},paintOpenSectors(){},setInterval(){},setTimeout:(fn)=>{const id=++seq;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 const source=fs.readFileSync(__dirname+'/panel.js','utf8');
 vm.runInContext(source.slice(source.indexOf('    const autoKey='),source.indexOf('    function paintOpenSectors()'))+`;globalThis.control={manual(){battleReady=true;startFight(7,false)},start(){battleReady=true;autoSector=7;startFight(7,true)},stop:requestStopAuto,state(){return {autoSector,battleWaveSector,autoStopRequested,fights}}};`,ctx);
 return {sent,timers,control:ctx.control,tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},result(extra={}){const token=sent.filter(m=>m.channel==='foe-quick-battle').at(-1).token;for(const fn of listeners)fn({source:window,origin:'test',data:{channel:'foe-quick-battle-result',token,ok:true,provinceId:7,nextWave:false,won:true,refreshed:true,...extra}});},requests(){return sent.filter(m=>m.channel==='foe-quick-battle').length;}};
}
test('Stop during a single-wave battle waits for its result and starts no new battle',()=>{
 const h=setup();h.control.start();h.control.stop();assert.equal(h.control.state().autoStopRequested,true);
 assert.equal(h.requests(),1);h.result();assert.equal(h.control.state().autoSector,null);assert.equal(h.timers.size,0);
});
test('Stop during the first wave finishes subsequent waves, then stops',()=>{
 const h=setup();h.control.start();h.control.stop();h.result({nextWave:true});assert.equal(h.timers.size,1);
 h.tick();assert.equal(h.requests(),2);h.result({nextWave:true});h.tick();assert.equal(h.requests(),3);
 h.result();assert.equal(h.control.state().autoSector,null);assert.equal(h.control.state().fights,1);assert.equal(h.timers.size,0);
});
test('Stop between waves preserves the scheduled continuation',()=>{
 const h=setup();h.control.start();h.result({nextWave:true});h.control.stop();assert.equal(h.timers.size,1);
 h.tick();h.result();assert.equal(h.requests(),2);assert.equal(h.timers.size,0);
});
test('Stop between finished battles cancels the next battle',()=>{
 const h=setup();h.control.start();h.result();h.control.stop();assert.equal(h.timers.size,0);assert.equal(h.requests(),1);
});
test('uncertain wave result stops without blindly retrying',()=>{
 const h=setup();h.control.start();h.control.stop();h.result({ok:false,uncertain:true});
 assert.equal(h.timers.size,0);assert.equal(h.requests(),1);assert.equal(h.control.state().autoSector,null);
});
test('single manual click immediately completes both waves and never starts another battle',()=>{
 const h=setup();h.control.manual();assert.equal(h.requests(),1);
 h.result({nextWave:true});assert.equal(h.requests(),2);assert.equal(h.timers.size,0);assert.equal(h.control.state().fights,0);
 assert.ok(h.sent.filter(m=>m.channel==='foe-quick-battle').every(m=>m.automatic===false&&m.reserve===undefined));
 h.result();assert.equal(h.requests(),2);assert.equal(h.control.state().fights,1);assert.equal(h.control.state().battleWaveSector,null);assert.equal(h.timers.size,0);
});
test('manual single-wave and uncertain results do not trigger another request',()=>{
 for(const result of [{},{ok:false,uncertain:true,nextWave:true},{ok:true,invalidWave:true,nextWave:true}]){
  const h=setup();h.control.manual();h.result(result);assert.equal(h.requests(),1);assert.equal(h.timers.size,0);
 }
});
