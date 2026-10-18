const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('open sectors render for attack and defense, with negotiation state declared',()=>{
 const source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const declaration=source.match(/let negPending=[^;]+;/)[0];
 const start=source.indexOf('    function paintOpenSectors()');
 const end=source.indexOf('    setInterval(()=>paint(),1000);',start);
 const element=()=>({style:{},children:[],setAttribute(){},replaceChildren(){this.children=[];},append(...items){this.children.push(...items);}});
 const list=element();
 const ctx={selectedSector:null,document:{createElement:element},$:()=>list,battle:{},FoeModel:{rows:()=>({rows:[true,false].map((isAttackBattleType,id)=>({id,sector:'test',until:0,isAttackBattleType,progress:0,maxProgress:132,gainAttritionChance:20}))})},battleReady:true,battlePending:null,battlePendingSector:null,battleLastSector:null,battleLastUntil:0,battleLastOK:false,battleWaveSector:null,autoSector:null,autoNegSector:null};
 vm.runInNewContext(declaration+source.slice(start,end)+'paintOpenSectors();',ctx);
 assert.equal(list.children.length,2);
 list.children[0].children[0].onclick();assert.equal(ctx.selectedSector,0);assert.equal(list.children[0].children[0].style.textDecoration,'underline');
 ctx.autoSector=0;vm.runInNewContext(source.slice(start,end)+'paintOpenSectors();',ctx);list.children[0].children[0].onclick();assert.equal(ctx.selectedSector,0);
 ctx.autoSector=null;vm.runInNewContext(source.slice(start,end)+'paintOpenSectors();',ctx);assert.equal(list.children[0].children[0].style.textDecoration,'underline');
 list.children[1].children[0].onclick();assert.equal(ctx.selectedSector,1);list.children[1].children[0].onclick();assert.equal(ctx.selectedSector,null);

 for(const row of list.children){
  assert.equal(row.children[3].textContent,'⚔️');assert.equal(row.children[3].disabled,false);
  assert.equal(row.children[5].textContent,'🤝');assert.equal(row.children[5].disabled,false);
 }
});
