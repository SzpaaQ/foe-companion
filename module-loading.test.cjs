const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(__dirname+'/'+name,'utf8');
test('pearl modules use separate paths for browser execution worlds',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 const main=manifest.content_scripts.find(s=>s.world==='MAIN').js;
 const isolated=manifest.content_scripts.find(s=>!s.world||s.world==='ISOLATED').js;
 assert.deepEqual(main.filter(file=>isolated.includes(file)),[]);
 assert.equal(read('pearls-main.js'),read('pearls.js'),'Keep the MAIN mirror in sync with pearls.js');
 const game=vm.createContext({});
 vm.runInContext(read(main.find(f=>f.startsWith('pearls'))),game);
 assert.equal(typeof game.FoePearls.liveLocks,'function');
 const panel=vm.createContext({});
 for(const file of isolated.slice(0,isolated.indexOf('model.js')+1))vm.runInContext(read(file),panel);
 assert.equal(typeof panel.FoePearls.liveLocks,'function');
 assert.equal(typeof panel.FoeModel.findConstruction,'function');
});
