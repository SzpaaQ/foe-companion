(() => {
  'use strict';
  const mode={advanced:false,debug:false};
  mode.ready=chrome.runtime.sendMessage({type:'FOE_FEATURE_MODE'})
    .then(result=>{mode.advanced=result?.advanced===true;mode.debug=result?.debug===true;return mode.advanced;})
    .catch(()=>false);
  globalThis.FoeMode=mode;
})();
