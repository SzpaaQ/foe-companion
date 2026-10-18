const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Q=require('./quantum.js');
test('history opens a modal, renders frozen tables and exports a local JSON blob',async()=>{
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.listeners={};this.textContent='';}
  append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn;}
  showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}focus(){this.focused=true;}click(){this.clicked=true;}remove(){this.removed=true;}
 }
 const host=new Element('div'),button=new Element('button'),tracker=Q.createTracker();tracker.consume(require('./quantum-definitions.json'));
 tracker.consume({gridId:'guild_raids',entities:[{id:1,cityentity_id:require('./quantum-definitions.json').find(d=>d.name==='Dom wielopiętrowy').id,state:{__class__:'ProducingState',next_state_transition_at:2000000000}},{id:2,cityentity_id:require('./quantum-definitions.json').find(d=>d.name==='Kościół').id,state:{__class__:'IdleState'}}]});const snap={map:tracker.map,summary:tracker.summary()};
 const doc={events:[{id:'a',run:'test',kind:'collection',cycle:1,at:1000,collected:[],changes:[],before:snap,after:snap}]};
 let blob,revoked=false;
 const history={document:doc,ready:async()=>{},export:()=>JSON.stringify(doc)};
 const ctx={FoeQuantum:Q,document:{createElement:tag=>new Element(tag)},Blob,Date,URL:{createObjectURL:b=>{blob=b;return 'blob:local';},revokeObjectURL:()=>revoked=true},setTimeout:fn=>fn()};
 vm.runInNewContext(fs.readFileSync(__dirname+'/quantum-history.js','utf8'),ctx);
 ctx.FoeQuantumHistory.mount({root:host,button,history});await button.onclick();const dialog=host.children[0];assert.equal(dialog.open,true);
 const all=e=>typeof e==='string'?[]:[e,...e.children.flatMap(all)];const event=all(dialog).find(e=>e.tag==='details');event.open=true;event.listeners.toggle();
 const before=event.children.find(e=>e.tag==='details'&&e.children[0]?.textContent==='Przed działaniem');before.open=true;before.listeners.toggle();
 assert.ok(all(before).some(e=>e.textContent==='Zestawienie'));assert.ok(all(before).some(e=>e.textContent==='Pozostałe budynki'));
 assert.ok(!all(dialog).some(e=>/Licznik zbiorów|Historia lokalna|Najazd:|guild_raids_/.test(e.textContent)));assert.ok(all(before).some(e=>e.textContent==='Następny zbiór:'));
 await all(dialog).find(e=>e.textContent==='Eksport JSON').onclick();assert.deepEqual(JSON.parse(await blob.text()),JSON.parse(JSON.stringify(doc)));assert.equal(revoked,true);
 all(dialog).find(e=>e.textContent==='Zamknij').onclick();assert.equal(dialog.open,false);assert.equal(button.focused,true);
});
