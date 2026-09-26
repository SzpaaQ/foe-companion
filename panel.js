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
    openGbgPanel();
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
          border-radius: 8px;
          border-top-right-radius: 0px;
          border-bottom-right-radius: 0px;
          padding: 8px 12px
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
          <button id="export-battle" disabled>Pobierz stan mapy JSON</button>

          <p id="feedback"></p>
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

          <h2>Diagnostyka</h2>

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
    const formatResources=r=>`🪙 ${r.guild_raids_money.toLocaleString('pl-PL')}   🔨 ${r.guild_raids_supplies.toLocaleString('pl-PL')}   ⏳ ${r.guild_raids_chrono_alloy.toLocaleString('pl-PL')}`;
    const formatTime=t=>new Date(t*1000).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    paintQuantum=()=>{
      const summary=quantumTracker.summary();$('quantum-summary').replaceChildren();$('quantum-groups').replaceChildren();
      const text=(parent,value,tag='p',className='')=>{const node=document.createElement(tag);node.textContent=value;node.className=className;parent.append(node);return node;};
      if(!summary){text($('quantum-summary'),'Otwórz osadę kwantową w grze.');return;}
      text($('quantum-summary'),'Na pełny zbiór','small');
      text($('quantum-summary'),formatResources(summary.totals),'p','quantum-resources');
      text($('quantum-summary'),`⚡ ${summary.actionsPerHour.toLocaleString('pl-PL')} działań/h · ⚔️ ${(summary.actionsPerHour/3500).toLocaleString('pl-PL',{maximumFractionDigits:2})} walk/h`);
      text($('quantum-summary'),'Przy koszcie 3500 działań za walkę; baza 5000 działań/h + budynki.');
      text($('quantum-summary'),'Prognoza po jednym zbiorze z każdego produkującego budynku, przy obecnym układzie.');
      if(summary.missing.length)text($('quantum-summary'),`Niepełne dane: brakuje definicji ${summary.missing.length} budynków. Wynik jest częściowy.`);
      if(summary.bonuses.unhappy)text($('quantum-summary'),'Zadowolenie poniżej populacji — prognoza nie uwzględnia kary za niezadowolenie.');
      const wallet=FoeQuantum.KEYS.every(k=>typeof summary.wallet[k]==='number');
      if(wallet)text($('quantum-summary'),'Zapasy: '+formatResources(summary.wallet));
      if(summary.raid?.name)text($('quantum-summary'),`${summary.raid.name} · trudność ${summary.raid.difficulty??'—'}`);
      if(summary.raid?.endsAt)text($('quantum-summary'),'Koniec najazdu: '+formatTime(summary.raid.endsAt));
      text($('quantum-summary'),`Przy ostatnim zbiorze: ${summary.bonuses.euphoria?'euforia 150%':'bez euforii'} · bonus monet +${summary.bonuses.coins}% · młotków +${summary.bonuses.supplies}%`);
      for(const group of summary.groups){
        const box=document.createElement('div');box.className='quantum-group';$('quantum-groups').append(box);
        text(box,group.at<=Date.now()/1000?'Gotowe do zbioru':formatTime(group.at),'strong');
        text(box,formatResources(group.production));
        const details=document.createElement('details'),label=document.createElement('summary');label.textContent=`Budynki (${group.items.length})`;details.append(label);box.append(details);
        for(const item of FoeQuantum.groupedBuildings(group.items))text(details,`${item.count}× ${item.name} · ${formatResources(item.production)}`);
      }
      if(summary.builds.length)text($('quantum-groups'),`W budowie (bez zbioru w prognozie): ${summary.builds.map(b=>b.name+(b.at?' — '+formatTime(b.at):'')).join(', ')}`);
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

    paint = () => {
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

      for (const row of result.rows) {
        const line = document.createElement('div');
        line.style.cssText =
          'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #345058';

        const label = document.createElement('span');
        label.style.flex = '1';
        label.textContent =
          'P' + row.rank + ' · ' +
          (row.base === null ? 'Brak PR' : row.base + ' PR');

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

    paintCity = () => {
      const rows = FoeModel.cityRows();
      const statusEl = $('city-status');
      const listEl = $('city-list');

      if (!rows.length) {
        statusEl.textContent = 'Brak budynków z aktywnym timerem.';
        listEl.replaceChildren();
        return;
      }

      statusEl.textContent = '';
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
        time.textContent = fmt(b.until);

        const name = document.createElement('span');
        name.style.flex = '1';
        name.textContent = b.name;

        if (b.level !== null) {
          const lvl = document.createElement('small');
          lvl.style.cssText = 'color:#90a5ad;font-size:11px';
          lvl.textContent = 'poz. ' + b.level;
          name.append(' ', lvl);
        }

        row.append(time, name);
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
