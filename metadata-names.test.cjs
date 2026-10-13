const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/capture.js','utf8');
function setup(){
 const messages=[],ctx={URL,LIMIT:24000000,location:{href:'https://pl.test/game',origin:'https://pl.test'},window:{postMessage:m=>messages.push(m)}};
 vm.runInNewContext(source.slice(source.indexOf('  function isBuildingMetadata('),source.indexOf('  window.fetch = function')),ctx);
 return {ctx,messages};
}
test('metadata keeps full id and Polish name',()=>{
 const {ctx,messages}=setup();
 ctx.emitBuildingMetadata('https://foepl.innogamescdn.com/start/metadata?id=building_entity_W_MultiAge_FALL26A7-hash',JSON.stringify({id:'W_MultiAge_FALL26A7',name:'Przystanek Momiji — poz. 7'}));
 assert.equal(messages[0].names[0].id,'W_MultiAge_FALL26A7');assert.equal(messages[0].names[0].name,'Przystanek Momiji — poz. 7');
});
test('lookup entries and invalid responses never become names',()=>{
 const {ctx,messages}=setup(),url='https://foepl.innogamescdn.com/start/metadata?id=building_entity_lookup-hash';
 ctx.emitBuildingMetadata(url,[{identifier:'building_entity_W_A',url:'https://example.test'}]);
 ctx.emitBuildingMetadata(url,'not json');
 assert.equal(messages.length,0);
 assert.equal(ctx.isBuildingMetadata('https://innogamescdn.com.evil.test/start/metadata?id=building_entity_X'),false);
});
