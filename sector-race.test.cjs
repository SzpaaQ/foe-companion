const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('./model.js');
test('race requires another guild besides owner and our guild, schedule capped at 30 min',()=>{
 model.setTopology({mapId:'test-race',sectors:{A:{id:1,neighbors:['B','C']},B:{id:2,neighbors:['A']},C:{id:3,neighbors:['A']}}});
 const battle={currentParticipantId:1,battlegroundParticipants:[1,2,3].map(participantId=>({participantId})),map:{id:'test-race',provinces:[{id:1,ownerId:2},{id:2,ownerId:1},{id:3,ownerId:2}]}};
 assert.equal(model.rows(battle,false).rows.find(r=>r.id===1).race,false);
 battle.map.provinces[2].ownerId=3;
 const row=model.rows(battle,false).rows.find(r=>r.id===1);assert.equal(row.race,true);
 assert.match(model.line({...row,until:Date.now()/1000+1700}),/🏁/);
 assert.doesNotMatch(model.line({...row,until:Date.now()/1000+1900}),/🏁/);
 assert.doesNotMatch(model.line({...row,until:0}),/🏁/);
});
