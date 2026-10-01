(() => {
 let version=null, stopped=false;
 async function poll(){
  if(stopped)return;
  try{
   const result=await chrome.runtime.sendMessage({type:'DEV_VERSION'});
   if(result?.project==='foe-companion' && typeof result.version==='string'){
    if(version && version!==result.version){
     stopped=true;
     setTimeout(()=>location.reload(),1800);
     await chrome.runtime.sendMessage({type:'DEV_RELOAD'});return;
    }
    version=result.version;
   }
  }catch{if(!chrome.runtime?.id){stopped=true;return;}}
  setTimeout(poll,2000);
 }
 poll();
})();
