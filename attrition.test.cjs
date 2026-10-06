const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/panel.js','utf8');
const start=source.indexOf('  function readPlayerAttrition(');
const end=source.indexOf('\n  let construction',start);
const context={};vm.runInNewContext(source.slice(start,end),context);
const read=context.readPlayerAttrition;
const attrition=level=>({__class__:'GuildBattlegroundAttrition',...(level===undefined?{}:{level})});
test('own attrition from map then player update, including reset to zero',()=>{
 assert.equal(read([{requestClass:'GuildBattlegroundService',requestMethod:'getBattleground',responseData:{currentPlayerParticipant:{attrition:attrition(40)}}}]),40);
 assert.equal(read([{requestClass:'GuildBattlegroundService',requestMethod:'getPlayerParticipant',responseData:{attrition:attrition(41)}}]),41);
 assert.equal(read([{requestClass:'GuildBattlegroundService',requestMethod:'getPlayerParticipant',responseData:{attrition:attrition()}}]),0);
});
test('unrelated data and sector probability never replace own attrition',()=>{
 assert.equal(read([{requestClass:'GuildBattlegroundService',requestMethod:'getProvince',responseData:{gainAttritionChance:40}}]),undefined);
 assert.equal(read([{requestClass:'OtherService',requestMethod:'getPlayerParticipant',responseData:{attrition:attrition(99)}}]),undefined);
 assert.equal(read([{requestClass:'GuildBattlegroundService',requestMethod:'getPlayerParticipant',responseData:{attrition:attrition(-1)}}]),undefined);
});
