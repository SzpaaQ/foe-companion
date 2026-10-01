(() => {
  'use strict';

  let battle = null,
    count = 0,
    output = '',
    paint = () => {},
    notice = '',
    mapReady = false;

  const methods = [];

  let construction = null,
    paintPearl = () => {},
    paintCity = () => {};

  let ownPlayerId = null;

  const pearlTracker = FoePearls.createTracker();
  const quantumTracker = FoeQuantum.createTracker();
  let paintQuantum=()=>{},syncNotes=()=>{};
  fetch(chrome.runtime.getURL('quantum-definitions.json')).then(r=>r.json()).then(defs=>{
    quantumTracker.consume(defs,{fallback:true});
    for(const def of defs) FoeModel.seedName(def.id,def.name);
    paintQuantum();paintPearl();
  }).catch(()=>{});

  // Ostatnia cyfra 1-5 wciśnięta przed otwarciem perły
  let lastDigit = null;

  // Funkcje ustawiane w mount(), pozwalają otworzyć panel
  // z poziomu listenera odbierającego dane gry.
  let openPearlPanel = () => {};
  let openGbgPanel   = () => {};
  let openQuantumPanel = () => {};

window.addEventListener('message', event => {
  if (
    event.source !== window ||
    event.origin !== location.origin
  ) {
    return;
  }

  const channel = event.data?.channel;

  // --- foe-companion-v1: dane gry ---
  if (channel !== 'foe-companion-v1') return;

  count++;

  const data = event.data.data;
  const responses = Array.isArray(data) ? data : [data];

  // Uzupełniaj słownik nazw ze wszystkich odpowiedzi
  FoeModel.learnNames(data);
  quantumTracker.consume(data);
  paintQuantum();
  if(FoeQuantum.isSettlementResponse(data))openQuantumPanel();

  construction = pearlTracker.consume(
    data,
    event.data.methods || []
  );

  /*
   * AUTOMATYCZNE OTWIERANIE PANELU
   *
   * Panel wysuwa się przy każdym otwarciu perły —
   * czyli gdy w odpowiedzi gry pojawia się getConstruction.
   */
  const hasConstruction = responses.some(
    r => r?.requestClass === 'GreatBuildingsService' &&
         r?.requestMethod === 'getConstruction'
  );

  if (hasConstruction) {
    openPearlPanel();
  }

  paintPearl();

  for (const response of responses) {
    if (typeof response?.requestClass === 'string') {
      methods.push(
        `${response.requestClass}.${response.requestMethod || ''}`
      );
    }

    // StartupService.getData — parsuj całe miasto
    if (response?.requestClass === 'StartupService' &&
        response?.requestMethod === 'getData' &&
        response?.responseData?.city_map?.entities) {
      // Wyciągnij własne player_id z user_data
      if (!ownPlayerId) {
        ownPlayerId = response.responseData.user_data?.player_id ?? null;
      }
      FoeModel.parseCity(response.responseData.city_map.entities, ownPlayerId);
      paintCity();
      paintPearl();
    }

    if (
      response?.requestClass === 'GuildBattlegroundStateService' &&
      response?.requestMethod === 'getState' &&
      !battle
    ) {
      notice =
        'Wykryto Pola Chwały. Oczekuję na odpowiedź z mapą sektorów.';
    }
  }

  methods.splice(
    0,
    Math.max(0, methods.length - 20)
  );

  const update = FoeModel.updateBattle(
    battle,
    data
  );

  if (update.changed) {
    battle = update.battle;
    notice = '';
    if(!event.data.internal)openGbgPanel();
  }

  // Aktualizuj stan budynków miasta z CityMapEntity w bieżącej odpowiedzi
  const cityUpdate = FoeModel.updateCity(data);
  if (cityUpdate.changed) {
    paintCity();
  }

  paint();
});

  Promise.all(['sectors.json','sectors-volcano.json'].map(file=>fetch(chrome.runtime.getURL(file)).then(r=>r.json())))
    .then(maps => {
      maps.forEach(m=>FoeModel.setTopology(m));
      mapReady = true;
      paint();
    })
    .catch(() => {
      notice = 'Nie udało się załadować mapy sektorów.';
      paint();
    });

  fetch(chrome.runtime.getURL('building-names.json'))
    .then(r => r.json())
    .then(names => {
      // Zasilamy słownik gotowymi nazwami — learnNames przyjmuje obiekt {ceid: name}
      for (const [ceid, name] of Object.entries(names)) {
        FoeModel.seedName(ceid, name);
      }
      paintCity();
      paintPearl();
    })
    .catch(() => {});

  function mount() {
    const host = document.createElement('div');

    host.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483647';

    document.documentElement.append(host);

    const root = host.attachShadow({
      mode: 'closed'
    });

    root.innerHTML = `
      <style>
        :host {
          all: initial
        }

        * {
          box-sizing: border-box
        }

        button,
        input {
          font: inherit
        }

        button {
          cursor: pointer;
          background: #243d45;
          border: 1px solid #405961;
          color: #e9f1f2;
          border-radius: 0px;
          padding: 4px 4px
        }
        button#handle {
          cursor: pointer;
          background: #243d45;
          border: 1px solid #405961;
          color: #e9f1f2;
          border-radius: 8px;
          border-top-right-radius: 0px;
          border-bottom-right-radius: 0px;
          padding: 8px 12px
        }
        button#close {
          cursor: pointer;
          background: transparent;
          border: none;
          color: #e9f1f2;
          padding: 8px 12px;
          font-size:20px;
        }

        button:hover {
          background: #355660
        }

        #handle {
          position: absolute;
          right: 0;
          top: 90%;
          pointer-events: auto;
          color: #f1d69a;
          font: 700 14px system-ui
        }

        aside {
          position: absolute;
          right: 0;
          top: 0;
          width: min(400px, 96vw);
          height: 100vh;
          overflow: auto;
          padding: 20px;
          background: #102126;
          color: #e7eeee;
          box-shadow: -8px 0 30px #0008;
          pointer-events: auto;
          font: 14px/1.5 system-ui;
          transform: translateX(105%);
          transition: transform .2s
        }

        aside.open {
          transform: none
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: center
        }

        h1 {
          font-size: 19px;
          color: #f1d69a;
          margin: 0
        }

        h2 {
          font-size: 17px
        }

        nav {
          display: flex;
          gap: 7px;
          margin: 18px 0;
          border-bottom: 1px solid #345058;
          padding-bottom: 12px
        }

        nav button {
          width: 43px;
          height: 39px;
          padding: 4px;
          font-size: 19px
        }

        nav button[aria-selected=true] {
          border-color: #e1be77;
          background: #39525a
        }

        section[hidden] {
          display: none
        }

        pre {
          white-space: pre-wrap;
          background: #0b191e;
          border-radius: 8px;
          padding: 12px;
          font: 13px/1.9 monospace;
          max-height: 300px;
          overflow-y: auto
        }

        p {
          color: #aebfc4
        }

        #notice {
          color: #e1be77;
          font-size: 12px
        }

        label {
          display: block;
          margin: 12px 0
        }

        #feedback {
          font-size: 12px
        }

        small {
          color: #90a5ad
        }
      </style>

      <button
        id="handle"
        aria-label="Otwórz panel"
      >
        FoE ›
      </button>

      <aside>
        <header>
          <h1>
            FOE Companion
            <small style="font-size:11px;font-weight:400">
              v.0.0.1
            </small>
          </h1>

          <button
            id="close"
            aria-label="Zamknij"
          >
            ×
          </button>
        </header>

        <nav
          role="tablist"
          aria-label="Sekcje"
        >
          <button
            role="tab"
            data-page="gb"
            aria-label="Kalkulator pereł"
            title="Kalkulator pereł"
            aria-selected="true"
          >
            🏛️
          </button>

          <button
            role="tab"
            data-page="gbg"
            aria-label="Pola Chwały"
            title="Pola Chwały"
            aria-selected="false"
          >
            ⚔️
          </button>

          <button
            role="tab"
            data-page="city"
            aria-label="Zbiory"
            title="Zbiory"
            aria-selected="false"
          >
            🏘️
          </button>

          <button
            role="tab"
            data-page="settings"
            aria-label="Ustawienia"
            title="Ustawienia"
            aria-selected="false"
          >
            ⚙️
          </button>
        </nav>

        <section
          id="gb"
          role="tabpanel"
        >
          <h2>Kalkulator pereł</h2>

          <p id="pearl-status">
            Otwórz perłę w grze.
          </p>

          <div id="pearl-rows"></div>

          <small>

          </small>

          <p id="pearl-feedback"></p>
        </section>

        <section
          id="gbg"
          role="tabpanel"
          hidden
        >
          <h2>Pola Chwały</h2>

          <label>
            <input
              id="frontier"
              type="checkbox"
              checked
            >
            Sąsiedzi naszych sektorów
          </label>

          <p id="notice"></p>

          <pre id="list">
Otwórz mapę Pól Chwały w grze.
          </pre>

          <button id="copy">
            Kopiuj rozpiskę
          </button>
          <button id="export-battle" disabled style="display:none">Pobierz stan mapy JSON</button>

          <p id="feedback"></p>
          <h3>Otwarte sektory</h3>
          <div id="open-sectors"></div>
          <p id="battle-feedback" role="status"></p>
        </section>

        <section
          id="city"
          role="tabpanel"
          hidden
        >
          <h2>Zbiory</h2>
          <p id="city-status" style="color:#aebfc4;font-size:13px">
            Odśwież grę, aby załadować dane miasta.
          </p>
          <div id="city-list"></div>
        </section>

        <section
          id="settings"
          role="tabpanel"
          hidden
        >
          <h2>Ustawienia</h2>

          <label>
            Przelicznik
            <input
              id="multiplier"
              type="text"
              inputmode="decimal"
              value="1.9"
              style="width:75px;padding:6px;margin-left:8px"
              aria-label="Przelicznik nagrody"
            >
          </label>

          <label>
            <input
              id="auto-open"
              type="checkbox"
              checked
            >
            Automatycznie wysuwaj panel podczas otwierania perły
          </label>

          <label>
            <input
              id="auto-copy"
              type="checkbox"
              checked
            >
            Automatycznie kopiuj kwotę po otwarciu perły (cyfra 1–5 poza czatem)
          </label>

          <label>
            <input
              id="auto-open-gbg"
              type="checkbox"
              checked
            >
            Automatycznie wysuwaj panel po wejściu na Pola Chwały
          </label>

          <hr style="border-color:#345058;margin:16px 0">
          <label><input id="auto-open-quantum" type="checkbox" checked> Automatycznie wysuwaj panel po wejściu do osady Najazdów kwantowych</label>

          <h2>Alerty Pól Chwały</h2>
          <label><input id="gbg-sound-enabled" type="checkbox"> Alert dźwiękowy przed odblokowaniem sektora</label>
          <label>Wyprzedzenie (minuty) <input id="gbg-sound-minutes" type="number" min="1" max="60" step="1" value="2" style="width:65px"></label>
          <button id="gbg-sound-test">Test dźwięku</button>
          <p id="gbg-sound-status" role="status"></p>
          <small>Alerty dotyczą sektorów z aktualnej rozpiski. Zostaw kartę gry otwartą; uśpienie karty może opóźnić dźwięk.</small>
          <h2 id="diagnostics-heading">Diagnostyka</h2>

          <small>
            Wersja 0.3 · automatyczny odczyt gry
            <span id="quantum-calculation-version"></span>
          </small>

          <p id="status"></p>

          <pre id="methods"></pre>

          <p>
            Tryb developerski: uruchom START-DEV.cmd
            w folderze projektu. Zapis kodu przeładuje
            rozszerzenie i kartę gry. Zamknij skrypt,
            aby wyłączyć.
          </p>
        </section>
      </aside>
    `;

    const $ = id => root.getElementById(id);
    const soundKey='foe-companion.gbgSound';
    let soundSettings={enabled:false,minutes:2},audioContext=null,alertBusy=false;
    try{const saved=JSON.parse(localStorage.getItem(soundKey)||'null');if(saved)soundSettings={enabled:saved.enabled===true,minutes:Number.isInteger(saved.minutes)&&saved.minutes>=1&&saved.minutes<=60?saved.minutes:2};}catch{}
    $('gbg-sound-enabled').checked=soundSettings.enabled;
    $('gbg-sound-minutes').value=soundSettings.minutes;
    let sounded={};
    try{sounded=JSON.parse(sessionStorage.getItem(soundKey+'.sent')||'{}')||{};}catch{}
    async function unlockAudio(){
      audioContext ||= new AudioContext();
      if(audioContext.state==='suspended')await audioContext.resume();
      return audioContext.state==='running';
    }
    function playAlert(){
      if(audioContext?.state!=='running')return false;
      for(let i=0;i<3;i++){
        const osc=audioContext.createOscillator(),gain=audioContext.createGain(),at=audioContext.currentTime+i*.23;
        osc.frequency.value=i===1?1047:784;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.14,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.18);
        osc.connect(gain);gain.connect(audioContext.destination);osc.start(at);osc.stop(at+.2);
      }
      return true;
    }
    function checkSectorAlerts(){
      if(!soundSettings.enabled||!battle||alertBusy)return;
      const now=Date.now()/1000;
      const due=FoeModel.rows(battle,$('frontier').checked).rows.filter(r=>r.color!=='⚪'&&r.until>now&&r.until-now<=soundSettings.minutes*60&&!sounded[`${battle.map.id}:${r.id}:${r.until}`]);
      if(!due.length)return;
      if(!playAlert()){$('gbg-sound-status').textContent='Kliknij „Test dźwięku”, aby aktywować dźwięk w tej karcie.';return;}
      alertBusy=true;
      for(const [key,until] of Object.entries(sounded))if(until<=now)delete sounded[key];
      for(const r of due)sounded[`${battle.map.id}:${r.id}:${r.until}`]=r.until;
      try{sessionStorage.setItem(soundKey+'.sent',JSON.stringify(sounded));}catch{}
      $('gbg-sound-status').textContent='🔔 Wkrótce odblokowanie: '+due.map(r=>r.sector).join(', ');
      setTimeout(()=>alertBusy=false,800);
    }
    $('gbg-sound-enabled').onchange=async()=>{
      soundSettings.enabled=$('gbg-sound-enabled').checked;localStorage.setItem(soundKey,JSON.stringify(soundSettings));
      if(soundSettings.enabled){try{await unlockAudio();checkSectorAlerts();}catch{$('gbg-sound-status').textContent='Nie udało się uruchomić dźwięku.';}}
      else $('gbg-sound-status').textContent='Alerty wyłączone.';
    };
    $('gbg-sound-minutes').onchange=()=>{
      const value=Number($('gbg-sound-minutes').value);
      if(!Number.isInteger(value)||value<1||value>60){$('gbg-sound-minutes').value=soundSettings.minutes;return;}
      soundSettings.minutes=value;localStorage.setItem(soundKey,JSON.stringify(soundSettings));checkSectorAlerts();
    };
    $('gbg-sound-test').onclick=async()=>{try{await unlockAudio();$('gbg-sound-status').textContent=playAlert()?'Odtworzono dźwięk testowy.':'Dźwięk zablokowany przez przeglądarkę.';}catch{$('gbg-sound-status').textContent='Nie udało się uruchomić dźwięku.';}};
    document.addEventListener('pointerdown',()=>{if(soundSettings.enabled)unlockAudio().catch(()=>{});},{capture:true});
    setInterval(checkSectorAlerts,1000);
    document.addEventListener('visibilitychange',checkSectorAlerts);
    $('quantum-calculation-version').textContent=' · Obliczenia Najazdów: '+(FoeQuantum.calculationVersion||1);
    // Extend the existing UI without replacing user styling and settings.
    const style=document.createElement('style');
    style.textContent=`aside{display:flex;flex-direction:column;overflow:hidden}header,nav{flex-shrink:0}aside>section{flex:1;min-height:0;overflow:auto}#notes-dock{flex-shrink:0;max-height:300px;overflow:hidden;border-top:1px solid #345058;padding-top:8px;margin-top:10px;display:flex;flex-direction:column}#notes-dock label{margin:0 0 4px}#notes-text{font:13px/1.5 system-ui;box-sizing:border-box;width:100%;height:140px;min-height:60px;max-height:250px;resize:vertical;background:#0b191e;color:#e7eeee;border:1px solid #45616a;border-radius:7px;padding:8px}#notes-status{font-size:11px;min-height:16px;color:#90a5ad}.quantum-group{border-top:1px solid #345058;padding:10px 0}.quantum-resources{font-size:16px;color:#f1d69a}`;
    root.append(style);
    const qtab=document.createElement('button');qtab.dataset.page='quantum';qtab.setAttribute('role','tab');qtab.setAttribute('aria-selected','false');qtab.title='Najazdy kwantowe';qtab.setAttribute('aria-label','Najazdy kwantowe');qtab.textContent='⚛️';
    root.querySelector('nav').insertBefore(qtab,root.querySelector('[data-page="settings"]'));
    const quantumSection=document.createElement('section');quantumSection.id='quantum';quantumSection.hidden=true;quantumSection.setAttribute('role','tabpanel');
    quantumSection.innerHTML='<h2>Najazdy kwantowe</h2><div id="quantum-summary"></div><div id="quantum-groups"></div>';
    $('settings').before(quantumSection);
    const title=document.createElement('h3');title.id='pearl-name';$('pearl-status').before(title);
    const totalLabel=document.createElement('label');totalLabel.innerHTML='Total PR <input id="pearl-total" type="number" min="0" step="1" placeholder="Koszt poziomu" style="width:130px;padding:6px">';
    $('pearl-status').before(totalLabel);
    const pearlTotals=new Map();let totalTarget=null;
    $('pearl-total').addEventListener('input',()=>{pearlTotals.set(totalTarget,$('pearl-total').value);paintPearl();});
    const dock=document.createElement('div');dock.id='notes-dock';dock.innerHTML='<label for="notes-text">Notatki <small id="notes-context"></small></label><textarea id="notes-text" placeholder="Twoje notatki…"></textarea><div id="notes-status" role="status"></div>';
    root.querySelector('aside').append(dock);
    const notes=FoeNotes.createStore(localStorage);let noteKey=null,noteSection=null,notePearl=null;
    function pearlType(){
      if(construction?.cityentity_id)return construction.cityentity_id;
      const ids=new Set((construction?.rankings||[]).flatMap(r=>(r.reward?.blueprintRewards||[]).map(b=>b.building_id)).filter(Boolean));
      return ids.size===1?[...ids][0]:null;
    }
    syncNotes=()=>{
      const active=[...root.querySelectorAll('aside>section')].find(s=>!s.hidden)?.id||'gb';
      const section=active==='gb'?'pearl':active==='quantum'?'najazdy':active;
      const pearl=section==='pearl'?pearlType():null,key=section+':'+(pearl||'');
      $('notes-context').textContent=section==='pearl'?(pearl?FoeModel.buildingLabel(pearl):'— otwórz perłę'):'';
      if(key===noteKey)return;
      noteKey=key;noteSection=section;notePearl=pearl;
      $('notes-text').disabled=section==='pearl'&&!pearl;
      $('notes-text').value=$('notes-text').disabled?'':notes.get(section,pearl);$('notes-status').textContent='';
    };
    $('notes-text').addEventListener('input',()=>{
      try{notes.set(noteSection,notePearl,$('notes-text').value);$('notes-status').textContent='Zapisano';}
      catch{$('notes-status').textContent='Nie udało się zapisać — skopiuj notatkę przed zamknięciem.';}
    });
    new MutationObserver(syncNotes).observe(root.querySelector('aside'),{subtree:true,attributes:true,attributeFilter:['hidden']});
    window.addEventListener('storage',e=>{if(e.key===FoeNotes.KEY && root.activeElement!==$('notes-text')){noteKey=null;syncNotes();}});
    const formatResources=r=>`🪙 ${r.guild_raids_money.toLocaleString('pl-PL')}   🔨 ${r.guild_raids_supplies.toLocaleString('pl-PL')}   🔩 ${r.guild_raids_chrono_alloy.toLocaleString('pl-PL')}`;
    const formatTime=t=>new Date(t*1000).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    paintQuantum=()=>{
      const summary=quantumTracker.summary();$('quantum-summary').replaceChildren();$('quantum-groups').replaceChildren();
      const text=(parent,value,tag='p',className='')=>{const node=document.createElement(tag);node.textContent=value;node.className=className;parent.append(node);return node;};
      if(!summary){text($('quantum-summary'),'Otwórz osadę kwantową w grze.');return;}

      const heading=$('quantum').querySelector('h2');heading.replaceChildren(document.createTextNode('Najazdy kwantowe'));
      heading.style.cssText='display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:4px;margin-bottom:8px';
      const meta=text(heading,'👑 '+(summary.raid?.difficulty??'—')+' · ⌛ '+(summary.raid?.endsAt?formatTime(summary.raid.endsAt):'—'),'small');meta.style.cssText='font-size:12px;color:#ffd700';
      const box=$('quantum-summary');box.style.cssText='font-size:13px;line-height:1.4;color:#f0e6d2;margin-bottom:12px';
      const stocks=text(box,'','div');stocks.style.cssText='display:flex;flex-wrap:wrap;gap:10px;font-weight:bold;border-bottom:1px solid #4a3525;padding-bottom:6px;margin-bottom:8px';
      const num=n=>Number.isFinite(n)?n.toLocaleString('pl-PL'):'—';
      for(const [key,icon] of [['guild_raids_money','🪙'],['guild_raids_supplies','🔨'],['guild_raids_chrono_alloy','🔩'],['guild_raids_rope','➰']]){
        const node=text(stocks,icon+' '+num(summary.wallet[key]),'span');
        if(key==='guild_raids_rope')node.title=summary.ropeCapacity===null?'Brak danych do obliczenia produkcji lin.':'Z obecnych zapasów można wyprodukować maksymalnie '+num(summary.ropeCapacity)+' lin, łącząc dostępne paczki. Kalkulacja kosztów, bez kosztu budowy wytwórni.';
      }
      const mood=text(stocks,'✨ '+(summary.currentBonuses.euphoria?'150%':summary.currentBonuses.unhappy?'niska':'100%'),'span');mood.style.color=summary.currentBonuses.euphoria?'#4caf50':'#dfd1b8';
      const hourly=text(box,'⚡ '+num(summary.actionsPerHour)+'/h · ⚔️ '+(summary.actionsPerHour/3500).toLocaleString('pl-PL',{maximumFractionDigits:2})+'/h','div');hourly.style.cssText='text-align:center;font-size:12px;color:#a99885;margin-bottom:8px';
      const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px';box.append(table);
      const tr=document.createElement('tr');table.append(tr);text(tr,'Następny zbiór:','th');
      const next=summary.groups[0]?.production;
      for(const [key,icon] of [['guild_raids_money','🪙'],['guild_raids_supplies','🔨'],['guild_raids_chrono_alloy','🔩']]){const cell=text(tr,icon+' '+num(next?.[key]),'td');cell.style.cssText='padding:6px 4px;border-left:1px solid #4a3525;text-align:center;font-weight:bold';}
      const foot=text(box,'Bonus 🪙 +'+summary.bonuses.coins+'% / 🔨 +'+summary.bonuses.supplies+'%','div');foot.style.cssText='font-size:11px;color:#a99885;border-top:1px solid #4a3525;padding-top:4px';
      if(summary.missing.length)text(box,'Niepełne dane: brakuje definicji '+summary.missing.length+' budynków.');
      if(summary.bonuses.unhappy)text(box,'Prognoza nie uwzględnia kary za niezadowolenie.');
      for(const group of summary.groups){
        const box=document.createElement('div');box.className='quantum-group';$('quantum-groups').append(box);
        text(box,group.at<=Date.now()/1000?'Gotowe do zbioru':formatTime(group.at),'strong');
        text(box,formatResources(group.production));
        const details=document.createElement('details'),label=document.createElement('summary');label.textContent=`Budynki (${group.items.length})`;details.append(label);box.append(details);
        for(const item of FoeQuantum.groupedBuildings(group.items))text(details,`${item.count}× ${item.name} · ${formatResources(item.production)}`);
      }
      if(summary.builds.length)text($('quantum-groups'),`W budowie (bez zbioru w prognozie): ${summary.builds.map(b=>b.name+(b.at?' — '+formatTime(b.at):'')).join(', ')}`);
      const emojiTitles={'🪙':'Monety kwantowe','🔨':'Zaopatrzenie kwantowe (młotki)','🔩':'Chronostopy','👑':'Poziom trudności najazdu','⌛':'Termin zakończenia najazdu','✨':'Mnożnik produkcji wynikający z zadowolenia','⚡':'Produkcja działań kwantowych na godzinę','⚔️':'Walki na godzinę przy koszcie 3500 działań za walkę'};
      const walker=document.createTreeWalker($('quantum'),NodeFilter.SHOW_TEXT),nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      for(const node of nodes){
        const parts=node.textContent.split(/(🪙|🔨|🔩|👑|⌛|✨|⚡|⚔️)/u);
        if(parts.length===1)continue;
        const fragment=document.createDocumentFragment();
        for(const part of parts){
          if(emojiTitles[part]){const icon=document.createElement('span');icon.textContent=part;icon.title=emojiTitles[part];fragment.append(icon);}
          else fragment.append(document.createTextNode(part));
        }
        node.replaceWith(fragment);
      }
    };
    syncNotes();paintQuantum();
    setInterval(paintQuantum,30000);

    // Wczytaj ustawienia z localStorage
    const LS_MULTIPLIER    = 'foe-companion.multiplier';
    const LS_AUTO_OPEN     = 'foe-companion.autoOpen';
    const LS_AUTO_OPEN_GBG = 'foe-companion.autoOpenGbg';
    const LS_AUTO_OPEN_QUANTUM = 'foe-companion.autoOpenQuantum';
    $('auto-open-quantum').checked=localStorage.getItem(LS_AUTO_OPEN_QUANTUM)!=='0';
    $('auto-open-quantum').onchange=()=>localStorage.setItem(LS_AUTO_OPEN_QUANTUM,$('auto-open-quantum').checked?'1':'0');
    openQuantumPanel=()=>{
      if(!$('auto-open-quantum').checked)return;
      root.querySelector('aside').classList.add('open');
      root.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.page==='quantum')));
      root.querySelectorAll('aside>section').forEach(s=>s.hidden=s.id!=='quantum');
      syncNotes();
    };
    const LS_AUTO_COPY     = 'foe-companion.autoCopy';

    const savedMultiplier   = localStorage.getItem(LS_MULTIPLIER);
    const savedAutoOpen     = localStorage.getItem(LS_AUTO_OPEN);
    const savedAutoOpenGbg  = localStorage.getItem(LS_AUTO_OPEN_GBG);
    const savedAutoCopy     = localStorage.getItem(LS_AUTO_COPY);

    if (savedMultiplier !== null) {
      $('multiplier').value = savedMultiplier;
    }
    const autoOpenEnabled    = () => $('auto-open').checked;
    const autoOpenGbgEnabled = () => $('auto-open-gbg').checked;
    const autoCopyEnabled    = () => $('auto-copy').checked;

    if (savedAutoOpen === '0')    { $('auto-open').checked = false; }
    if (savedAutoOpenGbg === '0') { $('auto-open-gbg').checked = false; }
    if (savedAutoCopy === '0')    { $('auto-copy').checked = false; }

    /*
     * Funkcja używana przez listener wiadomości gry.
     * Dzięki temu można otworzyć panel zanim zostanie
     * wywołane paintPearl().
     */
    openPearlPanel = () => {
      if (!autoOpenEnabled()) return;

      const aside = root.querySelector('aside');
      if (aside) aside.classList.add('open');

      // Przełącz na zakładkę perły
      root.querySelectorAll('[data-page]').forEach(b =>
        b.setAttribute('aria-selected', String(b.dataset.page === 'gb'))
      );
      root.querySelectorAll('section').forEach(s => {
        s.hidden = s.id !== 'gb';
      });

      // Auto-kopiowanie kwoty dla wybranej cyfry
      if (autoCopyEnabled() && lastDigit) {
        const digit = lastDigit;
        // Poczekaj aż paintPearl wyrenderuje wiersze
        setTimeout(() => {
          const result = FoeModel.pearlAmounts(
            construction,
            $('multiplier').value,
            false
          );
          if (!result) return;
          const row = result.rows.find(r => r.rank === digit);
          if (!row || row.amount === null) return;
          navigator.clipboard.writeText(String(row.amount)).then(() => {
            $('pearl-feedback').textContent =
              'Skopiowano P' + digit + ': ' + row.amount;
          }).catch(() => {});
        }, 50);
      }
    };

    openGbgPanel = () => {
      if (!autoOpenGbgEnabled()) return;

      const aside = root.querySelector('aside');
      if (aside) aside.classList.add('open');

      // Przełącz na zakładkę Pól Chwały
      root.querySelectorAll('[data-page]').forEach(b =>
        b.setAttribute('aria-selected', String(b.dataset.page === 'gbg'))
      );
      root.querySelectorAll('section').forEach(s => {
        s.hidden = s.id !== 'gbg';
      });
    };

    $('handle').onclick = () => {
      root
        .querySelector('aside')
        .classList.add('open');

      $('close').focus();
    };

    $('close').onclick = () => {
      root
        .querySelector('aside')
        .classList.remove('open');
    };


    // 2. CZYSTY LISTENER KLAWIATURY (Bez logiki Double Ctrl)
    document.addEventListener('keydown', e => {
      // Oryginalna obsługa klawisza Escape
      if (e.key === 'Escape') {
        root
          .querySelector('aside')
          .classList.remove('open');
      }

      // Oryginalna obsługa cyfr 1–5 poza polami tekstowymi
      if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = (root.activeElement || document.activeElement)?.tagName;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
          const digit = Number(e.key);
          lastDigit = digit;
          // Jeśli panel jest otwarty i są dane perły — kopiuj od razu
          const aside = root.querySelector('aside');
          if (aside?.classList.contains('open') && construction) {
            const result = FoeModel.pearlAmounts(construction, $('multiplier').value, false);
            const row = result?.rows?.find(r => r.rank === digit);
            if (row?.amount !== null && row?.amount !== undefined) {
              navigator.clipboard.writeText(String(row.amount)).then(() => {
                $('pearl-feedback').textContent = 'Skopiowano P' + digit + ': ' + row.amount;
              }).catch(() => {});
            }
          }
        }
      }
    });


    root
      .querySelectorAll('[data-page]')
      .forEach(button => {
        button.onclick = () => {
          root
            .querySelectorAll('[data-page]')
            .forEach(b =>
              b.setAttribute(
                'aria-selected',
                String(b === button)
              )
            );

          root
            .querySelectorAll('section')
            .forEach(s => {
              s.hidden =
                s.id !== button.dataset.page;
            });
        };
      });

    const autoKey='foe-companion-gbg-auto';
    let autoSettings={reserve:3,min:0.3,max:0.4};
    try{const v=JSON.parse(localStorage.getItem(autoKey));if(v&&Number.isInteger(v.reserve)&&v.reserve>=0&&Number.isFinite(v.min)&&v.min>=0&&Number.isFinite(v.max)&&v.max>=v.min)autoSettings=v;}catch{}
    const autoConfig=document.createElement('div');
    autoConfig.innerHTML='<h3>Autoatak — Pola Chwały</h3><label>Pozostaw walk: <input id="auto-reserve" type="number" min="0" step="1" style="width:70px"></label><p>Przerwa po walce (sekundy): <input id="auto-min" type="number" min="0" step="0.1" style="width:70px"> – <input id="auto-max" type="number" min="0" step="0.1" style="width:70px"></p><small>Automatyczne zatrzymanie po 3 kolejnych porażkach.</small><p id="auto-settings-error"></p>';
    $('diagnostics-heading').before(autoConfig);
    for(const key of ['reserve','min','max']){
      $('auto-'+key).value=autoSettings[key];
      $('auto-'+key).onchange=()=>{
        const next=Object.fromEntries(['reserve','min','max'].map(k=>[k,Number($('auto-'+k).value)]));
        if(!Number.isInteger(next.reserve)||next.reserve<0||!Number.isFinite(next.min)||next.min<0||!Number.isFinite(next.max)||next.max<next.min){$('auto-settings-error').textContent='Podaj nieujemne wartości; maksymalna przerwa musi być ≥ minimalnej.';return;}
        autoSettings=next;localStorage.setItem(autoKey,JSON.stringify(next));$('auto-settings-error').textContent='';stopAuto('Ustawienia zmienione.');
      };
    }
    let autoSector=null,autoTimer=null,lossStreak=0,fights=0,wins=0;
    const stats=document.createElement('td');stats.title='Wygrane / zakończone walki przyciskami rozszerzenia w tej sesji';stats.textContent='🏆 0/0';$('open-sectors').before(stats);
    const stopButton=document.createElement('button');stopButton.textContent='⏹ Zatrzymaj autoatak';stopButton.hidden=true;stats.after(stopButton);stopButton.onclick=()=>stopAuto('Autoatak zatrzymany. Rozpoczęte żądanie zostanie dokończone.');
    function stopAuto(message){clearTimeout(autoTimer);autoTimer=null;autoSector=null;stopButton.hidden=true;if(message)$('battle-feedback').textContent=message;paintOpenSectors();}

    // --- Negocjacje UI --- (negStats/stopNegButton/negPanel zdefiniowane poniżej, montowane tu)
    // Montaż następuje po deklaracji zmiennych negocjacyjnych w kolejnym bloku.
    let negPending=null,negPendingSector=null,negLastSector=null,negLastUntil=0,negLastOK=false;
    let autoNegSector=null,autoNegTimer=null,negWins=0,negDone=0;
    const negStats=document.createElement('td');negStats.title='Wygrane / zakończone negocjacje przyciskami rozszerzenia w tej sesji';negStats.textContent='🤝 0/0';
    const stopNegButton=document.createElement('button');stopNegButton.textContent='⏹ Zatrzymaj auto-negocjację';stopNegButton.hidden=true;
    // Panel tury negocjacji — wyświetlany pod listą sektorów podczas aktywnej negocjacji.
    const negPanel=document.createElement('div');negPanel.id='neg-panel';negPanel.style.cssText='background:#0b191e;border-radius:6px;padding:10px;margin:8px 0;font-size:13px;display:none';
    // Montuj w DOM: negStats i stopNegButton za stopButton, negPanel przed listą sektorów.
    const counters=document.createElement('table');counters.style.cssText='width:100%;margin:6px 0;border-collapse:collapse';
    const counterBody=document.createElement('tbody'),counterRow=document.createElement('tr');
    stats.before(counters);counterRow.append(stats,negStats);counterBody.append(counterRow);counters.append(counterBody);
    stopButton.after(stopNegButton);
    stopNegButton.onclick=()=>stopAutoNeg('Auto-negocjacja zatrzymana. Trwająca negocjacja zostanie dokończona.');
    $('open-sectors').before(negPanel);
    function stopAutoNeg(message){
      clearTimeout(autoNegTimer);autoNegTimer=null;autoNegSector=null;stopNegButton.hidden=true;
      if(message)$('battle-feedback').textContent=message;paintOpenSectors();
    }
    function startNeg(id){
      if(negPending){if(autoNegSector!==null)stopAutoNeg('Negocjacja w toku.');return;}
      if(!battleReady){if(autoNegSector!==null)stopAutoNeg('Brak gotowego połączenia.');return;}
      const row=FoeModel.rows(battle,true).rows.find(r=>r.id===id&&r.until<=Date.now()/1000);
      if(!row){stopAutoNeg('Sektor nie jest już dostępny.');return;}
      negPending=crypto.randomUUID();negPendingSector=id;
      negPanel.style.display='block';negPanel.innerHTML='<em>Uruchamiam negocjację: '+row.sector+'…</em>';
      $('battle-feedback').textContent='Negocjacja: '+row.sector+'…';
      window.postMessage({channel:'foe-negotiate',token:negPending,provinceId:id},location.origin);
      paintOpenSectors();
    }
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin)return;
      const d=event.data;
      // Feedback wizualny w trakcie negocjacji.
      if(d?.channel==='foe-negotiate-started'&&d.token===negPending){
        const goodsStr=d.goods.join(', ');
        negPanel.innerHTML='<strong>Negocjacja w toku</strong><br>Towary: '+goodsStr+'<div id="neg-turns"></div>';
      }
      if(d?.channel==='foe-negotiate-turn'&&d.token===negPending){
        let div=negPanel.querySelector('#neg-turns');if(!div){div=document.createElement('div');div.id='neg-turns';negPanel.append(div);}
        const row=document.createElement('div');row.style.cssText='border-top:1px solid #1e3540;padding:4px 0;margin-top:4px';
        row.innerHTML='<small style="color:#90a5ad">Tura '+d.turn+':</small> '+d.guess.join(' · ');
        div.append(row);
      }
      if(d?.channel==='foe-negotiate-feedback'&&d.token===negPending){
        const div=negPanel.querySelector('#neg-turns');
        const lastRow=div?.lastElementChild;
        if(lastRow){
          const icons={correct:'✅',wrong_person:'🟡',not_needed:'❌'};
          const fb=d.feedback.map(s=>(s.slotId!=null?'['+s.slotId+']':'')+icons[s.state]||s.state).join(' ');
          lastRow.innerHTML+=`<br><small style="color:#aebfc4">${fb}</small>`;
          if(d.state==='won')lastRow.innerHTML+='<br><strong style="color:#7fc97f">✓ Wygrana!</strong>';
          else if(d.state==='out_of_turns')lastRow.innerHTML+='<br><strong style="color:#e06c6c">✗ Koniec tur</strong>';
        }
      }
      if(d?.channel==='foe-negotiate-result'&&d.token===negPending){
        negLastSector=negPendingSector;negLastUntil=Date.now()+1800;negLastOK=d.ok===true;
        negPending=null;negPendingSector=null;
        $('battle-feedback').textContent=d.message;
        if(typeof d.won==='boolean'){negDone++;if(d.won)negWins++;negStats.textContent='🤝 '+negWins+'/'+negDone;}
        if(d.ok&&d.refreshed){// progres odświeżony — model jest już zaktualizowany przez emit
        }
        if(autoNegSector!==null){
          if(!d.ok&&!d.won){stopAutoNeg(d.message);}
          else{
            const id=autoNegSector;
            const delay=(autoSettings.min+Math.random()*(autoSettings.max-autoSettings.min))*1000;
            autoNegTimer=setTimeout(()=>{if(autoNegSector===id)startNeg(id);},delay);
          }
        } else {
          // Jednorazowa negocjacja skończona — ukryj panel po chwili.
          setTimeout(()=>{if(!negPending)negPanel.style.display='none';},4000);
        }
        paintOpenSectors();
      }
    });
    function startFight(id){
      if(!battleReady||battlePending){if(autoSector!==null)stopAuto('Brak gotowego połączenia.');return;}
      const row=FoeModel.rows(battle,true).rows.find(r=>r.id===id&&r.until<=Date.now()/1000);
      if(!row){stopAuto('Sektor nie jest już dostępny.');return;}
      battlePending=crypto.randomUUID();battlePendingSector=id;
      $('battle-feedback').textContent=(battleWaveSector===id?'Kolejna fala: ':'Pobieranie i wymiana armii: ')+row.sector+'…';
      window.postMessage({channel:'foe-quick-battle',token:battlePending,provinceId:id,...(autoSector!==null?{reserve:autoSettings.reserve}:{})},location.origin);paintOpenSectors();
    }
    let battleReady=false,battlePending=null,battlePendingSector=null,battleLastSector=null,battleLastUntil=0,battleLastOK=false,battleWaveSector=null,battleReadyReason='Oczekiwanie na moduł połączenia. Przeładuj rozszerzenie i odśwież grę, jeśli komunikat nie znika.';
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin)return;
      const data=event.data;
      if(data?.channel==='foe-map-refresh-error')$('battle-feedback').textContent=data.message;
      if(data?.channel==='foe-battle-ready'){
        battleReady=data.ready===true;battleReadyReason=data.reason||'';
        const d=data.diagnostics;
        paintOpenSectors();
      }
      if(data?.channel==='foe-quick-battle-result'&&data.token===battlePending){
        battleLastSector=battlePendingSector;battleLastUntil=Date.now()+1800;battleLastOK=data.ok===true;
        battlePending=null;battlePendingSector=null;if(data.uncertain)battleReady=false;
        if(data.ok)battleWaveSector=data.nextWave?data.provinceId:null;
        $('battle-feedback').textContent=data.message;
        if(data.ok&&!data.nextWave&&typeof data.won==='boolean'){
          fights++;if(data.won)wins++;lossStreak=data.won?0:lossStreak+1;stats.textContent='🏆 '+wins+'/'+fights;
        }
        if(autoSector!==null){
          if(!data.ok||(!data.nextWave&&(!data.refreshed||typeof data.won!=='boolean')))stopAuto(data.message);
          else if(lossStreak>=3)stopAuto('Autoatak zatrzymany po 3 kolejnych porażkach.');
          else{
            const id=autoSector;
            const delay=(autoSettings.min+Math.random()*(autoSettings.max-autoSettings.min))*1000;
            autoTimer=setTimeout(()=>{if(autoSector===id)startFight(id);},delay);
          }
        }
        paintOpenSectors();
      }
    });
    window.postMessage({channel:'foe-battle-state-query'},location.origin);
    setInterval(()=>{if(!battleReady&&!battlePending)window.postMessage({channel:'foe-battle-state-query'},location.origin);},3000);
    function paintOpenSectors(){
      const list=$('open-sectors');list.replaceChildren();
      if(!battle){list.textContent='Otwórz mapę Pól Chwały w grze.';return;}
      const open=FoeModel.rows(battle,true).rows.filter(r=>r.until<=Date.now()/1000).sort((a,b)=>Number(a.ignored)-Number(b.ignored));
      if(!open.length){list.textContent='Brak otwartych sektorów sąsiadujących z naszymi polami.';return;}
      for(const row of open){
        const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #345058';
        if(row.ignored){line.style.background='rgba(190,45,45,0.16)';line.title='Prowincja oznaczona przez gildię jako ignorowana';}
        const name=document.createElement('span');name.textContent=row.color+' '+row.sector;name.style.flex='1';
        const progress=document.createElement('span');progress.textContent=row.progress+'/'+(row.maxProgress??'—');progress.title='Postęp przejęcia naszej gildii';
        const chance=document.createElement('span');chance.textContent='🔥 '+(row.gainAttritionChance===null?'—':row.gainAttritionChance+'%');chance.title='Szansa na wzrost oporu';

        // isAttackBattleType wybiera atak lub obronę, nie walkę lub negocjacje.
        // Obie akcje są dostępne; serwer potwierdza możliwość ich wykonania.
        const isBattle = false;
        const isNegOnly = false;

        const action=document.createElement('button');
        if(!isNegOnly){
          action.textContent=battlePendingSector===row.id?'⏳':battleLastSector===row.id&&Date.now()<battleLastUntil?(battleLastOK?'✅':'⚠️'):'⚔️';
          action.title=battlePendingSector===row.id?'Przetwarzanie żądania…':battleWaveSector===row.id?'Szybka walka — kolejna fala':'Wymień jednostki i rozpocznij szybką walkę';
          action.setAttribute('aria-label',action.title+' '+row.sector);
          action.setAttribute('aria-busy',String(battlePendingSector===row.id));
          action.disabled=!battleReady||!!battlePending||(battleWaveSector!==null&&battleWaveSector!==row.id)||autoSector!==null||autoNegSector!==null||negPending!==null;
          if(!battleReady)action.title=battleReadyReason;
          action.onclick=()=>startFight(row.id);
        } else {
          action.textContent='⚔️';action.disabled=true;action.title='Ten sektor wymaga negocjacji';
          action.style.display='none';
        }
        action.style.cssText='padding:5px;background:transparent;border-color:transparent;outline:none;font-size:14px;line-height:1;border-radius:0;margin-right:0';

        const auto=document.createElement('button');
        if(!isNegOnly){
          auto.textContent=autoSector===row.id?'⏹':'▶';auto.title=autoSector===row.id?'Zatrzymaj autoatak':'Autoatak na tym sektorze';
          auto.disabled=autoSector!==row.id&&(!battleReady||!!battlePending||autoSector!==null||autoNegSector!==null||negPending!==null||(battleWaveSector!==null&&battleWaveSector!==row.id));
          auto.onclick=()=>{if(autoSector===row.id){stopAuto('Autoatak zatrzymany.');return;}autoSector=row.id;lossStreak=0;stopButton.hidden=false;startFight(row.id);};
        } else {
          auto.style.display='none';
        }

        // --- Przyciski negocjacji (gdy isAttackBattleType !== true) ---
        const negBtn=document.createElement('button');
        const autoNegBtn=document.createElement('button');
        if(!isBattle){
          negBtn.textContent=negPendingSector===row.id?'⏳':negLastSector===row.id&&Date.now()<negLastUntil?(negLastOK?'✅':'⚠️'):'🤝';
          negBtn.title=negPendingSector===row.id?'Negocjacja w toku…':'Rozpocznij negocjację';
          negBtn.setAttribute('aria-label',negBtn.title+' '+row.sector);
          negBtn.setAttribute('aria-busy',String(negPendingSector===row.id));
          negBtn.disabled=!battleReady||negPending!==null||battlePending!==null||autoSector!==null||autoNegSector!==null;
          negBtn.style.cssText='padding:5px;background:transparent;border-color:transparent;outline:none;font-size:14px;line-height:1;border-radius:0';
          negBtn.onclick=()=>startNeg(row.id);

          autoNegBtn.textContent=autoNegSector===row.id?'⏹':'▶';
          autoNegBtn.title=autoNegSector===row.id?'Zatrzymaj auto-negocjację':'Auto-negocjacja na tym sektorze';
          autoNegBtn.disabled=autoNegSector!==row.id&&(!battleReady||negPending!==null||battlePending!==null||autoSector!==null||autoNegSector!==null);
          autoNegBtn.onclick=()=>{
            if(autoNegSector===row.id){stopAutoNeg('Auto-negocjacja zatrzymana.');return;}
            autoNegSector=row.id;stopNegButton.hidden=false;startNeg(row.id);
          };
        } else {
          negBtn.style.display='none';
          autoNegBtn.style.display='none';
        }

        line.append(name,progress,chance,action,auto,negBtn,autoNegBtn);list.append(line);
      }
    }
    setInterval(()=>paint(),1000);
    paint = () => {
      paintOpenSectors();
      checkSectorAlerts();
      $('export-battle').disabled=!battle;
      $('status').textContent =
        `Odebrano ${count} odpowiedzi. ${
          mapReady
            ? 'Mapa sąsiedztwa gotowa.'
            : 'Ładowanie mapy sąsiedztwa.'
        }`;

      $('methods').textContent =
        methods.join('\n') ||
        'Oczekiwanie na ruch gry';

      $('notice').textContent = notice;

      if (!battle) {
        output = '';
        $('list').textContent =
          'Otwórz mapę Pól Chwały w grze.';
        return;
      }

      const result = FoeModel.rows(
        battle,
        $('frontier').checked
      );

      output = result.rows
        .filter(row=>row.until>Date.now()/1000)
        .map(FoeModel.line)
        .join('\n');

      $('list').textContent =
        output ||
        'Brak sektorów do wyświetlenia.';

      if (!result.rows.length) {
        $('notice').textContent =
          result.warning;
      }
    };

    paintPearl = () => {
      const type=pearlType();
      const target=JSON.stringify([construction?.target,construction?.cityentity_id,construction?.level]);
      if(target!==totalTarget){totalTarget=target;$('pearl-total').value=pearlTotals.get(target)||'';}
      $('pearl-name').textContent=type?FoeModel.buildingLabel(type):'';
      syncNotes();
      const result = FoeModel.pearlAmounts(
        construction,
        $('multiplier').value,
        false
      );

      $('pearl-rows').replaceChildren();

      $('pearl-status').textContent =
        !result
          ? 'Wpisz przelicznik większy od 0 i nie większy niż 10 (do 4 miejsc po przecinku).'
          : !construction
            ? 'Otwórz perłę w grze.'
            : result.totalCost !== null
              ? 'Koszt poziomu: ' + result.totalCost + ' PR'
              : '';

      $('pearl-feedback').textContent = '';

      if (!result || !construction) return;

      const blockText=$('pearl-total').value.trim();
      const ownerPaid=FoePearls.ownerContribution(construction);
      const paidInfo=document.createElement('small');
      paidInfo.style.cssText='display:block;color:#a5b8bc;margin:6px 0';
      paidInfo.textContent=ownerPaid===null?'Wpłacono przez właściciela: brak danych — plan dopłat liczony od 0 PR.':'Wpłacono przez właściciela: '+ownerPaid+' PR';
      $('pearl-rows').append(paidInfo);
      const blocks=blockText!==''?FoePearls.lockStages(Number(blockText),result.rows,ownerPaid??0):null;
      let blockIndex=0;
      for (const row of result.rows) {
        const line = document.createElement('div');
        line.style.cssText =
          'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #345058';

        const label = document.createElement('span');
        label.style.flex = '1';
        label.textContent =
          'P' + row.rank + ' · ' +
          (row.base === null ? 'Brak PR' : row.base + ' PR');

        const block=blocks?.[blockIndex++];
        if(block!=null){
          const small=document.createElement('small');
          small.style.cssText='display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:11px;color:#a5b8bc;margin-top:3px';
          small.title='Dopłata właściciela na tym etapie. Uwzględnia odczytaną wpłatę właściciela oraz wykonanie wcześniejszych etapów P1 → P5. Wpłaty inwestorów zakładane według przelicznika.';
          const blockAmount=document.createElement('span');
          blockAmount.textContent='Dopłać: '+block.additional+' PR';
          const blockCopy=document.createElement('button');
          blockCopy.textContent='📋';blockCopy.title='Kopiuj dopłatę właściciela przed P'+row.rank;
          blockCopy.setAttribute('aria-label',blockCopy.title);
          blockCopy.style.cssText='padding:1px 3px;margin:0;min-width:0;font-size:10px;line-height:1.2';
          blockCopy.onclick=async()=>{
            try{await navigator.clipboard.writeText(String(block.additional));$('pearl-feedback').textContent='Skopiowano dopłatę przed P'+row.rank+': '+block.additional;}
            catch{$('pearl-feedback').textContent='Nie udało się skopiować.';}
          };
          const cumulative=document.createElement('span');cumulative.textContent='· łącznie '+block.cumulative+' PR';
          small.append(blockAmount,blockCopy,cumulative);
          label.append(small);
        }

        const amount = document.createElement('strong');
        amount.textContent = row.amount === null ? '—' : String(row.amount);

        const copy = document.createElement('button');
        copy.textContent = '📋';
        copy.title = 'Kopiuj';
        copy.disabled = row.amount === null;
        copy.setAttribute('aria-label', 'Kopiuj kwotę P' + row.rank);
        copy.style.padding = '4px 8px';
        copy.onclick = async () => {
          try {
            await navigator.clipboard.writeText(String(row.amount));
            $('pearl-feedback').textContent = 'Skopiowano P' + row.rank + ': ' + row.amount;
          } catch {
            $('pearl-feedback').textContent = 'Nie udało się skopiować.';
          }
        };

        line.append(label, amount, copy);
        $('pearl-rows').append(line);
      }

      // Wiersz wpłaty właściciela — tylko dla własnych perł
      const isOwnPearl =
        ownPlayerId &&
        construction.target?.playerId === ownPlayerId;

      const manualText=$('pearl-total').value.trim();
      if (isOwnPearl || manualText!=='') {
        const ownPearls = FoeModel.loadOwnPearls();
        const ownData = construction.cityentity_id
          ? ownPearls[construction.cityentity_id]
          : null;

        // Koszt poziomu: z ownPearls (bardziej aktualny) lub z construction
        const manualTotal=Number(manualText);
        const totalCost = manualText!=='' ? (Number.isSafeInteger(manualTotal)&&manualTotal>=0?manualTotal:null) : ownData?.forgePointsForLevelUp ?? result.totalCost;

        // Suma wpłat inwestorów = suma forge_points z rankings
        const investedSum = manualText!=='' ? result.rows.reduce((s,r)=>s+(r.amount??0),0) : construction.rankings
          ? construction.rankings.reduce((s, r) =>
              s + (Number.isSafeInteger(r.forge_points) ? r.forge_points : 0), 0)
          : 0;

        const ownerAmount = totalCost !== null
          ? Math.max(0, totalCost - investedSum)
          : null;

        const ownerLine = document.createElement('div');
        ownerLine.style.cssText =
          'display:flex;align-items:center;gap:10px;padding:10px 8px;background:#152d35;border-radius:6px;margin-top:8px';

        const ownerLabel = document.createElement('span');
        ownerLabel.style.flex = '1';
        ownerLabel.textContent = 'Wpłata właściciela';

        const ownerAmount_ = document.createElement('strong');
        ownerAmount_.textContent = ownerAmount !== null ? String(ownerAmount) : '—';

        const ownerCopy = document.createElement('button');
        ownerCopy.textContent = '📋';
        ownerCopy.title = 'Kopiuj';
        ownerCopy.disabled = ownerAmount === null;
        ownerCopy.setAttribute('aria-label', 'Kopiuj wpłatę właściciela');
        ownerCopy.style.padding = '4px 8px';
        ownerCopy.onclick = async () => {
          try {
            await navigator.clipboard.writeText(String(ownerAmount));
            $('pearl-feedback').textContent = 'Skopiowano wpłatę właściciela: ' + ownerAmount;
          } catch {
            $('pearl-feedback').textContent = 'Nie udało się skopiować.';
          }
        };

        ownerLine.append(ownerLabel, ownerAmount_, ownerCopy);
        $('pearl-rows').append(ownerLine);
      }
    };

    let collectPending=null;const attemptedCollections=new Map();let collectFeedback='';
    const cityNamesKey='foe-companion.customBuildingNames';
    function readCityNames(){try{const value=JSON.parse(localStorage.getItem(cityNamesKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
    window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-collect-result'||event.data.token!==collectPending)return;collectPending=null;collectFeedback=event.data.message;paintCity();});
    setInterval(()=>paintCity(),1000);
    paintCity = () => {
      // Live timers and network updates must not replace an input being edited.
      if(root.activeElement?.matches('input[data-building-name]'))return;
      const customNames=readCityNames();
      const rows = FoeModel.cityRows();
      const statusEl = $('city-status');
      const listEl = $('city-list');

      if (!rows.length) {
        statusEl.textContent = 'Brak budynków z aktywnym timerem.';
        listEl.replaceChildren();
        return;
      }

      statusEl.textContent = collectFeedback;
      listEl.replaceChildren();

      const fmt = ts => new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(ts * 1000);

      for (const b of rows) {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:baseline;gap:8px;padding:5px 0;border-bottom:1px solid #243d45';

        const time = document.createElement('span');
        time.style.cssText = 'min-width:42px;color:#f1d69a;font-variant-numeric:tabular-nums';
        time.textContent = b.ready?'Gotowe':b.until?fmt(b.until):'—';
        const collectionTime=b.raw.state?.next_state_transition_at||b.until;
        const titleTime=collectionTime>0&&collectionTime!==2147483647?new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(collectionTime*1000):(b.ready?'Gotowe':'Brak godziny zbioru');
        row.title=titleTime+' | '+b.tooltip;

        const name = document.createElement('span');
        name.style.cssText='flex:1;min-width:0;display:flex;align-items:baseline;gap:4px';
        const nameInput=document.createElement('input');
        nameInput.type='text';nameInput.dataset.buildingName=b.ceid;nameInput.maxLength=150;
        nameInput.value=typeof customNames[b.ceid]==='string'?customNames[b.ceid]:b.name;
        nameInput.placeholder=b.name;
        nameInput.setAttribute('aria-label','Własna nazwa budynku: '+b.name);
        nameInput.title=row.title;
        nameInput.style.cssText='background:transparent;border:1px solid transparent;outline:1px solid transparent;box-shadow:none;color:inherit;font:inherit;padding:0;min-width:0;width:100%;flex:1';
        nameInput.addEventListener('input',()=>{
          const names=readCityNames(),value=nameInput.value.trim();
          if(value)Object.defineProperty(names,b.ceid,{value,enumerable:true,configurable:true,writable:true});else delete names[b.ceid];
          try{
            localStorage.setItem(cityNamesKey,JSON.stringify(names));
            for(const other of $('city-list').querySelectorAll('input[data-building-name]'))if(other!==nameInput&&other.dataset.buildingName===b.ceid)other.value=value||other.placeholder;
          }catch{$('city-status').textContent='Nie udało się zapisać nazwy. Skopiuj ją przed zamknięciem.';}
        });
        nameInput.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();nameInput.blur();}});
        nameInput.addEventListener('blur',()=>setTimeout(paintCity,0));
        name.append(nameInput);

        if (b.level !== null) {
          const lvl = document.createElement('small');
          lvl.style.cssText = 'color:#90a5ad;font-size:11px;white-space:nowrap;flex-shrink:0';
          lvl.textContent = '';
          name.append(' ', lvl);
        }

        const controls=document.createElement('span');controls.style.cssText='margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0';
        const star=document.createElement('span');star.textContent='⭐';star.style.cssText=b.motivated?'':'filter:grayscale(1);opacity:.35';star.title=b.motivated?'Zmotywowany / odrestaurowany':'Niezmotywowany / nieodrestaurowany';
        const collect=document.createElement('button');collect.textContent='🤲';collect.title=b.ready?'Zbierz produkcję':'Produkcja jeszcze niegotowa';collect.setAttribute('aria-label','Zbierz: '+b.name);
        const stamp=JSON.stringify(b.raw.state);collect.disabled=!b.ready||!!collectPending||attemptedCollections.get(b.id)===stamp;
        collect.style.opacity=collect.disabled?'0.2':'1';
        collect.onclick=()=>{if(collectPending)return;collectPending=crypto.randomUUID();attemptedCollections.set(b.id,stamp);collectFeedback='Zbieranie: '+b.name+'…';window.postMessage({channel:'foe-collect',token:collectPending,entityId:b.id},location.origin);paintCity();};
        controls.append(star,collect);row.append(time, name,controls);
        listEl.append(row);
      }
    };

    $('multiplier').oninput = () => {
      localStorage.setItem(LS_MULTIPLIER, $('multiplier').value);
      paintPearl();
    };

    paintPearl();
    paintCity();

    $('frontier').onchange =
      paint;

    $('auto-open').onchange = () => {
      localStorage.setItem(LS_AUTO_OPEN, $('auto-open').checked ? '1' : '0');
    };

    $('auto-open-gbg').onchange = () => {
      localStorage.setItem(LS_AUTO_OPEN_GBG, $('auto-open-gbg').checked ? '1' : '0');
    };

    $('auto-copy').onchange = () => {
      localStorage.setItem(LS_AUTO_COPY, $('auto-copy').checked ? '1' : '0');
    };

    $('copy').onclick = async () => {
      paint();
      try {
        if (!output) return;

        await navigator.clipboard.writeText(
          output
        );

        $('feedback').textContent =
          'Skopiowano.';
      } catch {
        $('feedback').textContent =
          'Zaznacz i skopiuj listę ręcznie.';
      }
    };

    $('export-battle').onclick = () => {
      if(!battle)return;
      const blob=new Blob([JSON.stringify({requestClass:'GuildBattlegroundStateService',requestMethod:'getState',responseData:battle},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='foe-pola-'+String(battle.map?.id||'mapa').replace(/[^a-z0-9_-]/gi,'_')+'.json';
      root.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      $('feedback').textContent='Wyeksportowano ostatnio odebrany stan mapy.';
    };

    paint();
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      mount,
      { once: true }
    );
  } else {
    mount();
  }
})();
