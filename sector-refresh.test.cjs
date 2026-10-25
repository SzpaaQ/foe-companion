const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),A=require('./sector-automation.js'),L=require('./battleground-live.js');
M.setTopology({mapId:'refresh-test',sectors:{Home:{id:1,neighbors:['Target']},Target:{id:2,neighbors:['Home']}}});
function initial(){return {currentParticipantId:1,endsAt:10000,battlegroundParticipants:[{participantId:1,colour:'white'},{participantId:2,colour:'red'},{participantId:3,colour:'blue'}],map:{id:'refresh-test',provinces:[{id:1,ownerId:1},{id:2,ownerId:2,lockedUntil:500,gainAttritionChance:20,isAttackBattleType:true,conquestProgress:[{participantId:1,progress:40,maxProgress:132}]}]}};}
const update=p=>[{requestClass:'GuildBattlegroundService',requestMethod:'getProvinces',responseData:[{__class__:'GuildBattlegroundProvince',id:2,...p}]}];
test('HTTP opening clears omitted lock and previous progress; other guild supplies the limit and automation starts',()=>{
 let battle=initial();const live=L.createTracker({now:()=>100000});live.setConnected(true);live.consume(battle);
 const data=update({ownerId:2,gainAttritionChance:20,isAttackBattleType:true,conquestProgress:[{participantId:3,progress:80,maxProgress:132}]});battle=M.updateBattle(battle,data).battle;live.consume(data);
 const row=M.rows(battle,true).rows[0];assert.equal(row.until,0);assert.equal(row.progress,0);assert.equal(row.enemyProgress,80);assert.equal(row.maxProgress,132);assert.equal(live.snapshot(2).value.lockedUntil,row.until);
 const c=A.create({now:()=>100000}),sent=[];c.enable('negotiation',true);
 const enrich=r=>({...r,mapId:battle.map.id,endsAt:battle.endsAt});c.tick({scope:'test',allRows:M.rows(battle,false).rows.map(enrich),rows:M.rows(battle,true).rows.map(enrich),config:A.settings(),attrition:0,ready:true,busy:false,reserve:0,delay:0,send:(kind,id)=>{sent.push([kind,id]);return true;}});
 assert.deepEqual(sent,[['negotiation',2]]);c.stop();c.result({sectorClosed:true,negotiationEnded:true});assert.equal(c.state.negotiation,false);
});
test('captures by every guild refresh owner, block and frontier; our capture removes target',()=>{
 let battle=initial();battle=M.updateBattle(battle,update({ownerId:3,lockedUntil:900})).battle;let row=M.rows(battle,true).rows[0];assert.equal(row.ownerId,3);assert.equal(row.until,900);assert.equal(row.progress,0);assert.equal(row.enemyProgress,0);
 battle=M.updateBattle(battle,update({ownerId:1})).battle;assert.equal(M.rows(battle,true).rows.length,0);assert.equal(M.rows(battle,false).rows.find(r=>r.id===2).color,'⚪');
});
