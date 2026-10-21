const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Q=require('./quantum.js');
test('history opens a non-modal draggable window, renders frozen tables and exports a local JSON blob',async()=>{
 class Element{
  constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.listeners={};this.textContent='';}
  append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn;}
  showModal(){throw Error("Must not block the page");}show(){this.open=true;}
  getBoundingClientRect(){return {left:parseFloat(this.style.left)||100,top:parseFloat(this.style.top)||100,width:this.width||900,height:600};}
  closest(tag){return this.tag===tag?this:null;}setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}close(){this.open=false;this.listeners.close?.();}focus(){this.focused=true;}click(){this.clicked=true;}remove(){this.removed=true;}
 }
 const host=new Element('div'),button=new Element('button'),tracker=Q.createTracker();tracker.consume(require('./quantum-definitions.json'));
 tracker.consume({gridId:'guild_raids',entities:[{id:1,cityentity_id:require('./quantum-definitions.json').find(d=>d.name==='Dom wielopiętrowy').id,state:{__class__:'ProducingState',next_state_transition_at:2000000000}},{id:2,cityentity_id:require('./quantum-definitions.json').find(d=>d.name==='Kościół').id,state:{__class__:'IdleState'}}]});const snap={map:tracker.map,summary:tracker.summary()};
 const doc={events:[{id:'a',run:'test',kind:'collection',cycle:1,at:1000,collected:[1],changes:[],before:snap,after:snap}]};
 doc.events.push({...doc.events[0],id:'b',at:2000,kind:'change',collected:[],changes:[{kind:'added',id:2,building:tracker.map.entities[1].cityentity_id}]});
 let blob,revoked=false;
 const history={document:doc,ready:async()=>{},export:()=>JSON.stringify(doc),removeRows:async refs=>{const ids=refs.map(r=>r.id);doc.events=doc.events.filter(e=>!ids.includes(e.id));history.onChange();},editRows:async()=>{},remove:async ids=>{doc.events=doc.events.filter(e=>!ids.includes(e.id));history.onChange();}};
 let sizeChanged;
 const windowEvents={};
 const ctx={ResizeObserver:class {constructor(fn){sizeChanged=fn;}observe(){}},innerWidth:1400,innerHeight:900,addEventListener:(name,fn)=>windowEvents[name]=fn,FoeQuantum:Q,document:{createElement:tag=>new Element(tag)},Blob,Date,URL:{createObjectURL:b=>{blob=b;return 'blob:local';},revokeObjectURL:()=>revoked=true},setTimeout:fn=>fn()};
 vm.runInNewContext(fs.readFileSync(__dirname+'/quantum-history.js','utf8'),ctx);
 ctx.FoeQuantumHistory.mount({root:host,button,history});await button.onclick();const dialog=host.children[0];assert.equal(dialog.open,true);
 const top=dialog.children[0];
 assert.match(dialog.style.cssText,/position:fixed/);assert.match(dialog.style.cssText,/z-index:2147483647/);
 const pointer=(target,x,y,id=1)=>({target,button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 top.listeners.pointerdown(pointer(top,270,74));assert.equal(top.capture,1);
 top.listeners.pointermove(pointer(top,370,124));assert.equal(dialog.style.left,'350px');assert.equal(dialog.style.top,'104px');
 top.listeners.pointerup(pointer(top,370,220));assert.equal(top.capture,null);
 top.listeners.pointermove(pointer(top,400,300));assert.equal(dialog.style.left,'350px');
 top.listeners.pointerdown(pointer(top.children.find(e=>e.tag==='button'),370,220));assert.equal(top.capture,null);
 top.listeners.pointerdown(pointer(top,370,220));top.listeners.pointermove(pointer(top,5000,5000));assert.equal(dialog.style.left,'1220px');assert.equal(dialog.style.top,'830px');
 top.listeners.pointercancel(pointer(top,5000,5000));assert.equal(top.capture,null);
 ctx.innerWidth=1000;ctx.innerHeight=700;windowEvents.resize();assert.equal(dialog.style.left,'820px');assert.equal(dialog.style.top,'630px');
 dialog.listeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(dialog.open,false);
 await button.onclick();assert.equal(dialog.open,true);assert.equal(dialog.style.left,'820px');assert.equal(dialog.style.top,'630px');
 assert.match(dialog.style.cssText,/resize:horizontal/);
 assert.match(dialog.style.cssText,/min-width:min\(360px,96vw\)/);
 dialog.width=950;sizeChanged();assert.equal(dialog.style.left,'810px');
 dialog.width=400;dialog.style.width='400px';sizeChanged();
 dialog.close();await button.onclick();assert.equal(dialog.style.width,'400px');
 top.listeners.pointerdown(pointer(top,830,650));top.listeners.pointermove(pointer(top,5000,650));
 assert.equal(dialog.style.left,'920px'); // 80 px (20% of 400) remain visible.
 top.listeners.pointerup(pointer(top,5000,650));
 top.listeners.pointerdown(pointer(top,940,650));top.listeners.pointermove(pointer(top,220,120));
 assert.equal(dialog.style.left,'200px');assert.equal(dialog.style.top,'100px');
 top.listeners.pointerup(pointer(top,220,120));
 const all=e=>typeof e==='string'?[]:[e,...e.children.flatMap(all)];const event=all(dialog).find(e=>e.tag==='details');event.open=true;event.listeners.toggle();
 const before=event.children.find(e=>e.tag==='details'&&e.children[0]?.textContent==='Przed i Po');before.open=true;before.listeners.toggle();
 assert.ok(all(event).some(e=>e.textContent==='Zbieram: '));assert.ok(all(event).some(e=>e.tag==='strong'&&e.textContent==='1× Dom wielopiętrowy'));assert.ok(all(event).filter(e=>e.tag==='input').every(e=>e.style.cssText.includes('text-align:right')));
 assert.ok(all(before).some(e=>e.textContent==='Zestawienie'));assert.ok(all(before).some(e=>e.textContent==='Pozostałe budynki'));
 assert.ok(!all(dialog).some(e=>/Licznik zbiorów|Historia lokalna|Najazd:|guild_raids_/.test(e.textContent)));assert.ok(all(before).some(e=>e.textContent==='Następny zbiór:'));
 const content=dialog.children.find(e=>e.style.cssText?.includes('min-height:0'));assert.ok(content);assert.match(top.style.cssText,/padding:10px 14px/);assert.ok(!top.style.cssText.includes('sticky'));
 const notes=all(event).filter(e=>e.tag==='input');assert.ok(notes.every(e=>e.placeholder==='Dodaj notatkę…'&&e.style.cssText.includes('outline:none')&&!e.style.cssText.includes('border-bottom')));
 assert.ok(all(dialog).some(e=>e.textContent==='↶ Cofnij'));assert.ok(all(event).some(e=>e.title?.startsWith('Rozdziel od tego działania')));
 const actions=event.children.find(e=>e.tag==='details'&&e.children[0]?.textContent.startsWith('Działania'));actions.open=true;content.scrollTop=123;
 assert.deepEqual(all(actions).filter(e=>['Stawiam: ','Zbieram: '].includes(e.textContent)).map(e=>e.textContent),['Stawiam: ','Zbieram: ']);
 await all(actions).find(e=>e.title==='Usuń działanie').onclick();
 const refreshed=all(dialog).find(e=>e.tag==='details');assert.equal(refreshed.open,true);
 assert.equal(refreshed.children.find(e=>e.tag==='details'&&e.children[0]?.textContent.startsWith('Działania')).open,true);
 assert.equal(refreshed.children.find(e=>e.tag==='details'&&e.children[0]?.textContent==='Przed i Po').open,true);
 assert.equal(content.scrollTop,123);assert.equal(doc.events.length,1);assert.equal(doc.events[0].id,'a');
 await all(dialog).find(e=>e.textContent==='Eksport JSON').onclick();assert.deepEqual(JSON.parse(await blob.text()),JSON.parse(JSON.stringify(doc)));assert.equal(revoked,true);
 all(dialog).find(e=>e.title==='Zamknij historię').onclick();assert.equal(dialog.open,false);assert.equal(button.focused,true);
});
