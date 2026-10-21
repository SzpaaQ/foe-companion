const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function simulate(paid,desired,amount,fail=false){
 const calls=[],messages=[],listeners=[];
 class XHR{open(){}setRequestHeader(){}send(){}addEventListener(){}}
 const window={addEventListener:(t,f)=>listeners.push(f),postMessage:m=>messages.push(m),fetch:async(u,o)=>{const [r]=JSON.parse(o.body);calls.push(r);if(fail&&r.requestMethod==='contributeForgePoints')throw Error('timeout');return {ok:true,json:async()=>[{...r,responseData:r.requestMethod==='getConstruction'?{rankings:[{player:{player_id:1},forge_points:paid}]}:[]}]};}};
 const src=fs.readFileSync(__dirname+'/capture.js','utf8').replace('cityOwner=null','cityOwner=1');
 vm.runInNewContext(src,{document:{querySelectorAll:()=>[],documentElement:{}},MutationObserver:class{observe(){}},window,location:{origin:'https://t.test',href:'https://t.test/'},XMLHttpRequest:XHR,URL,ArrayBuffer,TextDecoder,Blob,AbortSignal,setTimeout,clearTimeout,FoeRequestSignature:{sign:()=> 'sig'}});
 const xhr=new XHR();xhr.open('POST','https://t.test/game/json?h=test');xhr.setRequestHeader('Signature','sig');xhr.send('[]');
 const event={source:window,origin:'https://t.test',data:{channel:'foe-contribute',token:'p',desiredTotal:desired,request:{requestClass:'GreatBuildingsService',requestMethod:'contributeForgePoints',requestData:[7,2,19,amount,false]}}};
 await Promise.all(listeners.map(f=>f(event)));
 if(fail)await Promise.all(listeners.map(f=>f(event)));
 return {calls,messages};
}
for(const [paid,desired,amount,fail] of [[447,447,447,false],[200,447,447,false],[0,447,247,false],[0,447,447,true]]){
 test(`disabled panel contributions send no requests (paid=${paid}, amount=${amount}, retry=${fail})`,async()=>{
  const {calls}=await simulate(paid,desired,amount,fail);assert.deepEqual(calls,[]);
 });
}
