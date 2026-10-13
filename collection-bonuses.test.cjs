const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('./model.js');
const response=bonuses=>({requestClass:'BonusService',requestMethod:'getLimitedBonuses',responseData:bonuses});
test('limited bonuses use remaining server amounts, update and clear on exhaustion',()=>{
 const active={type:'double_collection',amount:4,value:72,factor:2,isActive:true};
 assert.equal(model.updateCollectionBonuses(response([active,{type:'supplies_boost',amount:38,value:135,isActive:true}])),true);
 assert.deepEqual(model.getCollectionBonuses().map(b=>[b.amount,b.value]),[[4,72],[38,135]]);
 model.updateCollectionBonuses({requestClass:'StartupService',requestMethod:'getData',responseData:{bonus:{...active,amount:15}}});
 assert.equal(model.getCollectionBonuses()[0].amount,4);
 model.updateCollectionBonuses(response([{...active,amount:3}]));assert.equal(model.getCollectionBonuses()[0].amount,3);
 assert.equal(model.updateCollectionBonuses(response([{...active,amount:3}])),false);
 model.updateCollectionBonuses(response([{...active,amount:0}]));assert.deepEqual(model.getCollectionBonuses(),[]);
 model.updateCollectionBonuses(response([{...active,isActive:false}]));assert.deepEqual(model.getCollectionBonuses(),[]);
});
