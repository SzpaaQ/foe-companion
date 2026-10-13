const http=require('node:http'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const logTime=new Intl.DateTimeFormat('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
function log(message,error=false){for(const line of String(message).split(/\r?\n/))(error?console.error:console.log)(`[${logTime.format(new Date())}] ${line}`);}
const files=['manifest.json','request-signature.js','battle-army.js','capture.js','pearls-main.js','pearls.js','model.js','quantum.js','notes.js','quantum-definitions.json','building-names.json','panel.js','dev-client.js','background.js','sectors.json','sectors-volcano.json'];
function revision(){const hash=crypto.createHash('sha256');for(const name of files)hash.update(name).update(fs.readFileSync(path.join(__dirname,name)));return hash.digest('hex');}
let stable=revision(),candidate=stable,since=0;
let lastClient=0,servedVersion=null,connectionReported=false;
const startedAt=Date.now();
const timer=setInterval(()=>{
 if(Date.now()-(lastClient||startedAt)>15000&&!connectionReported){connectionReported=true;log('Brak zapytań z rozszerzenia od 15 s. Przeładuj rozszerzenie w brave://extensions, potem odśwież kartę gry.');}
 try{const next=revision();if(next!==candidate){candidate=next;since=Date.now();}else if(candidate!==stable&&Date.now()-since>1200){stable=candidate;log('Wykryto zmianę plików — oczekiwanie na klienta rozszerzenia.');}}catch{}
},400);
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'||req.url!=='/version'){res.writeHead(404);return res.end();}
 if(!lastClient||connectionReported)log('Połączono: klient rozszerzenia odpytuje serwer.');
 lastClient=Date.now();connectionReported=false;
 if(servedVersion!==stable){servedVersion=stable;log('Przekazano klientowi aktualną wersję plików (to jeszcze nie potwierdza przeładowania).');}
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify({project:'foe-companion',version:stable}));
});
server.on('error',error=>{log(error.message,true);clearInterval(timer);process.exitCode=1;});
server.listen(18743,'127.0.0.1',()=>log('FoE: serwer zmian aktywny. Przeładowanie wymaga połączenia rozszerzenia. Zatrzymaj Ctrl+C.'));
process.on('SIGINT',()=>{clearInterval(timer);server.close();});
