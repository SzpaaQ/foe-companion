const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('open sectors render for attack and defense, with negotiation state declared',async()=>{
 const source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const declaration=source.match(/let negPending=[^;]+;/)[0];
 const start=source.indexOf('    function paintOpenSectors()');
 const end=source.indexOf('    setInterval(()=>paint(),1000);',start);
 const element=()=>({style:{},children:[],setAttribute(){},replaceChildren(){this.children=[];},append(...items){this.children.push(...items);}});
 const list=element();
 let copied='';const ctx={root:{querySelector:()=>null},navigator:{clipboard:{writeText:async text=>{copied=text;}}},actionVisible:()=>true,selectedSector:null,document:{createElement:element},$:()=>list,getGuard:()=>({}),battle:{map:{id:1}},FoeModel:{...require('./model.js'),rows:()=>({rows:[true,false].map((isAttackBattleType,id)=>({id,sector:'test',color:'🔴',until:0,isAttackBattleType,progress:0,maxProgress:132,gainAttritionChance:20}))})},battleReady:true,battlePending:null,battlePendingSector:null,battleLastSector:null,battleLastUntil:0,battleLastOK:false,battleWaveSector:null,autoSector:null,autoNegSector:null};
 vm.runInNewContext(declaration+source.slice(start,end)+'paintOpenSectors();',ctx);
 assert.equal(list.children.length,2);
 let stopped=false;await list.children[0].children[0].children[0].onclick({stopPropagation(){stopped=true;}});assert.equal(stopped,true);assert.equal(copied,'🟥 🔴 test | 0 | 20%');assert.doesNotMatch(copied,/📋|▶/);
 ctx.actionVisible=()=>false;vm.runInNewContext(source.slice(start,end)+'paintOpenSectors();',ctx);for(const row of list.children)for(const index of [3,4,5,6])assert.equal(row.children[index].style.display,'none');
 ctx.actionVisible=kind=>kind==='attack';vm.runInNewContext(source.slice(start,end)+'paintOpenSectors();',ctx);for(const row of list.children){assert.equal(row.children[3].style.display,'');assert.equal(row.children[5].style.display,'none');}
 ctx.actionVisible=()=>true;vm.runInNewContext(source.slice(start,end)+'paintOpenSectors();',ctx);
 list.children[0].children[0].onclick();assert.equal(ctx.selectedSector,0);assert.equal(list.children[0].children[0].style.textDecoration,'none');
 ctx.autoSector=0;vm.runInNewContext(source.slice(start,end)+'paintOpenSectors();',ctx);list.children[0].children[0].onclick();assert.equal(ctx.selectedSector,0);
 ctx.autoSector=null;vm.runInNewContext(source.slice(start,end)+'paintOpenSectors();',ctx);assert.equal(list.children[0].children[0].style.textDecoration,'none');
 list.children[1].children[0].onclick();assert.equal(ctx.selectedSector,1);list.children[1].children[0].onclick();assert.equal(ctx.selectedSector,null);

 for(const row of list.children){
  assert.equal(row.children[3].textContent,'⚔️');assert.equal(row.children[3].disabled,false);
  assert.equal(row.children[5].textContent,'🤝');assert.equal(row.children[5].disabled,false);
 }
});
