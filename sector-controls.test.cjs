const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/panel.js','utf8');
const element=()=>({style:{},dataset:{},setAttribute(k,v){this[k]=v;}});
test('guard column toggles visible rows only, mixed state, schedules and cancels each timer',()=>{
 const calls=[],columns=new Map(['guard','closeAtHour','closeWhenThreatened'].map(key=>[key,{toggle:element(),items:[1,2,3].map(id=>({id,cb:{checked:id===1},tr:{hidden:id===3}}))}]));
 const context=vm.createContext({bulkSettings:{closeEnemyProgress:50},guardColumns:columns,battle:{map:{id:'m'}},modalMapId:'m',setGuard:(map,id,patch)=>calls.push(['save',id,patch]),scheduleCloseAtHour:id=>calls.push(['schedule',id]),cancelCloseAtHour:id=>calls.push(['cancel',id]),bulkAutomation:{resumeGuards:()=>calls.push(['resume'])},paintRow(){},paintOpenSectors(){},checkSectorAlerts(){}});
 const start=source.indexOf('      function paintGuardColumns()'),end=source.indexOf('      modal.refresh=()=>{',start);vm.runInContext(source.slice(start,end),context);
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
 class E{constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.textContent='';this.title='';}replaceChildren(){this.children=[];}append(...xs){this.children.push(...xs);}setAttribute(k,v){this[k]=v;}getAttribute(k){return this[k]??null;}addEventListener(){}remove(){this.removed=true;}}
 const root=new E('root');root.querySelector=()=>null;const guards=new Map();
 const context=vm.createContext({bulkSettings:{closeEnemyProgress:50},mountSectorWindow(){},root,battle:{map:{id:'m'}},document:{createElement:tag=>new E(tag),addEventListener(){},removeEventListener(){}},FoeModel:{...require('./model.js'),rows:()=>({rows:[{id:1,until:0,progress:7,maxProgress:132,gainAttritionChance:20,sector:'A',color:'🔴'}]})},getGuard:(map,id)=>guards.get(Number(id))||{},setGuard:(map,id,patch)=>guards.set(id,{...guards.get(id),...patch}),bulkAutomation:{resumeGuards(){}},scheduleCloseAtHour(){},cancelCloseAtHour(){},paintOpenSectors(){},checkSectorAlerts(){},paintBulkControls(){},convertTitles(){},actionVisible:()=>true,battleReady:true,battlePending:null,battlePendingSector:null,battleWaveSector:null,battleLastSector:null,battleLastUntil:0,battleLastOK:false,negLastUntil:0,negLastOK:false,autoSector:null,autoNegSector:null,negPending:null,negPendingSector:null,negLastSector:null,stats:{textContent:'🏆 0/0',title:'walki'},negStats:{textContent:'🤝 2/2',title:'nego'},attritionStats:{textContent:'🔥 0',title:'opór'}});
 const a=source.indexOf('    function openSectorGuardModal()'),b=source.indexOf("    $('sector-guard-open').onclick",a);vm.runInContext(source.slice(a,b)+'openSectorGuardModal()',context);
 const all=e=>[e,...e.children.flatMap(all)],nodes=all(root),toggles=nodes.filter(n=>n.role==='checkbox');assert.equal(toggles.length,3);assert.deepEqual(nodes.filter(n=>n.dataset.modalCounter!==undefined).map(n=>n.textContent),['🏆 0/0','🤝 2/2','🔥 0']);
 const status=nodes.find(n=>n.dataset.bulkStatus);assert.equal(status.title,'');assert.equal(status['data-tooltip'],undefined);assert.match(status.style.cssText,/text-overflow:ellipsis/);assert.match(root.children[0].style.cssText,/pointer-events:none/);
 toggles[0].onclick();assert.equal(guards.get(1).guard,true);toggles[0].onclick();assert.equal(guards.get(1).guard,false);
 const modal=root.children[0],box=modal.children[0],tbody=all(modal).find(n=>n.tag==='tbody');box.style.left='250px';guards.set(1,{guard:true});
 let rows=[{id:1,until:0,progress:9,maxProgress:132,gainAttritionChance:20,sector:'A',color:'🔴',enemyProgress:80},{id:2,until:0,sector:'B',color:'⚪'}];context.FoeModel.rows=()=>({rows});modal.refresh();assert.equal(tbody.children.length,1);assert.equal(tbody.children[0].children[2].textContent,'9/132');assert.match(tbody.children[0].children[1].children[0].textContent,/👾80/);assert.equal(all(tbody).find(n=>n.type==='checkbox').checked,true);assert.equal(box.style.left,'250px');assert.equal(root.children[0],modal);
 rows[0].until=Date.now()/1000+100;modal.refresh();assert.equal(tbody.children.length,1);assert.equal(tbody.children[0].dataset.locked,'true');assert.ok(all(tbody).filter(n=>n.tag==='button'||n.tag==='input').every(n=>n.disabled));rows[0].until=0;modal.refresh();assert.equal(tbody.children.length,1);rows[0].color='⚪';modal.refresh();assert.equal(tbody.children.length,0);
 let now=98000;context.Date={now:()=>now};rows=[{id:1,until:0,color:'🔴',sector:'Open'},...Array.from({length:7},(_,i)=>({id:i+3,until:107-i,color:'🔵',sector:'Soon'+i}))];modal.refresh();
 assert.deepEqual(tbody.children.map(n=>n.dataset.sid),[1,9,8,7,6,5]);assert.equal(tbody.children[0].children[0].textContent,'Otwarte');assert.equal(tbody.children[1].children[0].textContent,'00:00:03');
 const first=tbody.children[1];now=99000;modal.refresh();assert.equal(tbody.children[1],first);assert.equal(first.children[0].textContent,'00:00:02');
 for(const toggle of toggles){toggle.onclick();}assert.equal(guards.has(9),false);
 now=101000;modal.refresh();assert.equal(tbody.children.filter(n=>n.dataset.locked==='false').length,2);assert.equal(tbody.children.length,7);assert.equal(tbody.children.find(n=>n.dataset.sid===9).children[0].textContent,'Otwarte');
 rows=rows.filter(r=>r.id!==1&&r.id!==9);modal.refresh();assert.ok(toggles.every(t=>t.disabled));assert.equal(tbody.children.length,5);
 context.actionVisible=k=>k==='negotiation';modal.refresh();let header=all(modal).find(n=>n.tag==='thead').children[0];assert.equal(header.children[5].textContent,'');assert.equal(header.children[7].textContent,'');
 for(const tr of [header,...tbody.children]){assert.ok(tr.children[4].hidden&&tr.children[5].hidden);assert.equal(tr.children[6].hidden,false);assert.equal(tr.children[8].hidden,false);}
 context.actionVisible=()=>false;modal.refresh();for(const tr of [header,...tbody.children])assert.ok(tr.children.slice(4).every(c=>c.hidden));
 context.actionVisible=()=>true;modal.refresh();for(const tr of [header,...tbody.children])assert.ok(tr.children.every(c=>!c.hidden));
 context.battle.map.id='new-map';modal.close=()=>{modal.removed=true;};modal.refresh();assert.equal(modal.removed,true);
});

