const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('popup is attached before binding copy; clipboard gets exactly visible rows',async()=>{
 const source=fs.readFileSync(__dirname+'/panel.js','utf8');
 const nodes=new Map();let copied;
 const root={append(node){for(const match of node.innerHTML.matchAll(/id="([^"]+)"/g))nodes.set(match[1],{textContent:'',dataset:{}});}};
 const context={root,$:id=>nodes.get(id)||null,document:{createElement:()=>({})},navigator:{clipboard:{writeText:async text=>copied=text}},setTimeout:()=>{}};
 vm.runInNewContext(source.slice(source.indexOf('    const sectorPopup='),source.indexOf('    const negoSection=')),context);
 const text='00:04:18 🟥 🔴 F5C\n00:05:00 🟦 🟣 A3B';
 nodes.get('sector-popup-list').textContent=text;
 await nodes.get('sector-popup-copy').onclick();assert.equal(copied,text);
});
