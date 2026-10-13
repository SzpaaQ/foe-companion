const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('./model.js');
test('metadata classifies Solara and both mills even when startup omits their FP products',()=>{
 const types=require('./building-fp-types.json');
 for(const [id,fp] of Object.entries(types))model.seedProductionType(id,fp);
 model.parseCity([[3160,'W_MultiAge_GR25C10a'],[3177,'W_MultiAge_FELL24A12'],[3988,'W_MultiAge_FELL24A12']].map(([id,cityentity_id])=>({id,cityentity_id,player_id:1,type:'generic_building',state:{__class__:'ProducingState',productionOption:{products:[{playerResources:{resources:{supplies:63810}}}]}}})),1);
 const rows=model.cityRows();assert.equal(rows.length,3);assert.ok(rows.every(b=>b.producesFP));assert.ok(rows.every(b=>b.productionFP===0));
});
test('distinct copies, idle buildings and new own buildings remain visible',()=>{
 const entity=(id,state,extra={})=>({id,player_id:1,cityentity_id:'W_Test',type:'generic_building',state,__class__:'CityMapEntity',...extra});
 model.parseCity([entity(1,{__class__:'IdleState'}),entity(2,{__class__:'ProducingState',productionOption:{products:[{onlyWhenMotivated:true,playerResources:{resources:{strategy_points:10}}}]}})],1);
 assert.deepEqual(model.cityRows().map(b=>b.id).sort(),[1,2]);
 const row=model.cityRows().find(b=>b.id===2);assert.equal(row.productionFP,0);assert.equal(row.producesFP,true);
 model.updateCity(entity(3,{__class__:'IdleState'}));
 model.updateCity(entity(4,{__class__:'IdleState'},{player_id:2}));
 assert.equal(model.cityRows().length,3);
 model.updateCity(entity(2,{__class__:'IdleState'}));
 assert.equal(model.cityRows().find(b=>b.id===2).producesFP,true);
 assert.equal(model.cityRows().find(b=>b.id===2).ready,false);
});
