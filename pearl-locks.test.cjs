const {test}=require('node:test'),assert=require('node:assert/strict');
const {liveLocks}=require('./pearls.js');
const rows=[3449,1729,580,143,29].map((amount,i)=>({rank:i+1,amount}));
const construction={target:{playerId:1},rankings:[{player:{player_id:1},forge_points:2895},...[3630,1760,580,144,29].map((forge_points,i)=>({rank:i+1,player:{player_id:i+2},forge_points}))]};
test('actual overpayments yield independent top ups and ties secure places',()=>{const result=liveLocks(9232,rows,construction);assert.deepEqual(result.map(r=>r.additional),[0,0,0,50,165]);assert.equal(result[4].cumulative,3060);});
test('owner payment refresh reduces all outstanding locks',()=>{const next=structuredClone(construction);next.rankings[0].forge_points+=50;assert.deepEqual(liveLocks(9232,rows,next).map(r=>r.additional),[0,0,0,0,115]);});
test('owner absent from loaded ranking means zero and enables locks',()=>{
 const current={target:{playerId:1},rankings:[{rank:1,player:{player_id:2},forge_points:871}]};
 const result=liveLocks(1741,[{rank:1,amount:871},{rank:2,amount:200}],current);
 assert.equal(result[0].additional,0);
 assert.equal(result[1].additional,470);
 assert.equal(result[1].cumulative,470);
});
test('missing ranking remains unknown',()=>assert.equal(liveLocks(9232,rows,{target:{playerId:1}}),null));
test('underpayment is displaced by a full 1.9 investment and leaves later slots',()=>{
 const plan=[276,143,48,10,1].map((amount,i)=>({rank:i+1,amount}));
 const current={target:{playerId:1},rankings:[{rank:0,player:{player_id:1},forge_points:568},...[290,150,8,1].map((forge_points,i)=>({rank:i+1,player:{player_id:i+2},forge_points}))]};
 const result=liveLocks(1167,plan,current);
 assert.equal(result[2].additional,62);
 assert.equal(result[2].cumulative,630);
 assert.equal(1167-1017-62-48,40);
 assert.equal(result[3].additional,90);
 current.rankings[0].forge_points+=62;
 assert.equal(liveLocks(1167,plan,current)[2].additional,0);
});
