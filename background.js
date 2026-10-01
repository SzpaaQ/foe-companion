chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id || !sender.tab || !/^https:\/\/[^/]+\.forgeofempires\.com\//.test(sender.url||''))return;
  if(message?.type==='DEV_VERSION'){
    fetch('http://127.0.0.1:18743/version',{cache:'no-store',signal:AbortSignal.timeout(1500)})
      .then(r=>r.ok?r.json():null).then(reply).catch(()=>reply(null));
    return true;
  }
  if(message?.type==='DEV_RELOAD'){reply({ok:true});setTimeout(()=>chrome.runtime.reload(),150);}
});
