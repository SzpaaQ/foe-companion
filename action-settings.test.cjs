const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/panel.js','utf8');
function setup(storage=new Map()){
 const nodes=new Map(),calls=[];
 const ctx={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},requestStopAuto:()=>calls.push('stopAttack'),stopAutoNeg:()=>calls.push('stopNegotiation'),paintOpenSectors:()=>calls.push('sectors'),paintCity:()=>calls.push('city')};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('    function actionVisible('),source.indexOf('    let selectedSector=')),ctx);
 return {ctx,nodes,calls,storage};
}
test('action buttons default off; independent preferences persist and disabling stops automation',()=>{
 const h=setup();for(const node of h.nodes.values())assert.equal(node.checked,false);
 for(const [kind,id] of [['attack','show-attack-buttons'],['negotiation','show-negotiation-buttons'],['collection','show-collection-buttons']]){
  h.nodes.get(id).checked=true;h.nodes.get(id).onchange();assert.equal(h.ctx.actionVisible(kind),true);
 }
 const next=setup(h.storage);for(const node of next.nodes.values())assert.equal(node.checked,true);
 next.nodes.get('show-attack-buttons').checked=false;next.nodes.get('show-attack-buttons').onchange();assert.ok(next.calls.includes('stopAttack'));assert.equal(next.ctx.actionVisible('negotiation'),true);
 next.nodes.get('show-negotiation-buttons').checked=false;next.nodes.get('show-negotiation-buttons').onchange();assert.ok(next.calls.includes('stopNegotiation'));
});
test('disabled collection exits before selecting buildings or posting requests',()=>{
 const h=setup(),start=source.indexOf('    function startCollection(buildings){'),end=source.indexOf('    collectAll.onclick=',start);
 vm.runInContext(source.slice(start,end),h.ctx);
 h.ctx.startCollection({filter(){throw Error('Collection should not start');}});
});
test('failed settings persistence restores checkbox and leaves actions disabled',()=>{
 const h=setup();h.ctx.localStorage.setItem=()=>{throw Error('quota');};const box=h.nodes.get('show-collection-buttons');box.checked=true;box.onchange();assert.equal(box.checked,false);assert.equal(h.ctx.actionVisible('collection'),false);
});
