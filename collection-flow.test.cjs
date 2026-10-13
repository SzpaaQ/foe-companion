const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/capture.js','utf8');
async function run(results){
 const messages=[],calls=[],pending=[];let listener;
 const window={addEventListener:(name,fn)=>listener=fn,postMessage:m=>messages.push(m)};
 const ctx={window,location:{origin:'https://test'},cityOwner:1,ownBuildings:new Map([1,2].map(id=>[id,{id,state:{__class__:'ProductionFinishedState'}}])),collectedStates:new Map(),collectBusy:false,battleBusy:false,paymentBusy:false,battleTransport:{},battleCall:(...args)=>{const id=args[3][0][0];calls.push(id);return new Promise((resolve,reject)=>pending.push(()=>results[id] instanceof Error?reject(results[id]):resolve(results[id])));}};
 const end=source.indexOf('  async function battleCall('),start=source.lastIndexOf("  window.addEventListener('message',async event=>{",end);
 vm.runInNewContext(source.slice(start,end),ctx);
 const task=listener({source:window,origin:'https://test',data:{channel:'foe-collect',token:'test',entityIds:[1,2,1]}});
 assert.deepEqual(calls,[1,2],'both unique requests start before responses');
 pending.forEach(f=>f());await task;return messages[0];
}
test('batch reports confirmed collection and unchanged/full-storage rejection separately',async()=>{
 const result=await run({1:{updatedEntities:[{id:1,state:{__class__:'IdleState'}}]},2:{updatedEntities:[{id:2,state:{__class__:'ProductionFinishedState'}}]}});
 assert.equal(result.ok,false);assert.match(result.message,/1\/2/);assert.equal(result.results[0].ok,true);assert.equal(result.results[1].ok,false);assert.equal(result.results[1].retryable,true);
});
test('empty updates and network errors never confirm success',async()=>{
 const result=await run({1:{updatedEntities:[]},2:new Error('timeout')});
 assert.match(result.message,/0\/2/);assert.equal(result.results[0].retryable,true);assert.equal(result.results[1].retryable,false);
});
test('favorites persist for a specific player and building instance',()=>{
 const panel=fs.readFileSync(__dirname+'/panel.js','utf8');
 const start=panel.indexOf('    const favoritesKey='),end=panel.indexOf('    const cityTabs=',start);
 const stored=new Map();const ctx=vm.createContext({ownPlayerId:1,localStorage:{getItem:key=>stored.get(key)||null}});
 vm.runInContext(panel.slice(start,end),ctx);
 assert.equal(vm.runInContext('cityCategory',ctx),'favorites');
 stored.set('foe-companion.favorites.1',JSON.stringify(['7:building']));
 ctx.b={id:7,ceid:'building'};assert.equal(vm.runInContext("inCityCategory(b,'favorites')",ctx),true);
 ctx.b.id=8;assert.equal(vm.runInContext("inCityCategory(b,'favorites')",ctx),false);
 ctx.b.id=7;ctx.ownPlayerId=2;assert.equal(vm.runInContext("inCityCategory(b,'favorites')",ctx),false);
});
