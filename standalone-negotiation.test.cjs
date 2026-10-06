const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
async function run(context,state='won',history=[]){
 const listeners=[],calls=[],messages=[];
 class XHR{open(){}setRequestHeader(){}send(){}addEventListener(){}}
 const game={__class__:'NegotiationGame',context,possibleCosts:{resources:{a:1,b:1}}};
 let submitted=false;
 const window={addEventListener:(t,f)=>listeners.push(f),postMessage:m=>messages.push(m),fetch:async(url,o)=>{
  const [r]=JSON.parse(o.body);calls.push(r);
  const data=r.requestMethod==='getRunning'?{game,state:submitted?state:'ongoing',history}:r.requestMethod==='giveUp'?{__class__:'Success'}:{__class__:'NegotiationGameResult',state,turnResult:{slots:[]}};
  if(r.requestMethod==='submitTurn')submitted=true;
  return {ok:true,json:async()=>[{...r,responseData:data}]};
 }};
 vm.runInNewContext(fs.readFileSync(__dirname+'/capture.js','utf8'),{window,location:{origin:'https://t.test',href:'https://t.test/'},XMLHttpRequest:XHR,URL,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout,FoeRequestSignature:{sign:()=> 'sig'}});
 const xhr=new XHR();xhr.open('POST','https://t.test/game/json?h=test');xhr.setRequestHeader('Signature','sig');xhr.send('[]');
 await Promise.all(listeners.map(f=>f({source:window,origin:'https://t.test',data:{channel:'foe-open-negotiate',token:'n'}})));
 return {calls,messages};
}
test('quest negotiation uses existing game and never starts a GBG negotiation',async()=>{
 const {calls,messages}=await run('quest');
 assert.deepEqual(calls.map(r=>r.requestMethod),['getRunning','submitTurn']);
 assert.equal(messages.find(m=>m.channel==='foe-open-nego-result').won,true);
});
test('standalone solver refuses GBG',async()=>{
 const {calls}=await run('guildBattleground');
 assert.deepEqual(calls.map(r=>r.requestMethod),['getRunning']);
});
test('standalone out of turns checks context and surrenders',async()=>{
 const {calls,messages}=await run('quest','out_of_turns');
 assert.deepEqual(calls.map(r=>r.requestMethod),['getRunning','submitTurn','getRunning','giveUp']);
 assert.equal(messages.find(m=>m.channel==='foe-open-nego-result').won,false);
});
test('resume restores correct slots and continues turn numbering',async()=>{
 const history=[{slots:Array.from({length:5},(_,slotId)=>({slotId,resourceId:'a',state:slotId===0?'correct':'not_needed'}))}];
 const {calls}=await run('quest','won',history);
 const turn=calls.find(r=>r.requestMethod==='submitTurn');
 assert.equal(turn.requestData[1],2);
 assert.equal(turn.requestData[0].some(s=>s.slotId===0),false);
});

