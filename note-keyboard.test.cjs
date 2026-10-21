const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('note keyboard guard stops game capture handlers without cancelling text input defaults',()=>{
 const source=fs.readFileSync(__dirname+'/capture.js','utf8');
 const listeners={},host={dataset:{}},document={activeElement:host};
 vm.runInNewContext(source.slice(source.indexOf('  for(const type'),source.indexOf('  const LIMIT')),{document,window:{addEventListener:(type,fn,capture)=>{assert.equal(capture,true);listeners[type]=fn;}}});
 const panel=fs.readFileSync(__dirname+'/panel.js','utf8'),focus={};
 vm.runInNewContext(panel.slice(panel.indexOf("    root.addEventListener('focusin'"),panel.indexOf('    root.innerHTML = `')),{host,root:{addEventListener:(type,fn)=>focus[type]=fn}});
 let blocked=0;const event={stopImmediatePropagation(){blocked++;},preventDefault(){assert.fail('Native text editing must remain enabled');}};
 for(const fn of Object.values(listeners))fn(event);assert.equal(blocked,0);
 focus.focusin({composedPath:()=>[{matches:selector=>selector.includes('data-history-note')}]});
 for(const fn of Object.values(listeners))fn(event);assert.equal(blocked,3);
 focus.focusout();listeners.keydown(event);assert.equal(blocked,3);
 focus.focusin({composedPath:()=>[{matches:()=>false}]});listeners.keydown(event);assert.equal(blocked,3);
});
