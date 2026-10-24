const {test}=require('node:test'),assert=require('node:assert/strict');
const Live=require('./battleground-live.js');
const province=(progress=73,id=26)=>({__class__:'GuildBattlegroundProvince',id,ownerId:2,conquestProgress:[{participantId:1,progress,maxProgress:120}]});
const response=(method,data)=>[{requestClass:'GuildBattlegroundService',requestMethod:method,responseData:data}];
function setup(){let clock=1000;const timers=new Map();let id=0;const tracker=Live.createTracker({now:()=>clock,schedule:fn=>{timers.set(++id,fn);return id;},cancel:id=>timers.delete(id)});tracker.consume(response('getBattleground',{currentParticipantId:1,map:{provinces:[province()]}}));tracker.setConnected(true);return {tracker,timers,advance(ms){clock+=ms;}};}
test('socket progress replaces the map value and controls battle/negotiation reserve without polling',()=>{
 const {tracker}=setup();tracker.check(26,46,1);assert.throws(()=>tracker.check(26,46,2),/rezerwę/);
 tracker.consume(response('getProvinces',[province(74)]),'socket');assert.equal(tracker.snapshot(26).progress,74);assert.throws(()=>tracker.check(26,46,1),/rezerwę/);
});
test('wait accepts a matching socket update received before or after the action response',async()=>{
 const {tracker,timers}=setup(),before=tracker.snapshot(26);
 tracker.consume(response('getProvinces',[province(74)]),'socket');assert.equal(await tracker.waitForProgress(26,before),true);assert.equal(timers.size,0);
 const next=tracker.snapshot(26),waiting=tracker.waitForProgress(26,next,2);
 tracker.consume(response('getProvinces',[province(75)]),'socket');assert.equal(timers.size,1);
 tracker.consume(response('getProvinces',[province(76)]),'socket');assert.equal(await waiting,true);assert.equal(timers.size,0);
});
test('unrelated sectors and HTTP responses do not confirm the socket result; timeout stops',async()=>{
 const {tracker,timers}=setup(),waiting=tracker.waitForProgress(26,tracker.snapshot(26));
 tracker.consume(response('getProvinces',[province(100,27)]),'socket');tracker.consume(response('getProvince',province(74)));
 assert.equal(timers.size,1);[...timers.values()][0]();assert.equal(await waiting,false);
});
test('disconnect, missed updates, missing limits and a conquered sector block automation',async()=>{
 const {tracker,advance}=setup(),waiting=tracker.waitForProgress(26,tracker.snapshot(26));tracker.setConnected(false);assert.equal(await waiting,false);
 assert.throws(()=>tracker.check(26,3),/socketu/);tracker.setConnected(true);advance(31000);assert.throws(()=>tracker.check(26,3),/przerwaniu/);
 tracker.consume(response('getProvinces',[{...province(),conquestProgress:[{participantId:1,progress:1}]}]),'socket');assert.throws(()=>tracker.check(26,3),/limitu/);
 tracker.consume(response('getProvinces',[{...province(),ownerId:1}]),'socket');assert.throws(()=>tracker.check(26,3),/otwarty/);
});
test('initial HTTP map seeds progress before the first socket message, including nested state responses',()=>{
 const tracker=Live.createTracker();
 tracker.consume([{requestClass:'GuildBattlegroundStateService',requestMethod:'getState',responseData:{state:{currentParticipantId:1,battlegroundParticipants:[],map:{provinces:[province(80)]}}}}]);
 tracker.setConnected(true);assert.equal(tracker.check(26,3).progress,80);assert.equal(tracker.snapshot(26).maxProgress,120);
 tracker.consume(response('getProvinces',[province(81)]),'socket');assert.equal(tracker.check(26,3).progress,81);
});
test('quiet sectors keep their initial HTTP progress while the socket stays connected',()=>{
 const {tracker,advance}=setup();advance(300000);assert.equal(tracker.check(26,3).progress,73);
});
test('reopening the map after reconnect replaces initial values and restores the reserve check',()=>{
 const {tracker}=setup();tracker.setConnected(false);tracker.setConnected(true);
 tracker.consume(response('getBattleground',{currentParticipantId:1,map:{provinces:[province(90)]}}));
 assert.equal(tracker.check(26,3).progress,90);
});
test('observer uses only the game-created socket, never sends, ignores auth and chat, handles reconnect',()=>{
 let created=0,sent=0;const received=[],states=[];
 class Socket{constructor(url){created++;this.url=url;this.handlers={};}addEventListener(t,fn){(this.handlers[t]??=[]).push(fn);}fire(t,data){for(const fn of this.handlers[t]||[])fn({data});}send(){sent++;}}
 const win={WebSocket:Socket,location:{host:'pl1.forgeofempires.com',href:'https://pl1.forgeofempires.com/game/index'}};
 Live.observeSockets(win,d=>received.push(d),s=>states.push(s));assert.equal(created,0);assert.equal(win.WebSocket.prototype,Socket.prototype);
 const socket=new win.WebSocket('wss://pl1.forgeofempires.com/socket/');socket.fire('open');socket.fire('message','pong');socket.fire('message',JSON.stringify([{requestClass:'ChatService',requestMethod:'messages',responseData:[]}]));
 socket.fire('message',JSON.stringify(response('getProvinces',[province(74)])));assert.equal(received.length,1);assert.equal(received[0][0].responseData[0].lockedUntil,0);assert.equal(sent,0);
 const other=new win.WebSocket('wss://example.com/socket/');other.fire('message',JSON.stringify(response('getProvinces',[province(99)])));assert.equal(received.length,1);
 socket.fire('close');const next=new win.WebSocket('wss://pl1.forgeofempires.com/socket/');next.fire('open');assert.deepEqual(states,[false,true,false,true]);assert.equal(sent,0);
});

