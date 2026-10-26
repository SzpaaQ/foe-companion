const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/panel.js','utf8');
function setup(patch={}){
 const sent=[],listeners=[],timers=new Map(),elements=new Map();let seq=0;
 const element=()=>({value:'',textContent:'',style:{},setAttribute(){},append(){},before(){},after(){},replaceChildren(){},querySelector(){return null;},querySelectorAll(){return [];}});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const window={addEventListener:(t,f)=>listeners.push(f),postMessage:m=>sent.push(m)};
 const row={id:7,until:0,sector:'A1M',gainAttritionChance:20,...patch};
 const ctx=vm.createContext({root:{querySelector:()=>null},$,window,playerAttrition:0,paintAttrition(){},location:{origin:'test'},document:{createElement:element},localStorage:{getItem:key=>key.startsWith('foe-companion.showActions.')?'1':null,setItem(){}},battle:{map:{id:'m'},endsAt:1000},bulkSettings:{closeWithNegotiations:true,maxAttrition:0},FoeModel:{rows:()=>({rows:[row]})},crypto:{randomUUID:()=>String(++seq)},paintOpenSectors(){},setInterval(){},setTimeout:(fn,delay)=>{const id=++seq;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source.slice(source.indexOf('    const autoKey='),source.indexOf('    function paintOpenSectors()'))+`;battleReady=true;bulkAutomation={engaged:false,guardsPaused:false,pauseGuards(){this.guardsPaused=true;}};globalThis.control={start:startGuardClosing,stop:stopAutoNeg,paused:()=>bulkAutomation.guardsPaused};`,ctx);
 sent.length=0;
 return {ctx,sent,row,timers,control:ctx.control,result(extra={}){const token=sent.at(-1).token;for(const fn of listeners)fn({source:window,origin:'test',data:{channel:'foe-negotiate-result',token,ok:true,won:true,refreshed:true,...extra}});},next(){const entry=[...timers].find(([id,t])=>t.delay<1000);assert.ok(entry);timers.delete(entry[0]);entry[1].fn();}};
}
test('negotiation closing repeats without a loss cap and STOP prevents further requests',()=>{
 const h=setup();assert.equal(h.control.start(7),true);assert.equal(h.sent[0].channel,'foe-negotiate');assert.equal(h.sent[0].bulkPolicy.progress,100);assert.equal(h.sent[0].bulkPolicy.maxAttrition,0);
 for(let i=0;i<4;i++){h.result({ok:false,won:false,continueAuto:true,surrendered:true});h.next();}
 assert.equal(h.sent.length,5);h.control.stop();h.result();assert.equal(h.control.paused(),true);assert.equal([...h.timers.values()].filter(t=>t.delay<1000).length,0);
});
test('closing rechecks chance, guild ignore and player attrition before every negotiation',()=>{
 for(const patch of [{gainAttritionChance:60},{ignored:true}]){const h=setup(patch);assert.equal(h.control.start(7),false);assert.equal(h.sent.length,0);}
 const h=setup();h.control.start(7);h.result();h.ctx.playerAttrition=1;h.next();assert.equal(h.sent.length,1);assert.equal(h.control.paused(),true);
});
test('closing defaults to battle when option is off, and busy/paused guards send nothing',()=>{
 const h=setup();h.ctx.bulkSettings.closeWithNegotiations=false;h.control.start(7);assert.equal(h.sent[0].channel,'foe-quick-battle');h.control.start(7);assert.equal(h.sent.length,1);
 const paused=setup();paused.control.start(7);paused.control.stop();paused.result();paused.control.start(7);assert.equal(paused.sent.length,1);
});
test('local ignore persists separately for world, season and map and fails closed for corrupt storage',()=>{
 const saved=new Map();const ctx=vm.createContext({location:{host:'world1'},battle:{endsAt:1000,map:{id:'m'}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},paintOpenSectors(){},setBattleFeedback(){}});
 vm.runInContext(source.slice(source.indexOf('    function localIgnoreKey()'),source.indexOf('    const bulkKey='))+`;globalThis.api={key:localIgnoreKey,get:localSectorIgnored,set:setLocalSectorIgnored};`,ctx);
 ctx.api.set(7,true);assert.equal(ctx.api.get(7),true);ctx.battle.endsAt=2000;assert.equal(ctx.api.get(7),false);ctx.battle.endsAt=1000;ctx.location.host='world2';assert.equal(ctx.api.get(7),false);ctx.location.host='world1';ctx.battle.map.id='other';assert.equal(ctx.api.get(7),false);ctx.battle.map.id='m';assert.equal(ctx.api.get(7),true);ctx.api.set(7,false);assert.equal(ctx.api.get(7),false);saved.set(ctx.api.key(),'{}');assert.equal(ctx.api.get(7),true);
});
