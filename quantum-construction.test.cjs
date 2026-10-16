const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Q=require('./quantum.js');
const definitions=require('./quantum-definitions.json');
function fixture(onlyBuilds=false){
 const tracker=Q.createTracker();tracker.consume(definitions);
 const names=onlyBuilds?['Gabinet lekarski','Dom wielopiętrowy']:['Kościół','Gabinet lekarski','Dom wielopiętrowy','Dom wielopiętrowy'];
 tracker.consume({gridId:'guild_raids',entities:names.map((name,id)=>({id,cityentity_id:definitions.find(d=>d.name===name).id,connected:1,state:!onlyBuilds&&id===0?{__class__:'IdleState'}:!onlyBuilds&&id===2?{__class__:'ProducingState',next_state_transition_at:2000}:{__class__:'ConstructionState',next_state_transition_at:3000}}))});
 return tracker.summary(1000);
}
function render(summary){
 const element=()=>({style:{},children:[],append(...items){this.children.push(...items);}});
 const root=element(),source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const text=(parent,value)=>{const n=element();n.textContent=value;parent.append(n);return n;};
 vm.runInNewContext(source.slice(source.indexOf('      const resourceValues='),source.indexOf("      addSection('Zbiory',true);"))+source.slice(source.indexOf('      const buildProduction='),source.indexOf('      const emojiTitles=')),{summary,FoeQuantum:Q,document:{createElement:element},$:()=>root,text,num:n=>n.toLocaleString('pl-PL')});
 return root.children.filter(n=>n.open).map(n=>n.children[1]);
}
test('construction keeps effects and production separate from current totals',()=>{
 const s=fixture();
 assert.equal(s.builds.length,2);assert.equal(s.extras.length,1);
 assert.equal(s.groups.flatMap(g=>g.items).length,1);
 const house=s.builds.find(b=>b.hasProduction);
 assert.ok(house.production.guild_raids_money>0);
 assert.equal(s.totals.guild_raids_money,house.production.guild_raids_money);
 const doctor=s.builds.find(b=>!b.hasProduction);
 assert.equal(doctor.effects.guild_raids_action_points_collection,260);
 assert.match(doctor.benefits,/260/);
 const tables=render(s);assert.equal(tables.length,2);
 for(const table of tables){
  const cells=table.children;
  const current=cells.findIndex(c=>c.textContent==='Suma');
  const future=cells.findIndex(c=>c.textContent==='🚧 Suma z budową');
  assert.ok(future>current);
  assert.match(cells[future].style.cssText,/opacity:0.5/);
  assert.ok(cells.some(c=>c.children.some(t=>typeof t==='string'&&t.includes('🚧'))&&c.style.cssText.includes('opacity:0.5')));
 }
 const extra=tables[1].children;
 const i=extra.findIndex(c=>c.textContent==='Suma'),j=extra.findIndex(c=>c.textContent==='🚧 Suma z budową');
 assert.equal(extra[i+2].textContent,'50');assert.equal(extra[j+2].textContent,'310');
});
test('overview tables also appear when only buildings under construction exist',()=>{
 const s=fixture(true);assert.equal(s.groups.length,0);assert.equal(s.extras.length,0);
 const tables=render(s);assert.equal(tables.length,2);
 for(const table of tables){const i=table.children.findIndex(c=>c.textContent==='Suma');assert.equal(table.children[i+1].textContent,'—');}
});
