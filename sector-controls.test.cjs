const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/panel.js','utf8');
const element=()=>({style:{},dataset:{},setAttribute(k,v){this[k]=v;}});
test('guard column toggles visible rows only, mixed state, schedules and cancels each timer',()=>{
 const calls=[],columns=new Map(['guard','closeAtHour','closeWhenThreatened'].map(key=>[key,{toggle:element(),items:[1,2,3].map(id=>({id,cb:{checked:id===1},tr:{hidden:id===3}}))}]));
 const context=vm.createContext({guardColumns:columns,battle:{map:{id:'m'}},modalMapId:'m',setGuard:(map,id,patch)=>calls.push(['save',id,patch]),scheduleCloseAtHour:id=>calls.push(['schedule',id]),cancelCloseAtHour:id=>calls.push(['cancel',id]),bulkAutomation:{resumeGuards:()=>calls.push(['resume'])},paintRow(){},paintOpenSectors(){},checkSectorAlerts(){}});
 const start=source.indexOf('      function paintGuardColumns()'),end=source.indexOf('      for(const row of open){',start);vm.runInContext(source.slice(start,end),context);
 vm.runInContext('paintGuardColumns()',context);assert.equal(columns.get('guard').toggle['aria-checked'],'mixed');
 for(const key of columns.keys()){
  calls.length=0;vm.runInContext('toggleGuardColumn('+JSON.stringify(key)+')',context);
  assert.deepEqual(columns.get(key).items.map(i=>i.cb.checked),[true,true,false]);assert.equal(columns.get(key).toggle['aria-checked'],'true');assert.equal(calls.filter(c=>c[0]==='save').length,2);
  if(key==='closeAtHour')assert.deepEqual(calls.filter(c=>c[0]==='schedule'),[['schedule',1],['schedule',2]]);
  calls.length=0;vm.runInContext('toggleGuardColumn('+JSON.stringify(key)+')',context);assert.equal(columns.get(key).toggle['aria-checked'],'false');
  if(key==='closeAtHour')assert.deepEqual(calls.filter(c=>c[0]==='cancel'),[['cancel',1],['cancel',2]]);
 }
 calls.length=0;context.battle.map.id='new';vm.runInContext('toggleGuardColumn("guard")',context);assert.equal(calls.length,0);
});
test('indicators and modal counters follow shared state, including STOP while action finishes',()=>{
 const indicators=['attack','negotiation','attack','negotiation'].map(kind=>({...element(),dataset:{automationIndicator:kind}}));const cells=[0,1,2].map(i=>({...element(),dataset:{modalCounter:String(i)}}));
 const state={attack:true,negotiation:true,active:{kind:'attack'}},stats={textContent:'🏆 3/4'},negStats={textContent:'🤝 2/2'},attritionStats={textContent:'🔥 7'};
 const context=vm.createContext({bulkAutomation:{state},stats,negStats,attritionStats,root:{querySelectorAll:selector=>selector.includes('automation-indicator')?indicators:cells}});
 const start=source.indexOf('    function paintAutomationIndicators()'),end=source.indexOf('    function paintBulkControls()',start);vm.runInContext(source.slice(start,end)+'paintAutomationIndicators()',context);
 assert.ok(indicators.every(b=>!b.hidden&&!b.disabled));assert.deepEqual(cells.map(c=>c.textContent),['🏆 3/4','🤝 2/2','🔥 7']);
 state.attack=false;vm.runInContext('paintAutomationIndicators()',context);assert.equal(indicators[0].hidden,false);assert.equal(indicators[0].disabled,true);assert.match(indicators[0]['data-tooltip'],/dokańczanie/);assert.equal(indicators[1].disabled,false);
 state.active=null;stats.textContent='🏆 3/5';vm.runInContext('paintAutomationIndicators()',context);assert.equal(indicators[0].hidden,true);assert.equal(indicators[1].hidden,false);assert.equal(cells[0].textContent,'🏆 3/5');
 state.negotiation=false;vm.runInContext('paintAutomationIndicators()',context);assert.ok(indicators.every(b=>b.hidden));
});

test('complete modal mounts its column controls and counters and applies header clicks',()=>{
 class E{constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.textContent='';this.title='';}append(...xs){this.children.push(...xs);}setAttribute(k,v){this[k]=v;}getAttribute(k){return this[k]??null;}addEventListener(){}remove(){this.removed=true;}}
 const root=new E('root');root.querySelector=()=>null;const guards=new Map();
 const context=vm.createContext({root,battle:{map:{id:'m'}},document:{createElement:tag=>new E(tag),addEventListener(){},removeEventListener(){}},FoeModel:{rows:()=>({rows:[{id:1,until:0,progress:7,maxProgress:132,gainAttritionChance:20,sector:'A',color:'🔴'}]})},getGuard:(map,id)=>guards.get(Number(id))||{},setGuard:(map,id,patch)=>guards.set(id,{...guards.get(id),...patch}),bulkAutomation:{resumeGuards(){}},scheduleCloseAtHour(){},cancelCloseAtHour(){},paintOpenSectors(){},checkSectorAlerts(){},paintBulkControls(){},convertTitles(){},actionVisible:()=>true,battleReady:true,battlePending:null,battlePendingSector:null,battleWaveSector:null,battleLastSector:null,autoSector:null,autoNegSector:null,negPending:null,negPendingSector:null,negLastSector:null,stats:{textContent:'🏆 0/0',title:'walki'},negStats:{textContent:'🤝 2/2',title:'nego'},attritionStats:{textContent:'🔥 0',title:'opór'}});
 const a=source.indexOf('    function openSectorGuardModal()'),b=source.indexOf("    $('sector-guard-open').onclick",a);vm.runInContext(source.slice(a,b)+'openSectorGuardModal()',context);
 const all=e=>[e,...e.children.flatMap(all)],nodes=all(root),toggles=nodes.filter(n=>n.role==='checkbox');assert.equal(toggles.length,3);assert.deepEqual(nodes.filter(n=>n.dataset.modalCounter!==undefined).map(n=>n.textContent),['🏆 0/0','🤝 2/2','🔥 0']);
 toggles[0].onclick();assert.equal(guards.get(1).guard,true);toggles[0].onclick();assert.equal(guards.get(1).guard,false);
});
