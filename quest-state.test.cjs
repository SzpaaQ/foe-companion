const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('completed quest cannot reopen, next quest remains available',()=>{
 const source=fs.readFileSync(__dirname+'/capture.js','utf8');
 const start=source.indexOf('  let openNegotiation=null;'),end=source.indexOf("  window.addEventListener('message',async event=>{",start);
 const messages=[],ctx={window:{postMessage:m=>messages.push(m)},location:{origin:'test'}};
 vm.runInNewContext(source.slice(start,end),ctx);
 const game={__class__:'NegotiationGame',context:'quest',possibleCosts:{resources:{a:1}}};
 const open=id=>ctx.observeOpenNegotiation([{requestClass:'QuestService',requestMethod:'startNegotiation',requestId:1,responseData:game}],JSON.stringify([{requestClass:'QuestService',requestMethod:'startNegotiation',requestId:1,requestData:[id,1,'quest']}]));
 open(6030001);assert.equal(messages.at(-1).game.context,'quest');
 ctx.observeOpenNegotiation([{requestClass:'QuestService',requestMethod:'getUpdates',responseData:[{id:6030001,state:'collectReward',successConditions:[{id:1,currentProgress:1,maxProgress:1}]}]}]);
 assert.equal(messages.at(-1).game,null);assert.match(messages.at(-1).reason,/odbierz/);
 open(6030001);assert.equal(messages.at(-1).game,null);
 open(6030002);assert.equal(messages.at(-1).game.context,'quest');
});
