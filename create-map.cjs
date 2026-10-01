// One-time reconstruction of the concentric hex topology shown in the supplied map.
// Runtime reads sectors.json directly; edit that file to correct individual borders.
const fs = require('node:fs');
const cells=[{id:0,name:'X1X',q:0,r:0}];
const steps=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
for(let radius=1;radius<=4;radius++){
 let q=0,r=-radius;
 for(let side=0;side<6;side++) for(let k=0;k<radius;k++){
  cells.push({id:cells.length,name:`${'ABCDEF'[side]}${radius+1}${'ABCD'[k]}`,q,r});
  q+=steps[side][0]; r+=steps[side][1];
 }
}
const sectors={};
for(const cell of cells){
 sectors[cell.name]={id:cell.id,neighbors:cells.filter(other=>steps.some(([q,r])=>cell.q+q===other.q&&cell.r+r===other.r)).map(other=>other.name)};
}
fs.writeFileSync(__dirname+'/sectors.json',JSON.stringify({mapId:'waterfall_archipelago',schemaVersion:1,source:'Rekonstrukcja topologii z pełnego zrzutu użytkownika z 16.09.2026; identyfikatory z response. Sąsiedztwo oznacza wspólną krawędź, nie sam narożnik.',sectors},null,2)+'\n');
