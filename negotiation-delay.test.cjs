const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('negotiation delay uses configured range and validates defaults',async()=>{
 const source=fs.readFileSync(__dirname+'/capture.js','utf8');
 const start=source.indexOf('  function negotiationTurnPause('),end=source.indexOf('  let openNegotiation',start);
 const delays=[];
 const ctx={Math:{random:()=>0.5},setTimeout:(fn,ms)=>{delays.push(ms);fn();}};
 vm.runInNewContext(source.slice(start,end),ctx);
 await ctx.negotiationTurnPause({min:1,max:2});
 await ctx.negotiationTurnPause({min:2,max:4});
 await ctx.negotiationTurnPause({min:0,max:0});
 await ctx.negotiationTurnPause({min:4,max:2});
 assert.deepEqual(delays,[1500,3000,0,1500]);
 assert.match(source,/if\(turn>1\)await negotiationTurnPause\(event.data.turnDelay\)/);
 assert.match(source,/if\(turnNumber>1\)await negotiationTurnPause\(event.data.turnDelay\)/);
});
