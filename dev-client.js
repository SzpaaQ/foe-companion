(() => {
 let version=null, stopped=false;
 async function poll(){
  if(stopped)return;
  try{
   const result=await chrome.runtime.sendMessage({type:'DEV_VERSION'});
   if(result?.project==='foe-companion' && typeof result.version==='string'){
    if(version && version!==result.version){
     const answer=await chrome.runtime.sendMessage({type:'DEV_RELOAD'});
     if(answer?.ok){stopped=true;return;}
     setTimeout(poll,2000);return;
    }
    version=result.version;
   }
  }catch{if(!chrome.runtime?.id){stopped=true;return;}}
  setTimeout(poll,2000);
 }
 poll();
})();
