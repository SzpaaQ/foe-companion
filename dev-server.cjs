const http=require('node:http'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const files=['manifest.json','request-signature.js','battle-army.js','capture.js','pearls.js','model.js','quantum.js','notes.js','quantum-definitions.json','building-names.json','panel.js','dev-client.js','background.js','sectors.json','sectors-volcano.json'];
function revision(){const hash=crypto.createHash('sha256');for(const name of files)hash.update(name).update(fs.readFileSync(path.join(__dirname,name)));return hash.digest('hex');}
let stable=revision(),candidate=stable,since=0;
const timer=setInterval(()=>{
 try{const next=revision();if(next!==candidate){candidate=next;since=Date.now();}else if(candidate!==stable&&Date.now()-since>1200){stable=candidate;console.log('Zmiana zapisana — Brave odświeży rozszerzenie i grę.');}}catch{}
},400);
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'||req.url!=='/version'){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify({project:'foe-companion',version:stable}));
});
server.on('error',error=>{console.error(error.message);clearInterval(timer);process.exitCode=1;});
server.listen(18743,'127.0.0.1',()=>console.log('FoE: automatyczne przeładowanie aktywne. Zapis kodu odświeży także grę. Zatrzymaj Ctrl+C.'));
process.on('SIGINT',()=>{clearInterval(timer);server.close();});
