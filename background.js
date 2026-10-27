if(typeof importScripts==='function')importScripts('discord-background.js');
const pendingKey='foe-dev-reload';
// Reload the game from the new worker, not a destroyed content-script timer.
const recovery=chrome.storage.local.get(pendingKey).then(async stored=>{
  const pending=stored[pendingKey];if(!pending)return;
  await chrome.storage.local.remove(pendingKey);
  if(Date.now()-pending.at>60000)return;
  for(const id of pending.tabs||[]){
    try{const tab=await chrome.tabs.get(id);if(/^https:\/\/[^/]+\.forgeofempires\.com\//.test(tab.url||''))await chrome.tabs.reload(id);}catch{}
  }
}).catch(console.error);
let reloading=false;
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id || !sender.tab || !/^https:\/\/[^/]+\.forgeofempires\.com\//.test(sender.url||''))return;
  if(message?.type==='FOE_FEATURE_MODE'){
    (async()=>{
      let advanced=false;
      try{advanced=(await fetch(chrome.runtime.getURL('bot'),{cache:'no-store'})).ok;}catch{}
      reply({advanced});
    })().catch(()=>reply({advanced:false}));
    return true;
  }
  if(message?.type==='DEV_VERSION'){
    fetch('http://127.0.0.1:18743/version',{cache:'no-store',signal:AbortSignal.timeout(1500)})
      .then(r=>r.ok?r.json():null).then(reply).catch(()=>reply(null));
    return true;
  }
  if(message?.type==='captureTab'){
    chrome.tabs.captureVisibleTab(sender.tab.windowId,{format:'jpeg',quality:70})
      .then(dataUrl=>reply({ok:true,dataUrl}))
      .catch(err=>reply({ok:false,error:String(err)}));
    return true;
  }
  if(message?.type==='DEV_RELOAD'){
    if(reloading){reply({ok:true});return;}
    reloading=true;
    (async()=>{
      await recovery;
      await chrome.storage.local.set({[pendingKey]:{at:Date.now(),tabs:[sender.tab.id]}});
      reply({ok:true});chrome.runtime.reload();
    })().catch(error=>{reloading=false;console.error(error);reply({ok:false});});
    return true;
  }
});
