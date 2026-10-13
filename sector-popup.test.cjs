const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function setup(saved={}){
 const source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{textContent:'',style:{},getBoundingClientRect:()=>({width:70})});return elements.get(id);};
 const local=new Map([['foe-companion.sectorPopup',JSON.stringify(saved)]]),session=new Map();
 const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)});
 let now=100;
 const popup={style:{}},status={textContent:''};
 const ctx=vm.createContext({$,sectorPopup:popup,sectorStatus:status,soundSettings:{enabled:true},battle:{map:{id:1}},Date:{now:()=>now*1000},localStorage:storage(local),sessionStorage:storage(session)});
 vm.runInContext(source.slice(source.indexOf("    const popupKey="),source.indexOf('    async function unlockAudio()')),ctx);
 return {ctx,$,popup,status,advance:t=>{now=t;vm.runInContext('paintSectorPopup()',ctx);},add:(id,until)=>{ctx.row={id,until,sector:'A'+id,color:'🟣',isAttackBattleType:true};vm.runInContext('updateSectorPopup([row],Date.now()/1000)',ctx);}};
}
test('countdown remains through opening, then disappears after ten seconds',()=>{
 const ui=setup();ui.add(1,120);assert.equal(ui.$('sector-popup-list').textContent,'00:00:20 🟥 🟣 A1');
 ui.advance(120);assert.equal(ui.$('sector-popup-list').textContent,'Otwarte 🟥 🟣 A1');
 ui.advance(130);assert.equal(ui.popup.hidden,true);
});
test('close dismisses all shown sectors but permits a new sector or lock cycle',()=>{
 const ui=setup();ui.add(1,160);ui.add(2,180);ui.$('sector-popup-close').onclick();
 ui.add(1,160);ui.add(2,180);assert.equal(ui.popup.hidden,true);
 ui.add(3,190);assert.equal(ui.$('sector-popup-list').textContent,'00:01:30 🟥 🟣 A3');
 ui.add(1,300);assert.match(ui.$('sector-popup-list').textContent,/A1/);
});
test('automatic hiding does not repeatedly recreate notifications',()=>{
 const ui=setup({autoHide:true,countdown:false});ui.add(1,160);
 assert.equal(ui.$('sector-popup-list').textContent,'🟥 🟣 A1');
 ui.advance(110);ui.add(1,160);assert.equal(ui.popup.hidden,true);
});
test('changing maps and disabling alerts clear the popup',()=>{
 const ui=setup();ui.add(1,160);ui.ctx.battle.map.id=2;ui.advance(101);assert.equal(ui.popup.hidden,true);
 ui.add(2,180);ui.ctx.soundSettings.enabled=false;ui.advance(102);assert.equal(ui.popup.hidden,true);
});
test('settings fold state restores both open and closed sections and saves toggles',()=>{
 const source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const start=source.indexOf("    const foldKey="),end=source.indexOf("    for(const key of ['min','max'])",start);
 const sections=['settings-general','settings-pearls','settings-open','settings-gbg','settings-autoattack','settings-negotiations','changelog','diagnostics'].map(id=>({id,open:true,addEventListener(event,fn){this.toggle=fn;}}));
 let saved=JSON.stringify({'settings-gbg':false,diagnostics:true});
 vm.runInNewContext(source.slice(start,end),{$:()=>({querySelectorAll:()=>sections}),localStorage:{getItem:()=>saved,setItem:(key,value)=>saved=value}});
 assert.equal(sections.find(s=>s.id==='settings-gbg').open,false);
 const diagnostics=sections.find(s=>s.id==='diagnostics');assert.equal(diagnostics.open,true);
 diagnostics.open=false;diagnostics.toggle();assert.equal(JSON.parse(saved).diagnostics,false);
});
