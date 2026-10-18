const {test}=require('node:test'),assert=require('node:assert/strict');
const Q=require('./quantum.js'),H=require('./quantum-history.js');
const defs=require('./quantum-definitions.json');
const house=defs.find(d=>d.name==='Dom wielopiętrowy').id;
const entity=(id=1,due=1000)=>({__class__:'CityMapEntity',id,player_id:7,cityentity_id:house,connected:1,x:0,y:0,state:{__class__:'ProducingState',next_state_transition_at:due}});
const map=entities=>({gridId:'guild_raids',entities,unlocked_areas:[]});
const snapshot=t=>JSON.parse(JSON.stringify({map:t.map,summary:t.summary(1000)}));
function setup(storage){
 const saved=new Map();storage||={load:async k=>saved.get(k),save:async(k,d)=>saved.set(k,structuredClone(d))};
 let time=1000000;const history=H.create({storage,world:'pl1',now:()=>time}),tracker=Q.createTracker();tracker.consume(defs);
 async function receive(data){const before=tracker.map?snapshot(tracker):null;tracker.consume(data);await history.observe(data,before,snapshot(tracker));}
 return {history,tracker,receive,storage,setTime:t=>time=t};
}
const pickup=(...entities)=>[{requestClass:'CityProductionService',requestMethod:'pickupProduction',responseData:{__class__:'CityProductionResult',updatedEntities:entities}}];
test('history groups a collection and its rearrangement, retaining all actions and boundary snapshots',()=>{
 const events=[{id:'a',run:'r',kind:'collection',cycle:1,at:1000,before:{a:1},after:{a:2},changes:[]},
 {id:'b',run:'r',kind:'change',at:2000,after:{a:3},changes:[{kind:'added'}]},
 {id:'c',run:'r',kind:'collection',cycle:1,at:3000,after:{a:4},changes:[]},
 {id:'d',run:'r',kind:'change',at:4000,after:{a:5},changes:[{kind:'removed'}]},
 {id:'e',run:'r',kind:'collection',cycle:2,at:36001000,after:{a:6},changes:[]}];
 const grouped=H.groupEvents(events);assert.equal(grouped.length,2);assert.equal(grouped[0].actions.length,4);
 assert.deepEqual(grouped[0].before,{a:1});assert.deepEqual(grouped[0].after,{a:5});assert.equal(grouped[0].changes.length,2);
 assert.equal(events[0].changes.length,0);assert.deepEqual(events[0].after,{a:2});
});
test('existing individual changes form one rearrangement; inactivity and reload boundaries separate sessions',()=>{
 const list=[{kind:'change',run:'r',at:1000},{kind:'change',run:'r',at:2000},{kind:'change',run:'r',at:3000}];
 assert.equal(H.groupEvents(list).length,1);
 assert.equal(H.groupEvents([...list,{kind:'change',run:'r',at:2000000}]).length,2);
 assert.equal(H.groupEvents([...list,{kind:'baseline',run:'r',at:4000},{kind:'change',run:'r',at:5000}]).length,3);
});
test('baseline persists; moves and repeated snapshots do not add history; additions/removals do',async()=>{
 const h=setup();await h.receive(map([entity()]));assert.equal(h.history.document.events.length,1);
 await h.receive(map([{...entity(),x:10,y:20}]));assert.equal(h.history.document.events.length,1);
 await h.receive({requestClass:'CityMapService',requestMethod:'addEntity',responseData:[entity(2)]});
 assert.deepEqual(h.history.document.events.at(-1).changes.map(c=>c.kind),['added']);
 await h.receive(map([entity(2)]));assert.deepEqual(h.history.document.events.at(-1).changes.map(c=>c.kind),['removed']);
 assert.equal(h.history.document.events.at(-1).before.map.entities[0].x,10);
});
test('construction completion and expansion are recorded without treating production clock changes as building changes',async()=>{
 const h=setup();await h.receive(map([{...entity(),state:{__class__:'ConstructionState',next_state_transition_at:1000}}]));
 await h.receive(map([entity()]));assert.equal(h.history.document.events.at(-1).changes[0].kind,'completed');
 await h.receive({...map([entity()]),unlocked_areas:[{x:4,y:0,width:4,length:4}]});assert.equal(h.history.document.events.at(-1).changes[0].kind,'expansion');
 const count=h.history.document.events.length;await h.receive({...map([entity(1,1010)]),unlocked_areas:[{x:4,y:0,width:4,length:4}]});assert.equal(h.history.document.events.length,count);
});
test('partial production pickup groups batches, ignores duplicates, next ten-hour cycle increments counter',async()=>{
 const h=setup();await h.receive(map([entity(1),entity(2,1020)]));
 await h.receive(pickup(entity(1,37000)));await h.receive(pickup(entity(2,37020)));
 let e=h.history.document.events;assert.deepEqual(e.filter(e=>e.kind==='collection').map(e=>e.cycle),[1,1]);
 assert.equal(e[1].before.map.entities.length,2);assert.equal(e[1].after.map.entities.length,2);assert.ok(e[1].estimate.guild_raids_money>0);
 await h.receive(pickup(entity(2,37020)));assert.equal(h.history.document.events.length,3);
 h.setTime(37000000);await h.receive(pickup(entity(1,73000)));assert.equal(h.history.document.events.at(-1).cycle,2);
 const exported=JSON.parse(h.history.export());assert.equal(exported.schemaVersion,1);assert.ok(exported.events[1].before.summary.totals);assert.ok(exported.events[1].after.map.entities);
});
test('a production state refresh without pickup response is not counted as a collection',async()=>{
 const h=setup();await h.receive(map([entity()]));await h.receive(map([entity(1,37000)]));assert.equal(h.history.document.events.length,1);
});
test('another player update cannot contaminate the quantum map',async()=>{
 const h=setup();await h.receive(map([entity()]));await h.receive({...entity(2),player_id:88});assert.equal(h.tracker.map.entities.length,1);
});
test('confirmed deletion is applied only while the quantum grid is active',async()=>{
 const h=setup();await h.receive(map([entity(1),entity(2)]));
 await h.receive([{requestClass:'CityMapService',requestMethod:'deleteEntity',responseData:1}]);
 assert.equal(h.tracker.map.entities.length,1);assert.equal(h.history.document.events.at(-1).changes[0].kind,'removed');
 await h.receive({gridId:'main',entities:[]});await h.receive([{requestClass:'CityMapService',requestMethod:'deleteEntity',responseData:2}]);assert.equal(h.tracker.map.entities.length,1);
});
test('countdown changes alone in a pickup response do not invent a collection',async()=>{
 const h=setup();await h.receive(map([entity()]));const e=entity();e.state.next_state_transition_in=10;
 await h.receive(pickup(e));assert.equal(h.history.document.events.length,1);
});
test('reload adds an observation boundary and keeps previous cycles; manual split and merge persist',async()=>{
 const h=setup();await h.receive(map([entity(1),entity(2)]));await h.receive(pickup(entity(1,37000)));await h.receive(pickup(entity(2,37000)));
 const last=h.history.document.events.at(-1);await h.history.relabel(last.id,true);assert.equal(h.history.document.events.at(-1).cycle,2);
 await h.history.relabel(last.id,false);assert.equal(h.history.document.events.at(-1).cycle,1);
 const next=setup(h.storage);await next.receive(map([entity(1,37000),entity(2,37000)]));assert.equal(next.history.document.events.at(-1).kind,'baseline');
 assert.equal(next.history.document.events.filter(e=>e.kind==='collection').length,2);
});
test('storage errors are visible and leave in-memory history available for export',async()=>{
 const h=setup({load:async()=>null,save:async()=>{throw Error('quota');}});await h.receive(map([entity()]));assert.match(h.history.error,/quota/);assert.equal(JSON.parse(h.history.export()).events.length,1);
});
test('snapshots are frozen before asynchronous persistence, and rapid responses retain their order',async()=>{
 const h=setup();const a=map([entity()]);const p=h.receive(a);a.entities[0].x=99;await p;
 assert.equal(h.history.document.events[0].after.map.entities[0].x,0);
 await Promise.all([h.receive(pickup(entity(1,37000))),h.receive(map([entity(1,37000),entity(2)]))]);
 assert.deepEqual(h.history.document.events.map(e=>e.kind),['baseline','collection','change']);
});
