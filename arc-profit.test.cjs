const {test}=require('node:test'),assert=require('node:assert/strict');
const {arcProfit,pearlAmounts}=require('./pearls.js');
test('Arc profit uses the separate percentage and subtracts the actual displayed contribution',()=>{
 const construction={rankings:[{rank:1,reward:{strategy_point_amount:500}}]};
 const amount=pearlAmounts(construction,'1.9').rows[0].amount;
 assert.equal(amount,950);
 assert.deepEqual(arcProfit(500,amount,'92,7'),{reward:964,profit:14,multiplier:1.927});
 assert.equal(arcProfit(500,1000,'92.7').profit,-36);
});
test('rounding, zero rewards and invalid bonus values',()=>{
 assert.equal(arcProfit(100,190,'90.5').reward,191);
 assert.equal(arcProfit(10,19,'92.7').profit,0);
 assert.equal(arcProfit(0,1,'92.7').profit,-1);
 for(const value of ['', 'abc','-1','1001','92.12345'])assert.equal(arcProfit(100,190,value),null);
 assert.equal(arcProfit(null,1,'92.7'),null);
});
