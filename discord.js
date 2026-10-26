(() => {
  const CONFIG_KEY='foe.discord.config.v1';
  const STATE_KEY='foe.discord.schedule.v1';
  const LOCK_KEY='foe.discord.lease.v1';
  const POLL_MS=1000;
  const defaults={enabled:false,token:'',channelId:'',maxSectors:0,maxMinutes:0};
  const ownId=Math.random().toString(36).slice(2)+Date.now().toString(36);

  function validConfig(value={}){
    return {
      enabled:value.enabled===true,
      token:typeof value.token==='string'?value.token.trim().slice(0,256):'',
      channelId:typeof value.channelId==='string'&&/^\d{16,22}$/.test(value.channelId.trim())?value.channelId.trim():'',
      maxSectors:Number.isInteger(value.maxSectors)&&value.maxSectors>=0&&value.maxSectors<=500?value.maxSectors:0,
      maxMinutes:Number.isInteger(value.maxMinutes)&&value.maxMinutes>=0&&value.maxMinutes<=10080?value.maxMinutes:0,
    };
  }
  const storageGet=key=>new Promise(resolve=>chrome.storage.local.get(key,result=>resolve(result?.[key])));
  const storageSet=value=>new Promise((resolve,reject)=>chrome.storage.local.set(value,()=>chrome.runtime.lastError?reject(chrome.runtime.lastError):resolve()));
  const storageRemove=key=>new Promise(resolve=>chrome.storage.local.remove(key,resolve));
  const api=(config,action,extra={})=>chrome.runtime.sendMessage({type:'FOE_DISCORD_API',action,token:config.token,channelId:config.channelId,...extra});

  function hourKey(date=new Date()){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}-${String(date.getHours()).padStart(2,'0')}`;
  }
  function hashText(text){let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');}
  function discordPayload(text){
    const wrap=part=>'```text\n'+part+'\n```';
    if(text.length+12<=2000)return {content:wrap(text),embeds:[]};
    if(text.length>6000)return null;
    const lines=text.split('\n'),chunks=[];let chunk='';
    for(const line of lines){if(line.length>4084)return null;const next=chunk?chunk+'\n'+line:line;if(next.length>4084){chunks.push(chunk);chunk=line;}else chunk=next;}
    if(chunk)chunks.push(chunk);
    if(chunks.length>10||text.length+chunks.length*12>6000)return null;
    return {content:'',embeds:chunks.map(part=>({description:wrap(part)}))};
  }
  function buildText(rows,config,formatOpen,now=Date.now()/1000,frontierOnly=false){
    const candidates=rows.filter(row=>row&&row.color!=='⚪');
    const open=candidates.filter(row=>row.until<=now&&(!frontierOnly||row.frontier===true)).sort((a,b)=>(a.progress??0)-(b.progress??0)||a.id-b.id);
    let closed=candidates.filter(row=>row.until>now&&(!frontierOnly||row.frontier===true)).sort((a,b)=>a.until-b.until||a.id-b.id);
    if(config.maxMinutes>0)closed=closed.filter(row=>row.until-now<=config.maxMinutes*60);
    if(config.maxSectors>0)closed=closed.slice(0,config.maxSectors);
    const openLines=open.map(row=>'Otwarte '+formatOpen(row));
    const closedLines=closed.map(row=>{
      const type=row.isAttackBattleType===true?'🟥 ':row.isAttackBattleType===false?'🟦 ':'';
      const race=row.race||row.enemyProgress>0?' 🔥':'';
      const guild=row.progress>0?' ⚔️'+row.progress+'/'+(row.maxProgress??'—'):'';
      const enemy=row.enemyProgress>0?' 👾'+row.enemyProgress:'';
      const time=new Intl.DateTimeFormat('pl-PL',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(row.until*1000));
      return time+'   '+type+row.color+' '+row.sector+race+guild+enemy;
    });
    return [openLines.join('\n'),closedLines.join('\n')].filter(Boolean).join('\n\n');
  }

  function mount({root,getRows,formatOpen,isFrontierOnly=()=>false}){
    if(!root||typeof getRows!=='function'||typeof formatOpen!=='function')return null;
    const scheduleHeading=root.querySelector('#schedule-heading');
    const settings=root.querySelector('#settings');
    if(!scheduleHeading||!settings)return null;

    const sendLabel=document.createElement('label');sendLabel.style.cssText='display:flex;align-items:center;gap:4px;margin-left:auto;font-size:11px;white-space:nowrap';
    const enabled=document.createElement('input');enabled.type='checkbox';enabled.style.margin='0';
    const sendText=document.createElement('span');sendText.textContent='Wysyłaj rozpiskę';
    sendLabel.append(enabled,sendText);scheduleHeading.append(sendLabel);
    const section=document.createElement('details');section.id='settings-discord';section.open=true;
    section.innerHTML='<summary>Discord</summary><label>Token bota <input type="password" id="discord-token" autocomplete="off" spellcheck="false" aria-label="Token bota Discord"></label><label>ID kanału <input type="text" id="discord-channel" inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="ID kanału Discord"></label><label>Limit liczby sektorów <input type="number" id="discord-max-sectors" min="0" max="500" step="1" value="0"></label><small>0 = bez limitu. Limit dotyczy zamkniętych sektorów; otwarte są zawsze uwzględniane.</small><label>Limit czasu otwarcia (min) <input type="number" id="discord-max-minutes" min="0" max="10080" step="1" value="0"></label><small>0 = bez limitu. Możesz użyć limitu liczby sektorów, czasu albo obu naraz.</small><button type="button" id="discord-test">Sprawdź połączenie</button><small id="discord-status" role="status" style="display:block;margin:5px 0;white-space:normal"></small><small>Bot potrzebuje dostępu do kanału i wysyłania wiadomości. Rozpiska jest aktualizowana przez edycję zapisanej wiadomości.</small>';
    const quantum=settings.querySelector('#settings-quantum');(quantum||settings.lastElementChild)?.after(section);
    const token=section.querySelector('#discord-token'),channel=section.querySelector('#discord-channel'),maxSectors=section.querySelector('#discord-max-sectors'),maxMinutes=section.querySelector('#discord-max-minutes'),test=section.querySelector('#discord-test'),status=section.querySelector('#discord-status');
    token.style.cssText='width:220px!important;max-width:65vw';channel.style.cssText='width:180px!important;max-width:65vw';
    let config=defaults,storedState=null,busy=false,timer=null,lastStatus='',retryUntil=0;
    const setStatus=text=>{if(text!==lastStatus){status.textContent=text;lastStatus=text;}};
    const discordFailure=(step,result)=>{
      const details=[step,result?.error||'Nie udało się sprawdzić połączenia.'];
      if(result?.discordMessage)details.push(`Discord: ${result.discordMessage}${result.discordCode?' ('+result.discordCode+')':''}`);
      else if(result?.status)details.push(`HTTP ${result.status}`);
      return details.join(' — ');
    };
    const writeConfig=async next=>{
      const previous=config;config=validConfig(next);enabled.checked=config.enabled;
      token.value=config.token;channel.value=config.channelId;maxSectors.value=config.maxSectors;maxMinutes.value=config.maxMinutes;
      try{await storageSet({[CONFIG_KEY]:config});}catch{setStatus('Nie udało się zapisać ustawień Discorda.');}
      if(previous.channelId!==config.channelId||previous.token!==config.token){storedState=null;await storageRemove(STATE_KEY);}
      if(!config.enabled)setStatus('Wysyłanie wyłączone.');
    };
    const load=async()=>{
      try{config=validConfig(await storageGet(CONFIG_KEY)||defaults);storedState=await storageGet(STATE_KEY)||null;}
      catch{config=defaults;setStatus('Nie udało się odczytać ustawień Discorda.');}
      enabled.checked=config.enabled;token.value=config.token;channel.value=config.channelId;maxSectors.value=config.maxSectors;maxMinutes.value=config.maxMinutes;
      if(config.enabled)setStatus('Aktywne — oczekiwanie na dane Pól Chwały.');else setStatus('Wysyłanie wyłączone.');
    };
    let saveTimer=null;
    const saveFields=()=>{
      clearTimeout(saveTimer);saveTimer=setTimeout(()=>writeConfig({...config,token:token.value,channelId:channel.value,maxSectors:Number(maxSectors.value)||0,maxMinutes:Number(maxMinutes.value)||0}),250);
    };
    token.addEventListener('change',saveFields);token.addEventListener('blur',saveFields);channel.addEventListener('change',saveFields);channel.addEventListener('blur',saveFields);maxSectors.addEventListener('change',saveFields);maxMinutes.addEventListener('change',saveFields);
    enabled.onchange=()=>writeConfig({...config,enabled:enabled.checked});
    test.onclick=async()=>{
      await writeConfig({...config,token:token.value,channelId:channel.value,maxSectors:Number(maxSectors.value)||0,maxMinutes:Number(maxMinutes.value)||0});
      if(!config.token||!config.channelId){setStatus('Wpisz token bota i ID kanału.');return;}
      test.disabled=true;setStatus('Sprawdzam dostęp do kanału…');
      try{
        const channelResult=await api(config,'channel');
        setStatus(channelResult?.ok?'Dostęp do kanału działa'+(channelResult.channel?.name?' — #'+channelResult.channel.name:'')+'.':discordFailure('Sprawdzenie kanału',channelResult));
      }
      catch{setStatus('Nie udało się połączyć z usługą rozszerzenia.');}
      finally{test.disabled=false;}
    };

    const tick=async()=>{
      if(busy)return;busy=true;
      try{
        config=validConfig(await storageGet(CONFIG_KEY)||config);
        if(!config.enabled){const held=await storageGet(LOCK_KEY);if(held?.owner===ownId)await storageRemove(LOCK_KEY);setStatus('Wysyłanie wyłączone.');return;}
        if(!config.token||!config.channelId){setStatus('Wpisz token bota i ID kanału w Ustawienia → Discord.');return;}
        const rows=getRows();if(!Array.isArray(rows)){setStatus('Otwórz mapę Pól Chwały w grze.');return;}
        const text=buildText(rows,config,formatOpen,Date.now()/1000,isFrontierOnly());
        if(!text){setStatus('Brak sektorów do opublikowania.');return;}
        const payload=discordPayload(text);
        if(!payload){setStatus('Rozpiska przekracza limit Discorda 6000 znaków. Ustaw limit liczby sektorów lub czasu.');return;}
        if(Date.now()<retryUntil)return;
        const lease=await storageGet(LOCK_KEY),now=Date.now();
        if(lease?.expires>now&&lease.owner!==ownId){setStatus('Rozpiska jest aktualizowana w innej karcie.');return;}
        await storageSet({[LOCK_KEY]:{owner:ownId,expires:now+15000}});
        const confirm=await storageGet(LOCK_KEY);if(confirm?.owner!==ownId)return;
        storedState=await storageGet(STATE_KEY)||null;
        const currentHour=hourKey();
        const state=storedState&&storedState.channelId===config.channelId?storedState:null;
        const sameSchedule=!!state?.messageId&&state.hour===currentHour;
        const contentHash=hashText(text);
        if(sameSchedule&&state.hash===contentHash&&state.text===text){
          setStatus('Rozpiska aktualna na Discordzie.');return;
        }
        if(sameSchedule){
          const edit=await api(config,'edit',{messageId:state.messageId,payload});
          if(edit?.ok){
            storedState={...state,text,hash:contentHash,hour:currentHour,updatedAt:now};
            await storageSet({[STATE_KEY]:storedState});setStatus('Zaktualizowano rozpiskę na Discordzie.');return;
          }
          if(edit?.status!==404){retryUntil=Date.now()+(edit?.retryAfter?edit.retryAfter*1000:60000);setStatus(discordFailure('Edycja rozpiski',edit));return;}
          storedState=null;await storageRemove(STATE_KEY);
        }
        const sent=await api(config,'send',{payload});
        if(!sent?.ok){retryUntil=Date.now()+(sent?.retryAfter?sent.retryAfter*1000:60000);setStatus(discordFailure('Wysyłanie rozpiski',sent));return;}
        storedState={channelId:config.channelId,messageId:sent.message?.id||null,botId:sent.message?.author?.id||null,text,hash:contentHash,hour:currentHour,updatedAt:now};
        await storageSet({[STATE_KEY]:storedState});setStatus('Wysłano nową rozpiskę na Discorda.');
      }catch{setStatus('Błąd podczas aktualizacji rozpiski Discorda.');}
      finally{busy=false;}
    };
    load().then(()=>tick());timer=setInterval(tick,POLL_MS);
    return {refresh:tick,close(){clearInterval(timer);clearTimeout(saveTimer);storageGet(LOCK_KEY).then(lock=>{if(lock?.owner===ownId)storageRemove(LOCK_KEY);});}};
  }

  globalThis.FoeDiscord={mount,buildText,discordPayload};
  if(typeof module!=='undefined'&&module.exports)module.exports={buildText,discordPayload,hashText,hourKey};
})();
