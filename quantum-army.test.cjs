const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Q=require('./quantum.js');
const unit=(extra={})=>({__class__:'ArmyUnit',unitTypeId:'guild_raids_bombarde',currentHitpoints:10,...extra});
const response=units=>({requestClass:'ArmyUnitManagementService',requestMethod:'getArmyInfo',responseData:{__class__:'ArmyInfo',units}});
test('quantum army counts full stacks, wounds and selected troops without duplicate snapshots',()=>{
 const t=Q.createTracker();
 const data=response([unit({__class__:'ArmyUnitStack',count:106,unitIds:[1,2,3]}),unit({currentHitpoints:3,is_attacking:true}),unit({is_attacking:true})]);
 t.consume(data);t.consume(data);
 const row=t.army.rows[0];assert.equal(row.total,108);assert.equal(row.healthy,107);assert.equal(row.wounded,1);assert.equal(row.selected,2);
 assert.deepEqual(row.hitpoints,[{hp:3,count:1},{hp:10,count:1}]);assert.equal(t.summary(),null);
 t.consume(response([unit({currentHitpoints:7})]));assert.equal(t.army.rows[0].total,1);
});
test('previews, main-city armies and battle participants never replace quantum inventory',()=>{
 const t=Q.createTracker();t.consume({requestClass:'BattlefieldService',requestMethod:'getArmyPreview',responseData:[{units:[unit()]}]});assert.equal(t.army,null);
 t.consume(response([unit()]));const snapshot=t.army;
 t.consume(response([unit({unitTypeId:'spearman'})]));assert.equal(t.army,snapshot);
 t.consume({requestClass:'BattlefieldService',responseData:{battleType:{type:'guild_raids'},state:{unitsOrder:[unit()]}}});assert.equal(t.army.stale,true);assert.equal(t.army.rows[0].total,1);
 t.consume(response([unit()]));assert.equal(t.army.stale,false);
 t.consume(response([]));assert.equal(t.army.stale,true);
 t.consume({__class__:'GuildRaidsRunningState',endsAt:100});t.consume({__class__:'GuildRaidsRunningState',endsAt:200});assert.equal(t.army,null);
});
test('army UI renders empty state and snapshot even without settlement data',()=>{
 const source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const code=source.slice(source.indexOf('      // Quantum army is available'),source.indexOf("      if(!summary){text($('quantum-summary')"));
 const el=()=>({style:{},children:[],append(...v){this.children.push(...v);},replaceChildren(){this.children=[];}});
 const box=el(),tracker=Q.createTracker();
 const context={$:()=>box,quantumTracker:tracker,document:{createElement:el},formatTime:()=> '12:00',text:(parent,value)=>{const node=el();node.textContent=value;parent.append(node);return node;}};
 vm.runInNewContext("{"+code+"}",context);assert.match(box.children[1].textContent,/Otwórz okno armii/);
 tracker.consume(response([unit({currentHitpoints:4,is_attacking:true})]));vm.runInNewContext("{"+code+"}",context);
 assert.ok(box.children.some(n=>n.textContent==='Łącznie: 1 · Wybrane do ataku: 1'));
 assert.ok(box.children.some(n=>n.textContent?.includes('4/10')));
});
