const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(session=new Map()){
 const source=fs.readFileSync(__dirname+'/panel.js','utf8'),elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{textContent:'',style:{},getBoundingClientRect:()=>({width:70})});return elements.get(id);};
 let now=100;const popup={style:{}},status={textContent:''};
 const ctx=vm.createContext({$,sectorPopup:popup,sectorStatus:status,soundSettings:{enabled:true,minutes:2},battle:{map:{id:1}},Date:{now:()=>now*1000},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)}});
 vm.runInContext(source.slice(source.indexOf("    const popupKey="),source.indexOf('    async function unlockAudio()')),ctx);
 return {ctx,$,popup,session,advance:t=>{now=t;vm.runInContext('paintSectorPopup()',ctx);},add:(id,until,extra={})=>{ctx.row={id,until,sector:'A'+id,color:'🟣',isAttackBattleType:true,...extra};vm.runInContext('updateSectorPopup([row],Date.now()/1000)',ctx);}};
}
test('countdown ticks and notification remains after opening until explicitly closed',()=>{
 const ui=setup();ui.add(1,120);assert.match(ui.$('sector-popup-list').textContent,/00:00:20/);
 ui.advance(110);assert.match(ui.$('sector-popup-list').textContent,/00:00:10/);
 ui.advance(120);assert.match(ui.$('sector-popup-list').textContent,/Otwarte/);
 ui.advance(5000);assert.equal(ui.popup.hidden,false);ui.$('sector-popup-close').onclick();assert.equal(ui.popup.hidden,true);
});
test('dismissal is per sector for exactly one hour, survives reload and ignores changed opening time',()=>{
 const ui=setup();ui.add(1,160);ui.$('sector-popup-close').onclick();
 assert.deepEqual(JSON.parse(ui.session.get('foe-companion.sectorPopup.dismissed.v2')),{'1:1':3700});
 const reloaded=setup(ui.session);reloaded.add(1,180);assert.equal(reloaded.popup.hidden,true);
 reloaded.advance(3699);reloaded.add(1,3750);assert.equal(reloaded.popup.hidden,true);
 reloaded.advance(3700);reloaded.add(1,3750);assert.equal(reloaded.popup.hidden,false);
});
test('open sectors require strictly less than half progress and 30 percent resistance',()=>{
 const ui=setup();ui.add(1,0,{progress:49,maxProgress:100,gainAttritionChance:29});assert.equal(ui.popup.hidden,false);
 const rejected=[{progress:50,maxProgress:100,gainAttritionChance:29},{progress:1,maxProgress:100,gainAttritionChance:30},{progress:0,maxProgress:null,gainAttritionChance:0},{progress:0,maxProgress:100,gainAttritionChance:null}];
 for(const data of rejected){const other=setup();other.add(1,0,data);assert.equal(other.popup.hidden,true);}
 ui.advance(10000);assert.equal(ui.popup.hidden,false);
});
test('disable/map change clears visibility without marking dismissal',()=>{
 const ui=setup();ui.add(1,160);ui.ctx.soundSettings.enabled=false;ui.advance(101);assert.equal(ui.popup.hidden,true);
 ui.ctx.soundSettings.enabled=true;ui.add(1,160);assert.equal(ui.popup.hidden,false);
 ui.ctx.battle.map.id=2;ui.advance(102);assert.equal(ui.popup.hidden,true);
 ui.ctx.battle.map.id=1;ui.add(1,160);assert.equal(ui.popup.hidden,false);
});
test('socket province updates remove a notification strictly above 90 percent without dismissal cooldown',()=>{
 const Model=require('./model.js'),ui=setup();
 let battle={currentParticipantId:1,battlegroundParticipants:[{participantId:2,colour:'purple'}],map:{id:'waterfall_archipelago',provinces:[]}};
 ui.ctx.battle=battle;
 const update=progress=>{
  const province={__class__:'GuildBattlegroundProvince',id:1,ownerId:2,lockedUntil:0,gainAttritionChance:10,conquestProgress:[{participantId:1,progress,maxProgress:120}]};
  if(!battle.map.provinces.length)battle.map.provinces=[province];
  battle=Model.updateBattle(battle,[{requestClass:'GuildBattlegroundService',requestMethod:'getProvinces',responseData:[province]}]).battle;
  ui.ctx.battle=battle;ui.ctx.rows=Model.rows(battle,false).rows;
  vm.runInContext('updateSectorPopup(rows,Date.now()/1000)',ui.ctx);
 };
 update(20);assert.equal(ui.popup.hidden,false);
 update(108);assert.equal(ui.popup.hidden,false);
 update(109);assert.equal(ui.popup.hidden,true);
 assert.deepEqual(JSON.parse(ui.session.get('foe-companion.sectorPopup.dismissed.v2')),{});
 update(0);assert.equal(ui.popup.hidden,false);
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
