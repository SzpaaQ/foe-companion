const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('reload persists the game tab and new worker refreshes it once',async()=>{
 const data={},calls=[];let listener;
 const chrome={storage:{local:{get:async()=>({...data}),set:async v=>Object.assign(data,v),remove:async k=>delete data[k]}},runtime:{id:'test',reload:()=>calls.push('extension'),onMessage:{addListener:f=>listener=f}},tabs:{get:async()=>({url:'https://pl1.forgeofempires.com/game/index'}),reload:async id=>calls.push(id)}};
 const source=fs.readFileSync(__dirname+'/background.js','utf8');
 const run=()=>vm.runInNewContext(source,{chrome,console,Date});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 run();await flush();
 listener({type:'DEV_RELOAD'},{id:'test',tab:{id:42},url:'https://pl1.forgeofempires.com/game/index'},()=>{});
 await flush();assert.deepEqual(calls,['extension']);assert.deepEqual(Array.from(data['foe-dev-reload'].tabs),[42]);
 run();await flush();assert.deepEqual(calls,['extension',42]);assert.equal(data['foe-dev-reload'],undefined);
 run();await flush();assert.deepEqual(calls,['extension',42]);
});