test('floating window drags beyond right edge, ignores controls and cleans up on Escape or close',()=>{
 const events=()=>({listeners:{},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];}});
 const window={...events(),innerWidth:1000,innerHeight:800},document=events(),header={...events(),style:{},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
 const box={style:{},getBoundingClientRect:()=>({width:500,left:100,top:50})},modal={remove(){this.removed=true;}},close={};
 const ctx={window,document,header,box,modal,close};const a=source.indexOf('    function mountSectorWindow('),b=source.indexOf('    function openSectorGuardModal()',a);
 vm.runInNewContext(source.slice(a,b)+'mountSectorWindow(modal,box,header,close)',ctx);
 const event={button:0,pointerId:1,clientX:110,clientY:60,target:{closest:()=>null},preventDefault(){}};
 header.listeners.pointerdown(event);header.listeners.pointermove({...event,clientX:2000,clientY:2000});assert.equal(box.style.left,'900px');assert.equal(box.style.top,'752px');
 header.listeners.pointerup(event);header.listeners.pointerdown({...event,target:{closest:()=>true}});header.listeners.pointermove(event);assert.equal(box.style.left,'900px');
 assert.equal(modal.onclick,undefined);assert.equal(document.listeners.click,undefined);
 document.listeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(modal.removed,true);assert.equal(document.listeners.keydown,undefined);assert.equal(window.listeners.resize,undefined);
 modal.removed=false;vm.runInNewContext(source.slice(a,b)+'mountSectorWindow(modal,box,header,close)',ctx);close.onclick();assert.equal(modal.removed,true);
});

test('progress and copied rows omit controls, enemy replaces race, unknown limit stays explicit',()=>{
 const M=require('./model.js'),row={sector:'B3X',color:'🟡',isAttackBattleType:true,progress:58,maxProgress:132,gainAttritionChance:20,race:true,enemyProgress:34};
 assert.equal(M.openSectorText(row),'🟥 🟡 B3X 👾34 | 58/132 | 20%');
 assert.equal(M.progressText({...row,progress:0}),'0');assert.equal(M.progressText({...row,maxProgress:null}),'58/—');assert.equal(M.sectorMarker({...row,enemyProgress:0}),' 🔥');
});

test('threatened sector uses configured enemy threshold and respects paused guards',()=>{
 const row={id:1,sector:'A',color:'🔴',until:0,maxProgress:100},entry={participantId:2,progress:50};const calls=[];
 const ctx={paintSectorPopup(){},battle:{currentParticipantId:1,map:{id:'m',provinces:[{id:1,conquestProgress:[entry]}]}},$:()=>({checked:true}),FoeModel:{rows:()=>({rows:[row]})},getGuard:()=>({}),updateSectorPopup(){},loadGuards:()=>({'m:1':{closeWhenThreatened:true}}),cancelCloseAtHour(){},scheduleCloseAtHour(){},closeAtHourTimers:new Map(),enemyProgressPrev:new Map(),guardAlerted:new Map(),setBattleFeedback(){},soundSettings:{enabled:false},bulkSettings:{closeEnemyProgress:50},bulkAutomation:{engaged:false,guardsPaused:false},autoSector:null,battlePending:null,startFight:id=>calls.push(id)};
 const a=source.indexOf('    function checkSectorAlerts()'),b=source.indexOf("    $('gbg-sound-enabled').onchange",a);vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);
 const run=()=>vm.runInContext('checkSectorAlerts()',ctx);run();assert.equal(calls.length,0);entry.progress=51;run();assert.equal(calls.length,1);
 ctx.bulkSettings.closeEnemyProgress=75;run();assert.equal(calls.length,1);entry.progress=76;run();assert.equal(calls.length,2);
 ctx.bulkAutomation.guardsPaused=true;entry.progress=90;run();assert.equal(calls.length,2);
});
