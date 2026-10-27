(() => {
  'use strict';
  const mode={advanced:false};
  mode.ready=chrome.runtime.sendMessage({type:'FOE_FEATURE_MODE'})
    .then(result=>{mode.advanced=result?.advanced===true;return mode.advanced;})
    .catch(()=>false);
  globalThis.FoeMode=mode;
})();
