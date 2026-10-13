const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('./model.js');
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
