// Offline verification only. Does not execute the client JS or send requests.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const jsPath=path.join(__dirname,'har',fs.readdirSync(path.join(__dirname,'har')).find(f=>f.endsWith('.js')));
const js=fs.readFileSync(jsPath,'utf8');
const match=js.match(/_generateRequestPayloadSignature:function\(a\)\{return Za.substr\(b2.encode\(this._signatureHash\+"([^"]+)"\+a\),1,10\)/);
if(!match)throw Error('Nie rozpoznano algorytmu w tej wersji klienta.');
for(const file of process.argv.slice(2).length?process.argv.slice(2):[path.join(__dirname,'pch.har')]){
 const har=JSON.parse(fs.readFileSync(file,'utf8'));let checked=0,matched=0;const methods={};
 for(const e of har.log.entries){
  if(!new URL(e.request.url).pathname.endsWith('/game/json'))continue;
  const signature=e.request.headers.find(h=>h.name.toLowerCase()==='signature')?.value;
  const body=e.request.postData?.text,h=new URL(e.request.url).searchParams.get('h');
  if(!signature||!body||!h)continue;
  checked++;
  const calculated=crypto.createHash('md5').update(h+match[1]+body,'utf8').digest('hex').slice(1,11);
  if(calculated===signature)matched++;
  for(const r of JSON.parse(body)){const key=r.requestClass+'.'+r.requestMethod;methods[key]=(methods[key]||0)+1;}
 }
 // Do not print session values, signatures or payloads.
 console.log(JSON.stringify({file:path.basename(file),checked,matched,methods},null,2));
}