test('zero progress can bootstrap from HTTP, but missing map or a known reserve limit still blocks',async()=>{
 const {tracker}=setup();
 for(const conquestProgress of [[],[{participantId:1}],[{participantId:1,progress:0}]]){
  tracker.consume(response('getProvince',{...province(),conquestProgress}));
  assert.equal(tracker.check(26,3,1).progress,0);assert.equal(tracker.check(26,3,2).maxProgress,undefined);
 }
 tracker.consume(response('getProvince',{...province(),conquestProgress:[{participantId:2,progress:10,maxProgress:120}]}));
 assert.equal(tracker.check(26,3).progress,0);assert.equal(tracker.check(26,3).maxProgress,120);assert.throws(()=>tracker.check(26,120),/rezerwę/);
 assert.throws(()=>tracker.check(999,3),/Brak danych/);
 const before=tracker.snapshot(26),waiting=tracker.waitForProgress(26,before);
 tracker.consume(response('getProvinces',[province(1)]),'socket');assert.equal(await waiting,true);
 assert.equal(tracker.check(26,3).maxProgress,120);
 tracker.consume(response('getProvince',province(0)));assert.throws(()=>tracker.check(26,120),/rezerwę/);
});

test('shared reader routes future service events continuously and isolates/unsubscribes consumers',()=>{
 let sent=0,created=0;
 class Socket{constructor(){created++;this.handlers={};}addEventListener(t,f){(this.handlers[t]??=[]).push(f);}fire(t,data){for(const f of this.handlers[t]||[])f({data});}send(){sent++;}}
 const win={WebSocket:Socket,location:{host:'pl1.forgeofempires.com'}};
 const reader=Live.createSocketReader(win),wrapper=win.WebSocket,received=[];
 assert.equal(Live.createSocketReader(win),reader);assert.equal(win.WebSocket,wrapper);assert.equal(created,0);
 reader.subscribe(()=>{throw Error('broken consumer');});
 const off=reader.subscribe(batch=>received.push(batch));
 const socket=new win.WebSocket('wss://pl1.forgeofempires.com/socket/');socket.fire('open');assert.equal(reader.connected,true);
 socket.fire('message','pong');socket.fire('message','{}');
 const update=JSON.stringify([{requestClass:'GuildBattlegroundSignalsService',requestMethod:'updateSignal',responseData:{id:1}}]);
 socket.fire('message',update);socket.fire('message',update);assert.equal(received.length,2);
 off();socket.fire('message',update);assert.equal(received.length,2);
 socket.fire('close');assert.equal(reader.connected,false);assert.equal(sent,0);
});
