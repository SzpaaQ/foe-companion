const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('./sector-automation.js'),L=require('./battleground-live.js');
const row=(patch={})=>({id:7,sector:'A',ownerId:2,color:'🔴',until:0,progress:0,maxProgress:100,gainAttritionChance:20,isAttackBattleType:true,mapId:'m',endsAt:10000,...patch});
function setup(storage){let time=1000;const saved=new Map();storage||={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const c=A.create({storage,now:()=>time}),sent=[],env={scope:'world:player:season:map',allRows:[row()],rows:[row()],config:A.settings({maxAttrition:10,negWins:2}),attrition:5,ready:true,busy:false,reserve:3,delay:100,send:(kind,id,policy)=>{sent.push({kind,id,policy});return true;}};
 return {c,env,sent,storage,tick(){time+=200;c.tick(env);},result(data={}){return c.result({ok:true,won:true,refreshed:true,...data});}};
}
test('strict eligibility respects exact 20%, ignored, types, limits and reserve',()=>{
 const config=A.settings();assert.equal(A.eligible(row(),'attack',config,1,3),true);
 for(const patch of [{ignored:true},{until:2},{color:'⚪'},{maxProgress:null,progress:1},{progress:50},{isAttackBattleType:false}])assert.equal(A.eligible(row(patch),'attack',config,1,3),false);
 assert.equal(A.eligible(row({progress:49}),'attack',config,1,51),false);
 for(const chance of [null,0,19,21,29])assert.equal(A.eligible(row({gainAttritionChance:chance}),'negotiation',config,1),false);
 assert.equal(A.eligible(row({isAttackBattleType:false}),'negotiation',config,1),true);
 assert.equal(A.eligible(row(),'attack',A.settings({attack:false,defense:false}),1),false);
});
test('negotiation failures have no limit, successes persist per opening and modes do not restart on reload',()=>{
 const h=setup();h.c.enable('negotiation',true);
 for(let i=0;i<5;i++){h.tick();h.result({ok:false,won:false,continueAuto:true,surrendered:true});}
 assert.equal(h.c.state.negotiation,true);
 for(let i=0;i<2;i++){h.tick();h.result();}h.tick();assert.equal(h.sent.length,7);
 h.c.stop();h.c.enable('negotiation',true);h.tick();assert.equal(h.sent.length,7);
 const reload=setup(h.storage);assert.equal(reload.c.engaged,false);reload.c.enable('negotiation',true);reload.tick();assert.equal(reload.sent.length,0);
 reload.env.allRows=[row({until:3})];reload.env.rows=reload.env.allRows;reload.tick();
 reload.env.allRows=[row()];reload.env.rows=reload.env.allRows;reload.tick();assert.equal(reload.sent.length,1);
});
test('three consecutive defeats stop attack across sectors; win resets; no fourth action',()=>{
 const h=setup();h.c.enable('attack',true);
 for(const won of [false,false,true,false,false,false]){h.tick();h.result({won});h.env.rows=[row({id:h.sent.length+10})];h.env.allRows=h.env.rows;}
 assert.equal(h.c.state.attack,false);assert.equal(h.c.state.losses,3);h.tick();assert.equal(h.sent.length,6);
 h.c.enable('attack',true);assert.equal(h.c.state.losses,0);h.tick();assert.equal(h.sent.length,7);
});
test('STOP keeps current multiwave battle authorized but never starts another',()=>{
 const h=setup();h.c.enable('attack',true);h.tick();h.c.stop();
 assert.equal(h.result({nextWave:true}),'wave');assert.ok(h.c.active);assert.equal(h.c.state.losses,0);
 h.result({won:false});assert.equal(h.c.active,null);h.tick();assert.equal(h.sent.length,1);
});
test('negotiation has priority, then attack; busy and policy updates block new actions',()=>{
 const h=setup();h.c.enable('attack',true);h.c.enable('negotiation',true);h.env.busy=true;h.tick();assert.equal(h.sent.length,0);
 h.env.busy=false;for(let i=0;i<2;i++){h.tick();assert.equal(h.sent.at(-1).kind,'negotiation');h.result();}
 h.tick();assert.equal(h.sent.at(-1).kind,'attack');h.result();
 h.env.rows=[row({ignored:true})];h.tick();assert.equal(h.sent.length,3);
 h.env.ready=false;h.tick();assert.equal(h.c.engaged,false);
});
test('unknown or excessive attrition never starts negotiation; uncertain result stays blocked after reload',()=>{
 const h=setup();h.c.enable('negotiation',true);h.env.attrition=null;h.tick();assert.equal(h.sent.length,0);
 h.env.attrition=11;h.tick();assert.equal(h.c.state.negotiation,false);
 h.env.attrition=10;h.c.enable('negotiation',true);h.tick();h.result({ok:false,won:undefined,refreshed:false});assert.equal(h.c.engaged,false);
 const reload=setup(h.storage);reload.c.enable('negotiation',true);reload.tick();assert.equal(reload.sent.length,0);
});
test('map change stops both modes; storage failure prevents sending',()=>{
 const h=setup();h.c.enable('attack',true);h.env.busy=true;h.tick();h.env.scope='new-season';h.tick();assert.equal(h.c.state.attack,false);
 const broken=setup({getItem:()=>null,setItem(){throw Error('quota');}});broken.c.enable('negotiation',true);broken.tick();assert.equal(broken.sent.length,0);assert.equal(broken.c.engaged,false);
});
test('MAIN policy rechecks live progress, ignore signals, type, chance and season',()=>{
 const t=L.createTracker();t.setConnected(true);
 const province={id:7,ownerId:2,isAttackBattleType:true,gainAttritionChance:20,conquestProgress:[{participantId:1,progress:10,maxProgress:100}]};
 t.consume({currentParticipantId:1,endsAt:1000,map:{id:'m',provinces:[province]},battlegroundParticipants:[{participantId:1,signals:[]}]});
 const policy={kind:'attack',mapId:'m',endsAt:1000,reserve:3,progress:50,attack:true,defense:false};
 assert.equal(t.checkPolicy(7,policy).progress,10);assert.throws(()=>t.checkPolicy(7,{...policy,endsAt:1001}));
 t.consume({participantId:1,signals:[{signal:'ignore',provinceId:7}]});assert.throws(()=>t.checkPolicy(7,policy));
 t.consume({participantId:1,signals:[]});
 t.consume({requestClass:'GuildBattlegroundService',requestMethod:'getProvince',responseData:{...province,conquestProgress:[{participantId:1,progress:50,maxProgress:100}]}},'socket');assert.throws(()=>t.checkPolicy(7,policy));
});

test('map switch during a wave never authorizes a further wave or restarts modes',()=>{
 const h=setup();h.c.enable('attack',true);h.tick();h.c.stop();assert.equal(h.c.enable('attack',true),false);
 h.env.scope='different-map';h.tick();assert.equal(h.result({nextWave:true}),true);assert.equal(h.c.engaged,false);h.tick();assert.equal(h.sent.length,1);
});
test('live attrition invalidates after victory until a player update arrives',()=>{
 const t=L.createTracker();t.setConnected(true);t.consume({currentParticipantId:1,endsAt:1000,currentPlayerParticipant:{attrition:{__class__:'GuildBattlegroundAttrition',level:5}},map:{id:'m',provinces:[{id:7,ownerId:2,gainAttritionChance:20,conquestProgress:[{participantId:1,progress:10,maxProgress:100}]}]}});
 const policy={kind:'negotiation',mapId:'m',endsAt:1000,reserve:3,progress:50,maxAttrition:5};
 t.checkPolicy(7,policy);t.consume({requestClass:'NegotiationGameService',responseData:{state:'won'}});assert.throws(()=>t.checkPolicy(7,policy));
 t.consume({requestClass:'GuildBattlegroundService',requestMethod:'getPlayerParticipant',responseData:{attrition:{__class__:'GuildBattlegroundAttrition',level:5}}});t.checkPolicy(7,policy);
 t.setConnected(false);assert.throws(()=>t.checkPolicy(7,policy));
});
test('model applies latest ignore signals from the same batch',()=>{
 const M=require('./model.js');const battle={map:{id:'m',provinces:[]},battlegroundParticipants:[{participantId:1,signals:[]}]};
 const result=M.updateBattle(battle,[{participantId:1,signals:[{signal:'ignore',provinceId:7}]},{participantId:1,signals:[]}]);
 assert.equal(result.changed,true);assert.deepEqual(result.battle.battlegroundParticipants[0].signals,[]);
});

test('guard cannot bypass STOP or three losses without explicit rearming',()=>{
 const h=setup();h.c.enable('attack',true);for(let i=0;i<3;i++){h.tick();h.result({won:false});}
 assert.equal(h.c.engaged,false);assert.equal(h.c.guardsPaused,true);h.c.resumeGuards();assert.equal(h.c.guardsPaused,false);
 h.c.enable('attack',true);h.tick();h.c.stop();h.c.resumeGuards();assert.equal(h.c.guardsPaused,true);h.result();h.c.resumeGuards();assert.equal(h.c.guardsPaused,false);
});

test('omitted default fields clear old attack type and attrition chance',()=>{
 const t=L.createTracker();t.setConnected(true);const province={__class__:'GuildBattlegroundProvince',id:7,ownerId:2,isAttackBattleType:true,gainAttritionChance:20,conquestProgress:[{participantId:1,progress:10,maxProgress:100}]};
 t.consume({currentParticipantId:1,endsAt:1000,map:{id:'m',provinces:[province]}});
 const policy={kind:'attack',mapId:'m',endsAt:1000,reserve:3,progress:50,attack:true,defense:false};t.checkPolicy(7,policy);
 const {isAttackBattleType,gainAttritionChance,...defaults}=province;t.consume({requestClass:'GuildBattlegroundService',requestMethod:'getProvince',responseData:defaults},'socket');assert.throws(()=>t.checkPolicy(7,policy));assert.equal(t.snapshot(7).value.gainAttritionChance,0);
});

test('untouched sector permits first attack only, not unknown positive progress',()=>{
 const config=A.settings();assert.equal(A.eligible(row({maxProgress:null}),'attack',config,1,3),true);
 for(const [kind,patch] of [['negotiation',{maxProgress:null}],['attack',{maxProgress:null,progress:1}],['attack',{maxProgress:0}],['attack',{maxProgress:null,ignored:true}],['attack',{maxProgress:null,isAttackBattleType:false}]])assert.equal(A.eligible(row(patch),kind,config,1,3),false);
 const h=setup();h.env.rows=h.env.allRows=[row({maxProgress:null})];h.c.enable('attack',true);h.tick();assert.equal(h.sent.length,1);h.result();h.env.rows=h.env.allRows=[row({maxProgress:null,progress:1})];h.tick();assert.equal(h.sent.length,1);
});
test('enemy conquest limit gives our zero progress the same denominator in model and MAIN',()=>{
 const M=require('./model.js'),t=L.createTracker();t.setConnected(true);
 const battle={currentParticipantId:1,endsAt:1000,battlegroundParticipants:[],map:{id:'waterfall_archipelago',provinces:[{id:7,ownerId:2,isAttackBattleType:true,conquestProgress:[{participantId:3,progress:42,maxProgress:132}]}]}};
 t.consume(battle);const row=M.rows(battle,false).rows[0];assert.equal(row.progress,0);assert.equal(row.maxProgress,132);assert.equal(t.snapshot(7).maxProgress,132);
 const policy={kind:'attack',mapId:battle.map.id,endsAt:1000,reserve:3,progress:50,attack:true,defense:false};t.checkPolicy(7,policy);
 battle.map.provinces[0].conquestProgress=[];t.consume(battle);t.checkPolicy(7,policy);
 battle.map.provinces[0].conquestProgress=[{participantId:1,progress:1}];t.consume(battle);assert.throws(()=>t.checkPolicy(7,policy));
});
test('bulk negotiation stays visible above attrition limit; STOP follows activity',()=>{
 const fs=require('fs'),vm=require('vm'),source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const nodes=new Map(),node=key=>{if(!nodes.has(key))nodes.set(key,{setAttribute(k,v){this[k]=v;}});return nodes.get(key);};
 const state={attack:false,negotiation:false,active:null,status:'off'},controller={state,engaged:false};
 const ctx={bulkAutomation:controller,bulkSettings:A.settings(),playerAttrition:10,actionVisible:()=>true,battleReady:true,autoSector:null,autoNegSector:null,root:{querySelector:node}};
 const code=source.slice(source.indexOf('    function paintBulkControls()'),source.indexOf('    function tickBulk()'));vm.runInNewContext(code+'paintBulkControls()',ctx);
 const neg=node('[data-bulk-mode="negotiation"]'),stop=node('[data-bulk-stop]');assert.equal(neg.hidden,false);assert.equal(neg.disabled,true);assert.match(node('[data-bulk-neg-reason]').textContent,/10.*0/);assert.equal(stop.hidden,true);
 ctx.playerAttrition=0;vm.runInNewContext('paintBulkControls()',ctx);assert.equal(neg.disabled,false);
 controller.engaged=true;state.negotiation=true;vm.runInNewContext('paintBulkControls()',ctx);assert.equal(stop.hidden,false);
 state.negotiation=false;state.active={kind:'negotiation'};vm.runInNewContext('paintBulkControls()',ctx);assert.equal(stop.hidden,false);
 state.active=null;controller.engaged=false;vm.runInNewContext('paintBulkControls()',ctx);assert.equal(stop.hidden,true);
});
