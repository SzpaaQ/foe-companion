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
 vm.runInNewContext(fs.readFileSync(__dirname+'/capture.js','utf8'),{document:{querySelectorAll:()=>[],documentElement:{}},MutationObserver:class{observe(){}},window,location:{origin:'https://t.test',href:'https://t.test/'},XMLHttpRequest:XHR,URL,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout,FoeRequestSignature:{sign:()=> 'sig'}});
 const xhr=new XHR();xhr.open('POST','https://t.test/game/json?h=test');xhr.setRequestHeader('Signature','sig');xhr.send('[]');
 await Promise.all(listeners.map(f=>f({source:window,origin:'https://t.test',data:{channel:'foe-open-negotiate',token:'n'}})));
 return {calls,messages};
}
for(const [context,state,history] of [['quest','won',[]],['guildBattleground','won',[]],['quest','out_of_turns',[]],['quest','ongoing',[{slots:[{slotId:0,resourceId:'a',state:'correct'}]}]]]){
 test(`disabled standalone negotiation sends no requests (${context}, ${state})`,async()=>{
  const {calls}=await run(context,state,history);assert.deepEqual(calls,[]);
 });
}
