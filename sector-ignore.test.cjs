const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),L=require('./battleground-live.js'),A=require('./sector-automation.js');
M.setTopology({mapId:'ignore-test',sectors:{Home:{id:1,neighbors:['Target']},Target:{id:2,neighbors:['Home']}}});
const signal={signal:'ignore',provinceId:2};
const participant=(id,extra={})=>({__class__:'GuildBattlegroundParticipant',participantId:id,...extra});
function setup(){
 let battle={currentParticipantId:1,endsAt:10000,currentPlayerParticipant:{attrition:{__class__:'GuildBattlegroundAttrition',level:0}},battlegroundParticipants:[participant(1,{signals:[signal]}),participant(2)],map:{id:'ignore-test',provinces:[{id:1,ownerId:1},{id:2,ownerId:2,isAttackBattleType:true,gainAttritionChance:20,conquestProgress:[{participantId:1,progress:0,maxProgress:132}]}]}};
 const live=L.createTracker();live.setConnected(true);live.consume(battle);
 return {live,get battle(){return battle;},update(data){battle=M.updateBattle(battle,data).battle;live.consume(data);},row(){return M.rows(battle,true).rows[0];}};
}
for(const kind of ['attack','negotiation'])test(kind+' resumes after confirmed removal of last signal, without toggling mode',()=>{
 const h=setup(),c=A.create(),sent=[];
 const policy={kind,mapId:'ignore-test',endsAt:10000,progress:50,reserve:0,attackChance:20,maxAttrition:0,attack:true,defense:false};
 const tick=()=>c.tick({scope:'world-player-season',allRows:M.rows(h.battle,false).rows.map(r=>({...r,mapId:'ignore-test',endsAt:10000})),rows:[{...h.row(),mapId:'ignore-test',endsAt:10000}],config:A.settings(),attrition:0,ready:true,busy:false,reserve:0,delay:0,send:(k,id)=>{sent.push([k,id]);return true;}});
 c.enable(kind,true);tick();assert.equal(sent.length,0);assert.throws(()=>h.live.checkPolicy(2,policy),/ignorowany/);
 h.update([{requestClass:'GuildBattlegroundService',requestMethod:'getParticipants',responseData:[participant(1)]}]);
 assert.equal(h.row().ignored,false);h.live.checkPolicy(2,policy);tick();assert.deepEqual(sent,[[kind,2]]);
 c.result({ok:true,won:true,refreshed:true});h.update(participant(1,{signals:[signal]}));tick();assert.equal(sent.length,1);assert.throws(()=>h.live.checkPolicy(2,policy),/ignorowany/);
 c.stop();h.update(participant(1));tick();assert.equal(sent.length,1);
});
test('other guild, partial participant and province progress cannot erase our ignore signal',()=>{
 const h=setup();
 for(const data of [participant(2),{participantId:1,victoryPoints:50},{__class__:'GuildBattlegroundPlayerParticipant',participantId:1},{__class__:'GuildBattlegroundProvince',id:2,ownerId:2,conquestProgress:[{participantId:2,progress:50,maxProgress:132}]}]){h.update(data);assert.equal(h.row().ignored,true);}
 h.update([participant(1),participant(1,{signals:[signal]})]);assert.equal(h.row().ignored,true);
 h.update([participant(1,{signals:[signal]}),participant(1)]);assert.equal(h.row().ignored,false);
});
test('socket forwards last-signal removal even when signals is omitted',()=>{
 class Socket{constructor(){this.handlers={};}addEventListener(k,f){this.handlers[k]=f;}fire(data){this.handlers.message({data:JSON.stringify(data)});}}
 const win={WebSocket:Socket,location:{href:'https://game.test/',host:'game.test'}},received=[];L.observeSockets(win,data=>received.push(data),()=>{});const socket=new win.WebSocket('wss://game.test/socket/');
 socket.fire([{requestClass:'GuildBattlegroundService',requestMethod:'getParticipants',responseData:[participant(1)]}]);assert.equal(received.length,1);const h=setup();h.update(received[0]);assert.equal(h.row().ignored,false);
});
