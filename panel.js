(() => {
  'use strict';

  let battle = null,
    count = 0,
    output = '',
    paint = () => {},
    notice = '',
    mapReady = false;

  const methods = [];
  let playerAttrition=null,paintAttrition=()=>{};
  function readPlayerAttrition(responses){
    let value;
    for(const response of responses){
      if(response?.requestClass!=='GuildBattlegroundService')continue;
      const data=response.responseData;
      const participant=response.requestMethod==='getBattleground'?data?.currentPlayerParticipant:response.requestMethod==='getPlayerParticipant'?data:null;
      const attrition=participant?.attrition;
      if(attrition?.__class__!=='GuildBattlegroundAttrition')continue;
      const level=attrition.level??0;
      if(Number.isSafeInteger(level)&&level>=0)value=level;
    }
    return value;
  }

  let construction = null,
    paintPearl = () => {},
    paintCity = () => {};

  let ownPlayerId = null;
  fetch(chrome.runtime.getURL('building-fp-types.json')).then(r=>r.json()).then(types=>{for(const [id,fp] of Object.entries(types))FoeModel.seedProductionType(id,fp);paintCity();}).catch(()=>{});
  const metadataNamesKey='foe-companion.metadataBuildingNames';
  let metadataNames={};
  try{const stored=JSON.parse(localStorage.getItem(metadataNamesKey)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))metadataNames=stored;}catch{}
  for(const [id,name] of Object.entries(metadataNames))if(/^[A-Z]+_[A-Za-z0-9_]+$/.test(id)&&typeof name==='string')FoeModel.seedName(id,name);

  const pearlTracker = FoePearls.createTracker();
  const quantumTracker = FoeQuantum.createTracker();
  const quantumHistory = FoeQuantumHistory.create();
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
  if(channel==='foe-building-names'){
    let changed=false;
    for(const item of Array.isArray(event.data.names)?event.data.names:[]){
      if(!item||typeof item.id!=='string'||!/^[A-Z]+_[A-Za-z0-9_]+$/.test(item.id)||typeof item.name!=='string'||!item.name.trim())continue;
      if(item.producesFP===true){FoeModel.seedProductionType(item.id,true);changed=true;}
      const name=item.name.trim();if(metadataNames[item.id]===name)continue;
      metadataNames[item.id]=name;FoeModel.seedName(item.id,name);changed=true;
    }
    if(changed){try{localStorage.setItem(metadataNamesKey,JSON.stringify(metadataNames));}catch{}paintCity();paintPearl();}
    return;
  }

  // --- foe-companion-v1: dane gry ---
  if (channel !== 'foe-companion-v1') return;

  count++;

  const data = event.data.data;
  const responses = Array.isArray(data) ? data : [data];
  if(FoeModel.updateCollectionBonuses(data))paintCity();
  const attrition=readPlayerAttrition(responses);
  if(attrition!==undefined){playerAttrition=attrition;paintAttrition();}

  // Uzupełniaj słownik nazw ze wszystkich odpowiedzi
  FoeModel.learnNames(data);
  const quantumBefore=quantumTracker.map?{map:quantumTracker.map,summary:quantumTracker.summary()}:null;
  quantumTracker.consume(data);
  if(quantumTracker.map&&quantumBefore?.map!==quantumTracker.map)quantumHistory.observe(data,quantumBefore,{map:quantumTracker.map,summary:quantumTracker.summary()});
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
              v.${(chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version)}
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
          <button role="tab" data-page="nego" id="nego-tab" aria-selected="false" title="Negocjacje poza Polami Chwały" hidden>🤝 Nego</button>
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

          <p id="pearl-status" style="font-size:11px">
            Otwórz perłę w grze.
          </p>

          <div id="pearl-rows"></div>

          <small>

          </small>

          <p id="pearl-feedback" style="font-size:11px"></p>
          <p style="font-size:10px;color:#7a9099;margin-top:6px">Po wpłacie z panelu stan PR na perle w grze może nie być widoczny do czasu kolejnej akcji. Aby odświeżyć: wpłać dodatkowe 1 PR, poczekaj na wpłatę innej osoby lub odśwież stronę.</p>
        </section>

        <section
          id="gbg"
          role="tabpanel"
          hidden
        >
          <div id="gbg-title"><h2>Pola Chwały</h2></div>

          <div id="open-sectors-heading" style="display:flex;align-items:center;gap:6px"><h3>Otwarte sektory</h3><button id="copy-open" title="Kopiuj otwarte sektory" aria-label="Kopiuj otwarte sektory" style="background:transparent;border:0;box-shadow:none;margin:0;padding:0;min-width:0;line-height:1;cursor:pointer">📋</button></div>
          <div id="open-sectors"></div>
          <p id="battle-feedback" role="status"></p>

          <div id="schedule-heading"><h3>Rozpiska</h3><label><input id="frontier" type="checkbox" checked> tylko sąsiedzi</label></div>

          <p id="notice"></p>

          <pre id="list">
Otwórz mapę Pól Chwały w grze.
          </pre>

          <button id="copy">
            Kopiuj rozpiskę
          </button>
          <button id="export-battle" disabled style="display:none">Pobierz stan mapy JSON</button>

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
          <details id="settings-general" open><summary>Ustawienia</summary>
          <details id="settings-pearls" open><summary>Perły</summary>

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

          <label><input id="auto-copy" type="checkbox" checked> Kopiuj kwotę (klawisze 1–5)</label>
          </details><details id="settings-open" open><summary>Wysuwaj panel</summary>
          <div class="settings-open">
            <label><input id="auto-open" type="checkbox" checked> Otwarcie perły</label>
            <label><input id="auto-open-gbg" type="checkbox" checked> Pola Chwały</label>
            <label><input id="auto-open-quantum" type="checkbox" checked> Osada kwantowa</label>
            <label><input id="auto-open-nego" type="checkbox" checked> Negocjacje</label>
          </div>
          </details></details>
          <details id="settings-gbg" open><summary>Pola chwały</summary>
          <div class="settings-alert">
            <label><input id="gbg-sound-enabled" type="checkbox"> Alert</label>
            <select id="gbg-sound-kind" aria-label="Sygnał alertu"><option value="classic">Trzy piknięcia</option><option value="ding">Ding-dong</option><option value="single">Pojedynczy</option><option value="melody">Melodyjka</option><option value="alarm">Alarm</option></select>
            <input id="gbg-sound-minutes" type="number" min="1" max="60" step="1" value="2" aria-label="Wyprzedzenie w minutach" title="Wyprzedzenie alertu (minuty)"><span>min</span>
            <button id="gbg-sound-test" title="Odsłuch sygnału" aria-label="Odsłuch sygnału">▶</button>
          </div>
          <div id="gbg-automation-settings"></div>
          </details>

          <details id="changelog"><summary>Changelog · ${(chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version)}</summary><div style="max-height:240px;overflow-y:auto;font-size:11px;line-height:1.45"><p><strong>0.5.02</strong></p><ul><li>🏁 Wyścig: sąsiedztwo konkurencyjnej gildii w powiadomieniu i rozpisce do 30 minut przed otwarciem.</li><li>Wyłączone wpłaty PR z panelu oraz negocjacje poza Polami Chwały.</li><li>Kategoria PR korzysta także z definicji produkcji: widoczne niezmotywowane Emporium Solary i oba egzemplarze Elizejskiego Młyna; obsługa losowej produkcji PR.</li><li>Pełniejsza lista budynków: widoczne nieaktywne produkcje, nowe budynki i osobne egzemplarze; kategorie PR i wojska niezależne od motywacji.</li><li>Zbiory: domyślna karta Ulubione, zapis wybranych budynków i przyciski dodawania/usuwania.</li><li>Zbierz wszystkie w każdej podzakładce: jedno zbiorcze żądanie dla gotowych budynków wybranej kategorii i osobna kontrola wyniku każdego zbioru.</li><li>Potwierdzenie zbioru wymaga zmiany stanu budynku; brak fałszywego sukcesu przy odrzuconym zbiorze.</li></ul><p><strong>0.5.01</strong></p><ul><li>Przeładowanie karty gry przez nowy proces rozszerzenia po aktualizacji.</li><li>Serwer deweloperski: status połączenia klienta, przekazania wersji i braku zapytań zamiast deklaracji wykonanego odświeżenia.</li></ul><p><strong>0.5.0</strong></p><ul><li>Zbiory: aktywne bonusy podwojenia i zaopatrzenia wraz z pozostałymi użyciami z odpowiedzi gry.</li><li>Zwijane ustawienia z pamięcią, wyrównane pola i wyraźne nagłówki.</li><li>Powiadomienia sektorów przy przycisku panelu: odliczanie, zamykanie i automatyczne ukrywanie.</li><li>Perły: zaniżone wpłaty zastępowane pełną kwotą inwestora, uwzględnienie przesunięć rankingu i kontrola przed wpłatą.</li><li>Zbiory: karty PR, pereł, wojska i pozostałych; oznaczenia gotowych zbiorów.</li><li>Nazwy budynków przechwytywane z metadanych gry; poprawiony przycisk resetowania nazw i tooltip.</li><li>Ustawiany zakres przerwy między turami negocjacji.</li><li>Opcje Pól Chwały przeniesione z diagnostyki; godziny w logach serwera deweloperskiego.</li><li>Pełna historia wersji w przewijalnym changelogu. Poprawione ładowanie modułu pereł w panelu i skrypcie gry.</li></ul><p><strong>0.4.22</strong> · status autonegocjacji w osobnej linii pod przyciskami</p>
<p><strong>0.4.21</strong> · automatyczna aktualizacja soli podpisu z pliku JS gry</p>
<p><strong>0.4.20</strong> · aktualizacja soli podpisu do wersji gry 1.345</p>
<p><strong>0.4.19</strong> · separatory między sekcjami kwantowymi</p>
<p><strong>0.4.18</strong> · zbiory kwantowe — domyślnie zwinięte, stan zachowany przy odświeżaniu danych</p>
<p><strong>0.4.17</strong> · zbiory kwantowe — wsp&#243;lny grid 4-kolumnowy wyr&#243;wnany z zestawieniem</p>
<p><strong>0.4.16</strong> · zestawienie pozostałych budynk&#243;w kwantowych z dynamicznymi kolumnami efekt&#243;w</p>
<p><strong>0.4.15</strong> · ukrycie zakładki Inne (automisje) — ostrożność po ostrzeżeniu</p>
<p><strong>0.4.14</strong> · potwierdzenie wpłaty perły — emoji check, mniejszy font, bez drugiego zdania</p>
<p><strong>0.4.13</strong> · podsumowanie nagr&#243;d po automisji — grupowanie i sumowanie</p>
<p><strong>0.4.12</strong> · nagroda w logu misji + emoji zamiast Abort</p>
<p><strong>0.4.11</strong> · fix misji powtarzalnych — osobne żądanie getPlayerResourceBag</p>
<p><strong>0.4.10</strong> · odbi&#243;r nagrody misji-negocjacji + przycisk Następna misja</p>
<p><strong>0.4.9</strong> · zakładka Inne + automisje powtarzalne</p>
<p><strong>0.4.8</strong> · przycisk &#39;Resetuj nazwy&#39; w Zbiorach + info o odświeżeniu perły</p>
<p><strong>0.4.7</strong> · potwierdzenie wpłaty perły znika po chwili + info o widoku gry</p>
<p><strong>0.4.6</strong> · rozpoznawanie nazw budynk&#243;w z zestaw&#243;w wyboru (cityEntityId)</p>
<p><strong>0.4.5</strong> · zbiory miejskie — tooltip emoji bez tekstu, ciaśniejsza lista</p>
<p><strong>0.4.4</strong> · zestawienie budynk&#243;w kwantowych po zbiorach</p>
<p><strong>0.4.3</strong> · zbiory kwantowe — produkcja do prawej, pogrubione godziny i liczebności</p>
<p><strong>0.4.2</strong> · tooltipy budynk&#243;w kwantowych — produkcja z emoji, 1 linia na pozycję</p>
<p><strong>0.4.1</strong> · perły, negocjacje misji, uzycie w polu chwały, testy</p><p><strong>0.3.0</strong> · Pierwsza wersja w historii Git: panel, perły, Pola Chwały i osada kwantowa. Kolejne poprawki tej wersji: solver i zamykanie negocjacji, obsługa brakujących towarów, rezerwa walk tylko w automacie, odblokowanie po invalid wave, sortowanie sektorów, stabilny układ, rozpiska do 100 px, zwijane notatki i komunikaty.</p></div></details>
          <details id="diagnostics"><summary id="diagnostics-heading">Diagnostyka</summary>

          <small>
            Wersja ${(chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version)} · odczyt gry
            <span id="quantum-calculation-version"></span>
          </small>

          <p id="status"></p>

          <pre id="methods"></pre>

          <p>
            Tryb developerski: uruchom START-DEV.cmd
            w folderze projektu. Zapis kodu przeładuje
            rozszerzenie i kartę gry. Zamknij skrypt,
            aby wyłączyć.
          </p></details>
        </section>
      </aside>
    `;

    const $ = id => root.getElementById(id);
    const sectorStatus=document.createElement('p');sectorStatus.id='gbg-sound-status';sectorStatus.setAttribute('role','status');
    $('open-sectors-heading').before(sectorStatus);
    const sectorPopup=document.createElement('div');sectorPopup.id='sector-popup';sectorPopup.hidden=true;
    sectorPopup.innerHTML='<div id="sector-popup-header"><strong id="sector-popup-title">Wkrótce otwarcie</strong><button id="sector-popup-copy" aria-label="Kopiuj widoczne sektory" data-tooltip="Kopiuj widoczne sektory">📋</button><button id="sector-popup-close" aria-label="Zamknij powiadomienia sektorów">×</button></div><div id="sector-popup-list"></div>';
    root.append(sectorPopup);
    $('sector-popup-copy').onclick=async()=>{
      const button=$('sector-popup-copy'),text=$('sector-popup-list').textContent;
      if(!text)return;
      try{await navigator.clipboard.writeText(text);button.textContent='✓';button.dataset.tooltip='Skopiowano sektory';}
      catch{button.textContent='!';button.dataset.tooltip='Nie udało się skopiować sektorów';}
      setTimeout(()=>{button.textContent='📋';button.dataset.tooltip='Kopiuj widoczne sektory';},1500);
    };
    const negoSection=document.createElement('section');negoSection.id='nego';negoSection.hidden=true;negoSection.setAttribute('role','tabpanel');
    negoSection.innerHTML='<h2>Negocjacje</h2><p id="standalone-kind"></p><button id="standalone-start" disabled>🤝 Negocjuj</button><p id="standalone-status" role="status" style="height:32px;font-size:12px">Otwórz negocjację w grze.</p><div id="standalone-history" style="max-height:300px;overflow:auto;font-size:12px"></div>';
    root.querySelector('aside').append(negoSection);

    // Zakładka Inne — tymczasowo ukryta
    const inneTab=document.createElement('button');inneTab.dataset.page='inne';inneTab.setAttribute('role','tab');inneTab.setAttribute('aria-selected','false');inneTab.title='Inne';inneTab.setAttribute('aria-label','Inne');inneTab.textContent='🧩';
    inneTab.hidden=true;
    root.querySelector('nav').insertBefore(inneTab,root.querySelector('[data-page="settings"]'));
    const inneSection=document.createElement('section');inneSection.id='inne';inneSection.hidden=true;inneSection.setAttribute('role','tabpanel');
    inneSection.innerHTML=`
      <h2>Inne</h2>
      <h3>Misje powtarzalne</h3>
      <div style="font-size:12px;color:#a5b8bc;margin-bottom:8px">
        Wykonuje misje powtarzalne wymagające wpłaty monet lub zaopatrzenia.<br>
        Pomija misje z innymi warunkami. Zatrzymuje się gdy brakuje zasobów.
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <label style="font-size:12px">🪙 min zapas <input id="quest-min-money" type="number" min="0" step="1000" value="50000" style="width:90px;padding:3px 5px;margin-left:4px" aria-label="Minimalny zapas monet"></label>
        <label style="font-size:12px">🔨 min zapas <input id="quest-min-supplies" type="number" min="0" step="1000" value="50000" style="width:90px;padding:3px 5px;margin-left:4px" aria-label="Minimalny zapas zaopatrzenia"></label>
      </div>
      <button id="quest-auto-start">▶ Wykonuj misje</button>
      <button id="quest-auto-stop" disabled>⏹ Zatrzymaj</button>
      <p id="quest-auto-status" role="status" style="font-size:12px;min-height:18px;margin-top:6px"></p>
      <div id="quest-auto-log" style="max-height:200px;overflow:auto;font-size:11px;color:#a5b8bc;margin-top:4px"></div>
      <div id="quest-auto-rewards" style="display:none;margin-top:6px;padding:4px 6px;background:#1a2a2a;border-radius:4px;font-size:11px;color:#c8e0e0"></div>
    `;
    root.querySelector('aside').append(inneSection);

    // Ustawienia automisji z localStorage
    const LS_QUEST_MONEY='foe-companion.questMinMoney',LS_QUEST_SUPPLIES='foe-companion.questMinSupplies';
    const loadQuestSettings=()=>{
      const m=Number(localStorage.getItem(LS_QUEST_MONEY));const s=Number(localStorage.getItem(LS_QUEST_SUPPLIES));
      if(m>=0)$('quest-min-money').value=m;if(s>=0)$('quest-min-supplies').value=s;
    };
    loadQuestSettings();
    $('quest-min-money').onchange=()=>localStorage.setItem(LS_QUEST_MONEY,$('quest-min-money').value);
    $('quest-min-supplies').onchange=()=>localStorage.setItem(LS_QUEST_SUPPLIES,$('quest-min-supplies').value);

    let questAutoRunning=false,questAutoToken=null;
    const questLog=msg=>{const line=document.createElement('div');line.textContent=msg;$('quest-auto-log').append(line);line.scrollIntoView?.({block:'nearest'});};
    const questStatus=msg=>$('quest-auto-status').textContent=msg;
    // Grupowanie nagród wg typu — emoji na podstawie subType/iconAssetName
    const rewardEmoji=key=>{
      if(/money|coin/i.test(key))return'🪙';
      if(/supplies|supply/i.test(key))return'🔨';
      if(/strategy|forgepoint|fp/i.test(key))return'🔵';
      if(/good|wire|lumber|marble|ebony|granite|cloth|dye|iron/i.test(key))return'📦';
      if(/gem|klejnot|diamond/i.test(key))return'💎';
      if(/medal/i.test(key))return'🏅';
      if(/fragment/i.test(key))return'🧩';
      if(/ally|sojuszni/i.test(key))return'⚔️';
      return'🎁';
    };
    const renderQuestRewards=rewards=>{
      const el=$('quest-auto-rewards');
      el.replaceChildren();
      const header=document.createElement('div');
      header.textContent='Zdobyte nagrody:';
      header.style.cssText='font-weight:bold;margin-bottom:4px;color:#8fcfcf';
      el.append(header);
      for(const [key,{name,amount}] of Object.entries(rewards)){
        const row=document.createElement('div');
        const emoji=rewardEmoji(key);
        // Wyodrębnij samą nazwę bez liczby (serwer podaje np. "66 500 Monet")
        const label=name.replace(/^\d[\d\s]*/,'').trim()||key;
        row.textContent=`${emoji} ${amount.toLocaleString('pl-PL')} ${label}`;
        el.append(row);
      }
      el.style.display='block';
    };

    $('quest-auto-start').onclick=()=>{
      if(questAutoRunning)return;
      questAutoRunning=true;questAutoToken='quest-auto-'+Date.now();
      $('quest-auto-start').disabled=true;$('quest-auto-stop').disabled=false;
      $('quest-auto-log').replaceChildren();$('quest-auto-rewards').style.display='none';$('quest-auto-rewards').replaceChildren();questStatus('Uruchamiam…');
      const minMoney=Math.max(0,Number($('quest-min-money').value)||0);
      const minSupplies=Math.max(0,Number($('quest-min-supplies').value)||0);
      window.postMessage({channel:'foe-quest-auto',token:questAutoToken,minMoney,minSupplies},location.origin);
    };
    $('quest-auto-stop').onclick=()=>{
      questAutoRunning=false;questAutoToken=null;
      $('quest-auto-start').disabled=false;$('quest-auto-stop').disabled=true;questStatus('Zatrzymano.');
      window.postMessage({channel:'foe-quest-auto-stop'},location.origin);
    };
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin)return;
      const d=event.data;
      if(d?.channel==='foe-quest-auto-update'&&d.token===questAutoToken){
        questStatus(d.status||'');
        if(d.log)questLog(d.log);
        if(d.done){
          questAutoRunning=false;questAutoToken=null;$('quest-auto-start').disabled=false;$('quest-auto-stop').disabled=true;
          if(d.rewards&&Object.keys(d.rewards).length)renderQuestRewards(d.rewards);
        }
      }
    });
    const negoOpenKey='foe-companion.autoOpenNego';
    $('auto-open-nego').checked=localStorage.getItem(negoOpenKey)!=='0';
    $('auto-open-nego').onchange=()=>localStorage.setItem(negoOpenKey,$('auto-open-nego').checked?'1':'0');
    let standaloneToken=null,standaloneGame=null;
    const appendNego=text=>{const line=document.createElement('p');line.textContent=text;$('standalone-history').append(line);line.scrollIntoView?.({block:'nearest'});};
    const feedbackText=slots=>slots.map(s=>`[${(s.slotId??0)+1}] ${s.resourceId} ${s.state==='correct'?'✅':s.state==='wrong_person'?'🟡':'❌'}`).join(' · ');
    $('standalone-start').onclick=()=>{
      if(standaloneToken||!standaloneGame)return;
      standaloneToken='open-nego-'+Date.now();$('standalone-start').disabled=true;$('standalone-history').replaceChildren();$('standalone-status').textContent='Status: odczyt negocjacji…';
      window.postMessage({channel:'foe-open-negotiate',token:standaloneToken,turnDelay:negTurnSettings},location.origin);
    };
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin)return;
      const d=event.data;
      if(d?.channel==='foe-open-negotiation'){
        return; // Negotiations outside battlegrounds are disabled.
        standaloneGame=d.game;
        if(d.game){
          $('nego-tab').hidden=true;$('standalone-kind').textContent=d.game.context==='quest'?'Misja':`Negocjacja: ${d.game.context}`;
          if(!standaloneToken)$('standalone-status').textContent='Status: ready';
          if(d.detected&&$('auto-open-nego').checked){
            root.querySelector('aside').classList.add('open');
            root.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.page==='nego')));
            root.querySelectorAll('aside>section').forEach(s=>s.hidden=s.id!=='nego');syncNotes();
          }
        }else if(!standaloneToken)$('standalone-status').textContent=d.reason||'Brak aktywnej negocjacji.';
        $('standalone-start').disabled=!!standaloneToken||!standaloneGame;
      }
      if(!standaloneToken||d?.token!==standaloneToken)return;
      if(d.channel==='foe-open-nego-started'){
        appendNego('Towary: '+d.goods.join(', '));
        d.history.forEach((t,i)=>appendNego(`Tura ${i+1}: ${feedbackText(t.slots||[])}`));
      }
      if(d.channel==='foe-open-nego-turn'){$('standalone-status').textContent=`Status: ${d.turn} tura`;appendNego(`Tura ${d.turn}: ${d.guess.join(' · ')}`);}
      if(d.channel==='foe-open-nego-feedback')appendNego(feedbackText(d.feedback));
      if(d.channel==='foe-open-nego-result'){
        standaloneToken=null;$('standalone-status').textContent=d.message;
        // Jeśli misja-negocjacja zakończona z kolejną misją — pokaż przycisk NEXT
        const existingNext=$('standalone-next');if(existingNext)existingNext.remove();
        if(d.won&&d.nextQuest){
          const nextBtn=document.createElement('button');nextBtn.id='standalone-next';nextBtn.textContent='▶ Następna misja: '+d.nextQuest.title;
          nextBtn.style.cssText='margin-top:6px;font-size:12px';
          nextBtn.onclick=()=>{
            nextBtn.disabled=true;nextBtn.textContent='Uruchamiam…';
            const t='quest-next-'+Date.now();
            window.postMessage({channel:'foe-quest-next',token:t,quest:d.nextQuest},location.origin);
            const handler=ev=>{
              if(ev.source!==window||ev.origin!==location.origin||ev.data?.channel!=='foe-quest-next-result'||ev.data.token!==t)return;
              window.removeEventListener('message',handler);
              nextBtn.remove();
              $('standalone-status').textContent=ev.data.message;
              if(ev.data.ok){standaloneGame=ev.data.game;$('standalone-start').disabled=false;}
            };
            window.addEventListener('message',handler);
          };
          $('standalone-history').after(nextBtn);
        }
        $('standalone-start').disabled=!!standaloneToken||!standaloneGame;
      }
    });
    window.postMessage({channel:'foe-open-negotiation-query'},location.origin);
    const soundKey='foe-companion.gbgSound';
    let soundSettings={enabled:false,minutes:2,kind:'classic'},audioContext=null,alertBusy=false;
    try{const saved=JSON.parse(localStorage.getItem(soundKey)||'null');if(saved)soundSettings={enabled:saved.enabled===true,minutes:Number.isInteger(saved.minutes)&&saved.minutes>=1&&saved.minutes<=60?saved.minutes:2};}catch{}
    $('gbg-sound-enabled').checked=soundSettings.enabled;
    $('gbg-sound-minutes').value=soundSettings.minutes;
    const signals={classic:[[784,0,.2],[1047,.23,.2],[784,.46,.2]],ding:[[880,0,.35],[660,.37,.4]],single:[[880,0,.3]],melody:[[523,0,.18],[659,.2,.18],[784,.4,.18],[1047,.6,.3]],alarm:[[1000,0,.12],[700,.15,.12],[1000,.3,.12],[700,.45,.12]]};
    try{const saved=JSON.parse(localStorage.getItem(soundKey)||'{}');soundSettings.kind=Object.hasOwn(signals,saved.kind)?saved.kind:'classic';}catch{soundSettings.kind='classic';}
    $('gbg-sound-kind').value=soundSettings.kind;
    $('gbg-sound-kind').onchange=()=>{soundSettings.kind=$('gbg-sound-kind').value;localStorage.setItem(soundKey,JSON.stringify(soundSettings));};
    let sounded={};
    try{sounded=JSON.parse(sessionStorage.getItem(soundKey+'.sent')||'{}')||{};}catch{}
    const popupKey='foe-companion.sectorPopup';
    const popupEntries=new Map();let popupDismissed={};
    try{popupDismissed=JSON.parse(sessionStorage.getItem(popupKey+'.dismissed.v2')||'{}')||{};}catch{}
    function savePopupDismissed(){try{sessionStorage.setItem(popupKey+'.dismissed.v2',JSON.stringify(popupDismissed));}catch{}}
    $('sector-popup-close').onclick=()=>{
      const until=Date.now()/1000+3600;
      for(const key of popupEntries.keys())popupDismissed[key]=until;
      popupEntries.clear();savePopupDismissed();paintSectorPopup();
    };
    function sectorPopupText(entry,now,countdown){
      const seconds=Math.max(0,Math.ceil(entry.until-now));
      const time=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
      const type=entry.isAttackBattleType===true?'🟥 ':entry.isAttackBattleType===false?'🟦 ':'';
      return (seconds===0?'Otwarte ':countdown?time+' ':'')+type+(entry.color||'⚪')+' '+entry.sector+(entry.race?' 🏁':'');
    }
    function paintSectorPopup(){
      const now=Date.now()/1000;
      for(const [key,entry] of popupEntries){
        if(!soundSettings.enabled||entry.mapId!==battle?.map?.id)popupEntries.delete(key);
      }
      for(const [key,expiry] of Object.entries(popupDismissed))if(expiry<=now)delete popupDismissed[key];
      savePopupDismissed();
      const lines=[...popupEntries.values()].sort((a,b)=>a.until-b.until).map(entry=>sectorPopupText(entry,now,true));
      const text=lines.join('\n');if($('sector-popup-list').textContent!==text)$('sector-popup-list').textContent=text;
      sectorPopup.hidden=!lines.length;
      // Anchor to the actual handle width, also when the panel is expanded.
      sectorPopup.style.right=($('handle').getBoundingClientRect().width+8)+'px';
      if(lines.length)sectorStatus.textContent='🔔 '+text.replaceAll('\n',' · ');
      else if(sectorStatus.textContent.startsWith('🔔'))sectorStatus.textContent='';
    }
    function eligibleOpenSector(r,now){
      return r.until<=now&&Number.isFinite(r.maxProgress)&&r.maxProgress>0&&Number.isFinite(r.progress)&&r.progress<r.maxProgress/2&&Number.isFinite(r.gainAttritionChance)&&r.gainAttritionChance<30;
    }
    function updateSectorPopup(rows,now){
      for(const [key,expiry] of Object.entries(popupDismissed))if(expiry<=now)delete popupDismissed[key];
      for(const r of rows){
        const key=battle.map.id+':'+r.id;
        const eligible=r.color!=='⚪'&&((r.until>now&&r.until-now<=soundSettings.minutes*60)||eligibleOpenSector(r,now));
        if(!popupDismissed[key]&&(eligible||popupEntries.has(key)))popupEntries.set(key,{...r,mapId:battle.map.id});
      }
      paintSectorPopup();
    }
    async function unlockAudio(){
      audioContext ||= new AudioContext();
      if(audioContext.state==='suspended')await audioContext.resume();
      return audioContext.state==='running';
    }
    function playAlert(){
      if(audioContext?.state!=='running')return false;
      for(const [frequency,offset,duration] of signals[soundSettings.kind]||signals.classic){
        const osc=audioContext.createOscillator(),gain=audioContext.createGain(),at=audioContext.currentTime+offset;
        osc.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.14,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+duration-.02);
        osc.connect(gain);gain.connect(audioContext.destination);osc.start(at);osc.stop(at+duration);
      }
      return true;
    }
    function checkSectorAlerts(){
      paintSectorPopup();
      if(!soundSettings.enabled||!battle||alertBusy)return;
      const now=Date.now()/1000;
      const rows=FoeModel.rows(battle,$('frontier').checked).rows;
      const upcoming=rows.filter(r=>r.color!=='⚪'&&r.until>now&&r.until-now<=soundSettings.minutes*60);
      updateSectorPopup(rows,now);
      const due=upcoming.filter(r=>!popupDismissed[battle.map.id+':'+r.id]&&!sounded[`${battle.map.id}:${r.id}:${r.until}`]);
      if(!due.length)return;
      if(!playAlert()){$('gbg-sound-status').textContent='Kliknij „Test dźwięku”, aby aktywować dźwięk w tej karcie.';return;}
      alertBusy=true;
      for(const [key,until] of Object.entries(sounded))if(until<=now)delete sounded[key];
      for(const r of due)sounded[`${battle.map.id}:${r.id}:${r.until}`]=r.until;
      try{sessionStorage.setItem(soundKey+'.sent',JSON.stringify(sounded));}catch{}
      if(popupEntries.size)paintSectorPopup();
      setTimeout(()=>alertBusy=false,800);
    }
    $('gbg-sound-enabled').onchange=async()=>{
      soundSettings.enabled=$('gbg-sound-enabled').checked;localStorage.setItem(soundKey,JSON.stringify(soundSettings));
      if(soundSettings.enabled){try{await unlockAudio();checkSectorAlerts();}catch{$('gbg-sound-status').textContent='Nie udało się uruchomić dźwięku.';}}
      else {paintSectorPopup();$('gbg-sound-status').textContent='Alerty wyłączone.';}
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
    style.textContent+=`
      *{scrollbar-width:thin;scrollbar-color:#45616a transparent}
      *::-webkit-scrollbar{width:4px;height:4px}
      *::-webkit-scrollbar-thumb{background:#45616a;border-radius:4px}
      *::-webkit-scrollbar-track{background:transparent}
      aside>section,#list,#open-sectors,#neg-panel,#battle-feedback{scrollbar-gutter:stable;overflow-anchor:none}
      #gbg-controls{position:sticky;top:0;z-index:2;background:#102127;padding:4px 0}
      #gbg-stop-controls{display:grid;grid-template-columns:1fr 1fr;gap:6px;height:38px;align-items:stretch}
      #gbg-stop-controls button{margin:0;padding:4px;font-size:11px;min-width:0}
      #gbg-stop-controls button[hidden]{display:block!important;visibility:hidden;pointer-events:none}
      #neg-status{height:18px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #neg-status::before{content:'Status: ';font-weight:bold}
      #list{max-height:100px;box-sizing:border-box;overflow-y:auto}
      #open-sectors{overflow-y:auto;overflow-x:hidden}
      #neg-panel{height:160px;box-sizing:border-box;overflow-y:scroll;overflow-x:hidden;overflow-wrap:anywhere}
      #neg-panel:empty{overflow:hidden}
      #battle-feedback{height:18px;min-height:18px;line-height:18px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;scrollbar-gutter:auto;margin:2px 0;overflow-wrap:normal}
    `;
    style.textContent+=`
      #gbg-title{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px}
      #gbg-title h2{margin:0;font-size:16px;white-space:nowrap}
      #gbg-title td{padding:0 5px}
      #gb button,#gb button:hover{background:transparent;border:0;box-shadow:none}
      #gbg h3{font-size:13px;margin:6px 0}
      #gbg-controls{display:grid;grid-template-columns:1fr;align-items:center;gap:2px;padding:2px 0}
      #neg-status{grid-column:1/-1;text-align:left}
      #gbg-stop-controls{height:28px;gap:4px}
      #gbg-stop-controls button{font-size:10px;padding:2px}
      #open-sectors{font-size:11px}
      #open-sectors>div{padding:2px 0!important;gap:3px!important;min-height:22px;white-space:nowrap}
      #open-sectors button{position:relative;flex-shrink:0;font-size:11px!important;line-height:18px!important;width:19px;height:20px;padding:0!important;margin:0;background:transparent!important;border:0!important;box-shadow:none}
      #open-sectors button.action-start{margin-left:7px}
      #open-sectors button.action-start::before{content:'|';position:absolute;left:-6px;color:#56737b;font-weight:normal;pointer-events:none}
      #schedule-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px}
      #schedule-heading label{font-size:11px;white-space:nowrap;margin:0;display:flex;align-items:center;gap:4px}
      #schedule-heading input{margin:0}
      #list{margin:4px 0;padding:6px;font-size:11px;max-height:100px}
      #copy{font-size:11px;padding:4px 8px}
      #gbg:not([hidden]){display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}
      #gbg> *{flex-shrink:0;box-sizing:border-box}
      #gbg-title{height:26px}
      #open-sectors-heading{height:28px}
      #gbg-controls{position:static;height:auto;min-height:32px}
      #gbg #open-sectors{flex:1 0 80px;min-height:80px;height:auto}
      #schedule-heading{height:28px}
      #gbg #list{height:100px;min-height:100px;max-height:100px;flex:none}
      #gbg #notice,#gbg #feedback{display:block;height:16px;line-height:16px;margin:0;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #gbg #copy{height:28px;align-self:flex-start}
      #notes-dock{display:block;margin-top:4px;padding-top:4px;max-height:300px}
      #notes-dock summary{cursor:pointer;line-height:24px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #notes-dock:not([open]) #notes-text,#notes-dock:not([open]) #notes-status{display:none}
    `;
    style.textContent+=`
      aside input:not([type=checkbox]),aside select{background:#0b191e;color:#e9f1f2;border:1px solid #345058;border-radius:3px}
      #settings{font-size:12px}#settings h2{font-size:15px;margin:8px 0}#settings h3{font-size:13px;margin:12px 0 6px}
      #settings label{margin:4px 0}.settings-open{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px}
      .settings-alert{display:flex;align-items:center;gap:5px;white-space:nowrap}.settings-alert label{display:flex;align-items:center}
      .settings-alert select{min-width:0;flex:1;width:100px}.settings-alert input[type=number]{width:42px}.settings-alert button{padding:2px 5px}
      #settings details{border-top:1px solid #345058;margin-top:10px;padding-top:8px}#settings summary{cursor:pointer;font-weight:bold}
      #settings #gbg-sound-status{font-size:10px}#nego-tab{display:none!important}
      #settings details{border:0;padding:0;margin:8px 0}
      #settings summary{background:#243d45;color:#f1d69a;padding:6px 8px;line-height:1.4}
      #settings details details{margin:6px 0 6px 8px}
      #settings details details>summary{background:#182e35;color:#dce8ec;font-size:12px}
      #settings label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 0}
      #settings label>input{margin-left:auto!important;order:1}
      #settings input:not([type=checkbox]){width:65px!important;max-width:100%;padding:4px!important;text-align:right}
      #settings .settings-range{display:flex;align-items:center;gap:4px;margin-left:auto}
      #settings .settings-open{display:block}
      #settings .settings-alert{margin:8px 0;justify-content:flex-end;gap:4px}
      #settings .settings-alert label{margin-right:auto;gap:4px}
      #settings .settings-alert input[type=number]{width:38px!important}
      #settings .settings-alert select{flex:0 1 135px;width:135px;margin-left:auto}
      #settings input:not([type=checkbox]),#settings select,#settings #gbg-sound-test{height:28px;min-height:28px;box-sizing:border-box;font:inherit;line-height:18px;padding:4px!important;vertical-align:middle}
      #gbg-sound-status{font-size:10px;line-height:16px;height:16px;min-height:16px;margin:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #sector-popup{position:absolute;bottom:10%;max-width:calc(100vw - 100px);max-height:50vh;overflow:auto;background:#102126;color:#e7eeee;padding:7px 26px 7px 9px;border-radius:0;box-shadow:0 2px 10px #0008;pointer-events:auto;font:12px/1.5 system-ui;z-index:2}
      #sector-popup[hidden]{display:none!important}
      #sector-popup-list{white-space:pre-line;font-variant-numeric:tabular-nums}
      #sector-popup{padding:7px 9px}
      #sector-popup-header{display:flex;align-items:center;gap:7px;margin-bottom:4px}
      #sector-popup-title{display:block;color:#f1d69a;font-size:12px;margin-right:auto}
      #sector-popup-copy,#sector-popup-close{border:0;background:transparent;padding:0 2px;line-height:18px}
      #sector-popup-copy{font-size:12px}#sector-popup-close{font-size:16px}
      .quantum-group{padding:5px 0;font-size:11px}.quantum-group summary{cursor:pointer;white-space:nowrap}
      #rich-tooltip{position:fixed;z-index:2147483647;max-width:min(320px,calc(100vw - 20px));white-space:pre-wrap;overflow-wrap:anywhere;background:#07171c;color:#e9f1f2;border:1px solid #45616a;border-radius:5px;padding:8px;font-size:12px;line-height:1.45;pointer-events:none;box-shadow:0 3px 14px #0008}
      #rich-tooltip strong{color:#ffd66b}
      #rich-tooltip[hidden]{display:none!important}
      #rich-tooltip{pointer-events:none!important}
      #city{padding-bottom:100px;box-sizing:border-box}
    `;
    root.append(style);
    const tip=document.createElement('div');tip.id='rich-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;root.append(tip);
    const convertTitles=node=>{
      const elements=[...(node.nodeType===1?[node]:[]),...(node.querySelectorAll?.('[title]')||[])];
      for(const el of elements)if(el.hasAttribute('title')){el.dataset.tooltip=el.getAttribute('title');el.removeAttribute('title');}
    };
    convertTitles(root);
    new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')convertTitles(r.target);else for(const node of r.addedNodes)convertTitles(node);}}).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['title']});
    const hideTip=()=>{tip.hidden=true;tip.replaceChildren();};
    function showTip(event){
      if(event.target.closest?.('#reset-building-names')){hideTip();return;}
      const el=event.target.closest?.('[data-tooltip]');if(!el||!el.dataset.tooltip){hideTip();return;}
      tip.replaceChildren();
      for(const part of el.dataset.tooltip.split(/(\d[\d\s.,]* lin)/u)){
        if(/^\d[\d\s.,]* lin$/u.test(part)){const strong=document.createElement('strong');strong.textContent=part;tip.append(strong);}else tip.append(document.createTextNode(part));
      }
      tip.hidden=false;const rect=el.getBoundingClientRect();
      tip.style.left=Math.max(8,Math.min(rect.left,innerWidth-tip.offsetWidth-8))+'px';
      tip.style.top=Math.max(8,Math.min(rect.bottom+5,innerHeight-tip.offsetHeight-8))+'px';
    }
    root.addEventListener('pointerover',showTip);root.addEventListener('focusin',showTip);
    root.addEventListener('pointerout',hideTip);root.addEventListener('focusout',hideTip);root.addEventListener('scroll',hideTip,true);
    root.addEventListener('pointerdown',hideTip,true);
    root.addEventListener('pointermove',event=>{if(event.target.closest?.('#reset-building-names'))hideTip();});
    root.addEventListener('keydown',event=>{if(event.key==='Escape')hideTip();});
    const qtab=document.createElement('button');qtab.dataset.page='quantum';qtab.setAttribute('role','tab');qtab.setAttribute('aria-selected','false');qtab.title='Najazdy kwantowe';qtab.setAttribute('aria-label','Najazdy kwantowe');qtab.textContent='⚛️';
    root.querySelector('nav').insertBefore(qtab,root.querySelector('[data-page="settings"]'));
    const quantumSection=document.createElement('section');quantumSection.id='quantum';quantumSection.hidden=true;quantumSection.setAttribute('role','tabpanel');
    quantumSection.innerHTML='<h2>Najazdy kwantowe</h2><div id="quantum-summary"></div><div id="quantum-groups"></div><button id="quantum-history" style="margin-top:12px">Historia zbiorów</button>';
    $('settings').before(quantumSection);
    FoeQuantumHistory.mount({root,button:$('quantum-history'),history:quantumHistory,getWidth:()=>$('quantum-summary').getBoundingClientRect().width});
    const title=document.createElement('h3');title.id='pearl-name';$('pearl-status').before(title);
    const totalLabel=document.createElement('label');totalLabel.innerHTML='Total PR <input id="pearl-total" type="number" min="0" step="1" placeholder="Koszt poziomu" style="width:130px;padding:6px">';
    $('pearl-status').before(totalLabel);
    const pearlTotals=new Map();let totalTarget=null;
    $('pearl-total').addEventListener('input',()=>{pearlTotals.set(totalTarget,$('pearl-total').value);paintPearl();});
    const dock=document.createElement('details');dock.id='notes-dock';dock.innerHTML='<summary>Notatki <small id="notes-context"></small></summary><textarea id="notes-text" placeholder="Twoje notatki…"></textarea><div id="notes-status" role="status"></div>';
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
      // Nie rerenderuj jeśli dane się nie zmieniły
      const curVer=quantumTracker.consume({});
      if(paintQuantum._lastVer===curVer){
        // Tylko aktualizuj etykiety "Gotowe" bez niszczenia DOM
        const now=Date.now()/1000;
        $('quantum-groups').querySelectorAll('[data-groupat]').forEach(el=>{
          const at=Number(el.dataset.groupat);
          if(at&&at<=now&&!el.dataset.ready){el.dataset.ready='1';const s=el.querySelector('strong');if(s)s.textContent=(el.dataset.collapsed==='1'?'▸ ':'▾ ')+'Gotowe';}
        });
        return;
      }
      paintQuantum._lastVer=curVer;
      // Zachowaj stan zwinięcia przed rerenderem
      if(!paintQuantum._collapsed)paintQuantum._collapsed=new Map();
      $('quantum-groups').querySelectorAll('[data-groupat]').forEach(el=>{
        paintQuantum._collapsed.set(el.dataset.groupat, el.dataset.collapsed!=='0');
      });
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
      const hourly=text(box,'🪙 +'+summary.bonuses.coins+'% / 🔨 +'+summary.bonuses.supplies+'% · ⚡ '+num(summary.actionsPerHour)+'/h · ⚔️ '+(summary.actionsPerHour/3500).toLocaleString('pl-PL',{maximumFractionDigits:2})+'/h','div');hourly.style.cssText='text-align:center;font-size:12px;color:#a99885;margin-bottom:8px';
      const table=document.createElement('table');table.style.cssText='background:#0b191e;border-radius:5px;width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px';box.append(table);
      const tr=document.createElement('tr');table.append(tr);text(tr,'Następny zbiór:','th');
      const next=summary.groups[0]?.production;
      for(const [key,icon] of [['guild_raids_money','🪙'],['guild_raids_supplies','🔨'],['guild_raids_chrono_alloy','🔩']]){const cell=text(tr,icon+' '+num(next?.[key]),'td');cell.style.cssText='padding:6px 4px;border-left:1px solid #4a3525;text-align:center;font-weight:bold';}

      if(summary.missing.length)text(box,'Niepełne dane: brakuje definicji '+summary.missing.length+' budynków.');
      if(summary.bonuses.unhappy)text(box,'Prognoza nie uwzględnia kary za niezadowolenie.');
      const clockTime=(at,seconds=true)=>new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}).format(at*1000);
      const addSection=(label,first=false)=>{
        if(!first){const hr=document.createElement('hr');hr.style.cssText='border:none;border-top:1px solid #2e4450;margin:10px 0 6px';$('quantum-groups').append(hr);}
        const h=document.createElement('strong');h.textContent=label;h.style.cssText='display:block;font-size:12px;color:#8fcfcf;margin-bottom:4px';$('quantum-groups').append(h);
      };
      // Shared resource widths keep every collection group and overview aligned.
      const resourceValues=[summary.totals,...summary.groups.map(g=>g.production),...summary.groups.flatMap(g=>g.items.map(i=>i.production))];
      resourceValues.push(Object.fromEntries(FoeQuantum.KEYS.map(k=>[k,(summary.totals[k]||0)+summary.builds.reduce((sum,b)=>sum+(b.production?.[k]||0),0)])));
      const resourceColumns='minmax(0,1fr) '+FoeQuantum.KEYS.map(k=>Math.max(2,...resourceValues.map(v=>num(v[k]||0).length))+'ch').join(' ');
      addSection('Zbiory',true);
      // Jeden grid dla wszystkich grup — kolumny wyrównane jak w Zestawieniu
      const zbGrid=document.createElement('div');
      zbGrid.style.cssText='display:grid;grid-template-columns:'+resourceColumns+';gap:0 8px;font-size:11px;font-variant-numeric:tabular-nums;margin-bottom:4px';
      $('quantum-groups').append(zbGrid);
      // Nagłówki kolumn
      const zbHdr=document.createElement('span');zbHdr.style.cssText='padding:1px 0;border-bottom:1px solid #4a3525';zbGrid.append(zbHdr);
      for(const icon of ['🪙','🔨','🔩']){const hd=document.createElement('span');hd.textContent=icon;hd.style.cssText='font-weight:bold;text-align:right;padding:1px 0;border-bottom:1px solid #4a3525';zbGrid.append(hd);}
      for(const group of summary.groups){
        const atKey=String(group.at);
        // Stan zwinięcia: domyślnie true (zwinięte), przywróć jeśli był wcześniej rozwinięty
        const collapsed=paintQuantum._collapsed?.has(atKey)?paintQuantum._collapsed.get(atKey):true;
        // Wiersz nagłówka grupy
        const hRow=document.createElement('span');
        hRow.dataset.groupat=atKey;hRow.dataset.collapsed=collapsed?'1':'0';
        hRow.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:'+resourceColumns+';gap:0 8px;cursor:pointer;margin-top:4px';
        const isReady=group.at<=Date.now()/1000;
        if(isReady)hRow.dataset.ready='1';
        const timeCell=document.createElement('strong');
        timeCell.textContent=(collapsed?'▸ ':'▾ ')+(isReady?'Gotowe':clockTime(group.at));
        timeCell.style.cssText='padding:1px 0';hRow.append(timeCell);
        for(const k of FoeQuantum.KEYS){const c=document.createElement('span');c.textContent=num(group.production[k])||'—';c.style.cssText='text-align:right;padding:1px 0;font-weight:bold;color:'+(group.production[k]?'#f0e6d2':'#6a7a7e');hRow.append(c);}
        zbGrid.append(hRow);
        // Wiersze budynków
        const rows=[];
        for(const item of FoeQuantum.groupedBuildings(group.items)){
          const nameCell=document.createElement('span');const bold=document.createElement('strong');bold.textContent=item.count+'×';nameCell.append(bold,' '+item.name);
          nameCell.style.cssText='padding:1px 4px;color:#c8d8dc'+(collapsed?';display:none':'');
          zbGrid.append(nameCell);rows.push(nameCell);
          for(const k of FoeQuantum.KEYS){const c=document.createElement('span');c.textContent=item.production[k]?item.production[k].toLocaleString('pl-PL'):'—';c.style.cssText='text-align:right;padding:1px 0;color:'+(item.production[k]?'#f0e6d2':'#6a7a7e')+(collapsed?';display:none':'');zbGrid.append(c);rows.push(c);}
        }
        // Toggle
        hRow.onclick=()=>{
          const nowCollapsed=hRow.dataset.collapsed!=='0';
          hRow.dataset.collapsed=nowCollapsed?'0':'1';
          rows.forEach(r=>r.style.display=nowCollapsed?'':'none');
          timeCell.textContent=(nowCollapsed?'▾ ':'▸ ')+(group.at<=Date.now()/1000?'Gotowe':clockTime(group.at));
          if(!paintQuantum._collapsed)paintQuantum._collapsed=new Map();
          paintQuantum._collapsed.set(atKey,!nowCollapsed);
        };
      }
      if(summary.builds.length){
        addSection('W budowie');
        const groups=[];
        for(const build of [...summary.builds].sort((a,b)=>(a.at??Infinity)-(b.at??Infinity))){
          let group=groups.at(-1);
          if(!group||!build.at||!group.at||build.at-group.start>600){group={start:build.at,at:build.at,items:new Map()};groups.push(group);}
          group.at=build.at;
          const key=build.cityentity_id||build.name;
          if(!group.items.has(key))group.items.set(key,{...build,count:0});group.items.get(key).count++;
        }
        for(const group of groups){
          const line=text($('quantum-groups'),(group.at?clockTime(group.at,false):'—')+' | ','div');line.style.cssText='font-size:11px;margin:5px 0';
          for(const [i,item] of [...group.items.values()].entries()){
            if(i)line.append(' · ');const node=text(line,item.count+'× '+item.name,'span');node.title=item.benefits||'Brak danych o efektach budynku.';
          }
        }
      }
      const buildProduction=FoeQuantum.groupedBuildings(summary.builds.filter(b=>b.hasProduction)).map(item=>({...item,underConstruction:true}));
      const buildExtras=FoeQuantum.groupedExtras(summary.builds.filter(b=>!b.hasProduction&&FoeQuantum.EXTRA_KEYS.some(k=>b.effects[k]))).map(item=>({...item,underConstruction:true}));
      const constructionStyle=';opacity:0.5';
      const addConstructionTotal=(table,keys,totals,pending,field)=>{
        if(!pending.length)return;
        const label=text(table,'🚧 Suma z budową','span');label.style.cssText='font-weight:bold;padding:2px 0'+constructionStyle;
        label.title='Suma bieżących wierszy i budynków w budowie. Produkcja według bonusów zestawienia; bez przeliczania wpływu nowych budynków na pozostałe.';
        for(const key of keys){const value=(totals[key]||0)+pending.reduce((sum,item)=>sum+(item[field][key]||0),0);const cell=text(table,value?num(value):'—','span');cell.style.cssText='text-align:right;font-weight:bold;padding:2px 0'+constructionStyle;}
      };
      // Zestawienie budynków i sumarycznej produkcji (domyślnie rozwinięte)
      if(summary.groups.length||buildProduction.length){
        const allItems=summary.groups.flatMap(g=>g.items);
        const grouped=[...FoeQuantum.groupedBuildings(allItems),...buildProduction];
        const sec=document.createElement('details');sec.open=true;sec.style.cssText='';
        const hrZ=document.createElement('hr');hrZ.style.cssText='border:none;border-top:1px solid #2e4450;margin:10px 0 6px';$('quantum-groups').append(hrZ);
        $('quantum-groups').append(sec);
        const secLabel=document.createElement('summary');secLabel.style.cssText='font-weight:bold;font-size:12px;cursor:pointer;color:#8fcfcf;margin-bottom:4px';secLabel.textContent='Zestawienie';sec.append(secLabel);
        const tbl=document.createElement('div');tbl.style.cssText='display:grid;grid-template-columns:'+resourceColumns+';gap:0 8px;font-size:11px;font-variant-numeric:tabular-nums;';sec.append(tbl);
        // Nagłówki
        for(const h of ['','🪙','🔨','🔩']){const hd=document.createElement('span');hd.textContent=h;hd.style.cssText='font-weight:bold;text-align:right;padding:1px 0;border-bottom:1px solid #4a3525';tbl.append(hd);}
        for(const item of grouped){
          const nameCell=document.createElement('span');const b=document.createElement('strong');b.textContent=item.count+'×';nameCell.append(b,' '+item.name+(item.underConstruction?' 🚧':''));nameCell.style.cssText='padding:1px 0'+(item.underConstruction?constructionStyle:'');if(item.underConstruction)nameCell.title='W budowie — nie wlicza się do bieżącej sumy.';tbl.append(nameCell);
          for(const k of FoeQuantum.KEYS){const c=document.createElement('span');c.textContent=item.production[k]?item.production[k].toLocaleString('pl-PL'):'—';c.style.cssText='text-align:right;padding:1px 0;color:'+(item.production[k]?'#f0e6d2':'#6a7a7e')+(item.underConstruction?constructionStyle:'');tbl.append(c);}
        }
        // Suma
        const totalsRow=document.createElement('span');totalsRow.textContent='Suma';totalsRow.style.cssText='font-weight:bold;padding:2px 0;border-top:1px solid #4a3525';tbl.append(totalsRow);
        for(const k of FoeQuantum.KEYS){const c=document.createElement('span');c.textContent=summary.totals[k]?summary.totals[k].toLocaleString('pl-PL'):'—';c.style.cssText='text-align:right;font-weight:bold;padding:2px 0;border-top:1px solid #4a3525';tbl.append(c);}
        addConstructionTotal(tbl,FoeQuantum.KEYS,summary.totals,buildProduction,'production');
      }
      // Sekcja: Pozostałe budynki (nieprodukcyjne — stałe efekty)
      if(summary.extras?.length||buildExtras.length){
        const grouped=[...FoeQuantum.groupedExtras(summary.extras||[]),...buildExtras];
        // Ustal dynamicznie które kolumny mają jakiekolwiek wartości != 0
        const extraColDefs=[
          {key:'guild_raids_happiness',    label:'😊', title:'Zadowolenie'},
          {key:'guild_raids_population',   label:'👥', title:'Populacja'},
          {key:'guild_raids_action_points_collection', label:'⚡', title:'Produkcja działań/h'},
          {key:'guild_raids_action_points_capacity',   label:'🔋', title:'Pojemność działań'},
          {key:'att_def_boost_attacker',   label:'🗡️', title:'Bonus ataku atakującego %'},
          {key:'att_def_boost_defender',   label:'🛡️', title:'Bonus obrony obrońcy %'},
        ];
        const activeCols=extraColDefs.filter(col=>grouped.some(g=>g.effects[col.key]!==0));
        if(activeCols.length){
          const sec2=document.createElement('details');sec2.open=true;sec2.style.cssText='';
          const hrP=document.createElement('hr');hrP.style.cssText='border:none;border-top:1px solid #2e4450;margin:10px 0 6px';$('quantum-groups').append(hrP);
          $('quantum-groups').append(sec2);
          const sec2Label=document.createElement('summary');sec2Label.style.cssText='font-weight:bold;font-size:12px;cursor:pointer;color:#8fcfcf;margin-bottom:4px';sec2Label.textContent='Pozostałe budynki';sec2.append(sec2Label);
          const tbl2=document.createElement('div');
          tbl2.style.cssText=`display:grid;grid-template-columns:1fr ${activeCols.map(()=>'auto').join(' ')};gap:0 8px;font-size:11px;font-variant-numeric:tabular-nums;`;
          sec2.append(tbl2);
          // Nagłówki
          const hName=document.createElement('span');hName.style.cssText='font-weight:bold;padding:1px 0;border-bottom:1px solid #4a3525';tbl2.append(hName);
          for(const col of activeCols){const hd=document.createElement('span');hd.textContent=col.label;hd.title=col.title;hd.style.cssText='font-weight:bold;text-align:right;padding:1px 0;border-bottom:1px solid #4a3525';tbl2.append(hd);}
          // Wiersze
          const extTotals=Object.fromEntries(FoeQuantum.EXTRA_KEYS.map(k=>[k,0]));
          for(const item of grouped){
            const nameCell=document.createElement('span');const b=document.createElement('strong');b.textContent=item.count+'×';nameCell.append(b,' '+item.name+(item.underConstruction?' 🚧':''));nameCell.style.cssText='padding:1px 0'+(item.underConstruction?constructionStyle:'');if(item.underConstruction)nameCell.title='W budowie — nie wlicza się do bieżącej sumy.';tbl2.append(nameCell);
            for(const col of activeCols){
              const v=item.effects[col.key]||0;
              const c=document.createElement('span');
              c.textContent=v?(item.count>1&&col.key!=='guild_raids_happiness'&&col.key!=='guild_raids_population'?v.toLocaleString('pl-PL'):v.toLocaleString('pl-PL')):'—';
              c.style.cssText='text-align:right;padding:1px 0;color:'+(v!==0?(v<0?'#e57373':'#f0e6d2'):'#6a7a7e')+(item.underConstruction?constructionStyle:'');
              tbl2.append(c);
              if(!item.underConstruction)extTotals[col.key]+=v;
            }
          }
          // Suma
          const sumName=document.createElement('span');sumName.textContent='Suma';sumName.style.cssText='font-weight:bold;padding:2px 0;border-top:1px solid #4a3525';tbl2.append(sumName);
          for(const col of activeCols){const c=document.createElement('span');const v=extTotals[col.key];c.textContent=v?v.toLocaleString('pl-PL'):'—';c.style.cssText='text-align:right;font-weight:bold;padding:2px 0;border-top:1px solid #4a3525;color:'+(v<0?'#e57373':'#f0e6d2');tbl2.append(c);}
          addConstructionTotal(tbl2,activeCols.map(col=>col.key),extTotals,buildExtras,'effects');
        }
      }
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
    const autoConfig=document.createElement('details');autoConfig.id='settings-autoattack';autoConfig.open=true;
    autoConfig.innerHTML='<summary>Autoatak</summary><label>Pozostaw walk <input id="auto-reserve" type="number" min="0" step="1"></label><label>Przerwa (s) <span class="settings-range"><input id="auto-min" aria-label="Minimalna przerwa po walce" type="number" min="0" step="0.1"> – <input id="auto-max" aria-label="Maksymalna przerwa po walce" type="number" min="0" step="0.1"></span></label><small>Stop po 3 porażkach z rzędu.</small><p id="auto-settings-error"></p>';
    $('gbg-automation-settings').append(autoConfig);
    const negTurnKey='foe-companion.negotiationTurnDelay';
    let negTurnSettings={min:1,max:2};
    try{const saved=JSON.parse(localStorage.getItem(negTurnKey));if(saved&&Number.isFinite(saved.min)&&Number.isFinite(saved.max)&&saved.min>=0&&saved.max>=saved.min&&saved.max<=60)negTurnSettings={min:saved.min,max:saved.max};}catch{}
    const negTurnConfig=document.createElement('details');negTurnConfig.id='settings-negotiations';negTurnConfig.open=true;
    negTurnConfig.innerHTML='<summary>Negocjacje</summary><label>Między turami (s) <span class="settings-range"><input id="nego-turn-min" type="number" min="0" max="60" step="0.1" aria-label="Minimalna przerwa między turami"> – <input id="nego-turn-max" type="number" min="0" max="60" step="0.1" aria-label="Maksymalna przerwa między turami"></span></label><small id="nego-turn-error" role="status"></small>';
    autoConfig.after(negTurnConfig);
    const foldKey='foe-companion.settingsFold';let folds={};
    try{folds=JSON.parse(localStorage.getItem(foldKey)||'{}')||{};}catch{}
    for(const section of $('settings').querySelectorAll('details[id]')){
      if(typeof folds[section.id]==='boolean')section.open=folds[section.id];
      section.addEventListener('toggle',()=>{folds[section.id]=section.open;try{localStorage.setItem(foldKey,JSON.stringify(folds));}catch{}});
    }
    for(const key of ['min','max']){
      $('nego-turn-'+key).value=negTurnSettings[key];
      $('nego-turn-'+key).onchange=()=>{
        const minText=$('nego-turn-min').value,maxText=$('nego-turn-max').value,min=Number(minText),max=Number(maxText);
        if(!minText||!maxText||!Number.isFinite(min)||!Number.isFinite(max)||min<0||max<min||max>60){$('nego-turn-error').textContent='Zakres: 0–60 s; maksimum ≥ minimum.';return;}
        negTurnSettings={min,max};localStorage.setItem(negTurnKey,JSON.stringify(negTurnSettings));$('nego-turn-error').textContent='';
      };
    }
    for(const key of ['reserve','min','max']){
      $('auto-'+key).value=autoSettings[key];
      $('auto-'+key).onchange=()=>{
        const next=Object.fromEntries(['reserve','min','max'].map(k=>[k,Number($('auto-'+k).value)]));
        if(!Number.isInteger(next.reserve)||next.reserve<0||!Number.isFinite(next.min)||next.min<0||!Number.isFinite(next.max)||next.max<next.min){$('auto-settings-error').textContent='Podaj nieujemne wartości; maksymalna przerwa musi być ≥ minimalnej.';return;}
        autoSettings=next;localStorage.setItem(autoKey,JSON.stringify(next));$('auto-settings-error').textContent='';stopAuto('Ustawienia zmienione.');
      };
    }
    let autoSector=null,autoTimer=null,autoStopRequested=false,lossStreak=0,fights=0,wins=0;
    const stats=document.createElement('td');stats.title='Wygrane / zakończone walki przyciskami rozszerzenia w tej sesji';stats.textContent='🏆 0/0';$('open-sectors').before(stats);
    const stopButton=document.createElement('button');stopButton.textContent='⏹ Stop walk';stopButton.hidden=true;stats.after(stopButton);stopButton.onclick=()=>requestStopAuto();
    function setBattleFeedback(message){
      const full=String(message||'');
      let short=full;
      if(full.includes('3 kolejnych porażkach'))short='Autoatak: STOP — 3 porażki z rzędu.';
      else if(full.includes('Osiągnięto ustawiony zapas')||full.includes('Osiągnięto zapas:'))short='STOP — osiągnięto ustawiony zapas walk.';
      else if(full.includes('Wyczerpano limit tur. Negocjacja poddana.'))short='Przegrana — koniec tur, negocjacja poddana.';
      else if(full.startsWith('Negocjacja zakończona sukcesem'))short=full.replace('Negocjacja zakończona sukcesem','Wygrana');
      else if(full.startsWith('Auto-negocjacja zatrzymana.'))short='Auto-negocjacje: STOP.';
      else if(full.startsWith('Autoatak zatrzymany.'))short='Autoatak: STOP.';
      else if(full.includes('Auto-negocjacje zatrzymane.'))short='Auto-negocjacje: STOP — błąd; sprawdź towary.';
      else if(full.startsWith('Pobieranie i wymiana armii:'))short=full.replace('Pobieranie i wymiana armii:','Wymiana armii:');
      const feedback=$('battle-feedback');feedback.textContent=short;feedback.title=full;feedback.setAttribute('aria-label',full);
    }
    function stopAuto(message){clearTimeout(autoTimer);autoTimer=null;autoSector=null;autoStopRequested=false;stopButton.disabled=false;stopButton.textContent='⏹ Stop walk';stopButton.hidden=true;if(message)setBattleFeedback(message);paintOpenSectors();}

    // --- Negocjacje UI --- (negStats/stopNegButton/negPanel zdefiniowane poniżej, montowane tu)
    // Montaż następuje po deklaracji zmiennych negocjacyjnych w kolejnym bloku.
    let negClearTimer=null;
    let negPending=null,negPendingSector=null,negLastSector=null,negLastUntil=0,negLastOK=false;
    function requestStopAuto(){
      if(autoSector===null)return;
      if(!battlePending&&battleWaveSector===null){stopAuto('Autoatak zatrzymany.');return;}
      autoStopRequested=true;stopButton.disabled=true;stopButton.textContent='Kończę walkę…';
      setBattleFeedback('Zatrzymywanie — kończę rozpoczętą walkę wraz z pozostałymi falami.');
      if(!battlePending&&battleWaveSector!==null&&!autoTimer)startFight(autoSector,true);
    }
    let autoNegSector=null,autoNegTimer=null,negWins=0,negDone=0;
    const negStats=document.createElement('td');negStats.title='Wygrane / zakończone negocjacje przyciskami rozszerzenia w tej sesji';negStats.textContent='🤝 0/0';
    const stopNegButton=document.createElement('button');stopNegButton.textContent='⏹ Stop nego';stopNegButton.hidden=true;
    // Panel tury negocjacji — wyświetlany pod listą sektorów podczas aktywnej negocjacji.
    const negPanel=document.createElement('div');negPanel.id='neg-panel';negPanel.style.cssText='background:transparent;padding:10px;margin:8px 0;font-size:13px';
    // Montuj w DOM: negStats i stopNegButton za stopButton, negPanel przed listą sektorów.
    const counters=document.createElement('table');counters.style.cssText='width:auto;margin:0;border-collapse:collapse;text-align:center;font-size:12px;white-space:nowrap';
    const counterBody=document.createElement('tbody'),counterRow=document.createElement('tr');
    const attritionStats=document.createElement('td');attritionStats.title='Aktualny opór na Polach Chwały';attritionStats.setAttribute('aria-live','polite');
    paintAttrition=()=>{attritionStats.textContent='🔥 '+(playerAttrition??'—');};paintAttrition();
    $('gbg-title').append(counters);counterRow.append(stats,negStats,attritionStats);counterBody.append(counterRow);counters.append(counterBody);
    const controls=document.createElement('div');controls.id='gbg-controls';
    const stops=document.createElement('div');stops.id='gbg-stop-controls';
    stopButton.before(controls);stops.append(stopButton,stopNegButton);controls.append(stops);
    stopNegButton.onclick=()=>stopAutoNeg('Auto-negocjacja zatrzymana. Trwająca negocjacja zostanie dokończona.');
    $('feedback').after(negPanel);$('open-sectors').before($('battle-feedback'));
    const negStatus=document.createElement('div');negStatus.id='neg-status';negStatus.textContent='ready';negStatus.style.cssText='font-size:12px';controls.append(negStatus);
    function stopAutoNeg(message){
      clearTimeout(autoNegTimer);autoNegTimer=null;autoNegSector=null;stopNegButton.hidden=true;
      if(message)setBattleFeedback(message);paintOpenSectors();
    }
    function startNeg(id){
      if(negPending){if(autoNegSector!==null)stopAutoNeg('Negocjacja w toku.');return;}
      if(!battleReady){if(autoNegSector!==null)stopAutoNeg('Brak gotowego połączenia.');return;}
      const row=FoeModel.rows(battle,true).rows.find(r=>r.id===id&&r.until<=Date.now()/1000);
      if(!row){stopAutoNeg('Sektor nie jest już dostępny.');return;}
      negPending=crypto.randomUUID();negPendingSector=id;negStatus.textContent='start nego';
      clearTimeout(negClearTimer);
      negPanel.style.display='block';negPanel.innerHTML='<em>Uruchamiam negocjację: '+row.sector+'…</em>';
      setBattleFeedback('Negocjacja: '+row.sector+'…');
      window.postMessage({channel:'foe-negotiate',token:negPending,provinceId:id,turnDelay:negTurnSettings,...(autoNegSector!==null?{reserve:autoSettings.reserve}:{})},location.origin);
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
        negStatus.textContent=d.turn+' tura';
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
        if(!negPanel.querySelector('#neg-turns')?.children.length)negPanel.replaceChildren();
        negLastSector=negPendingSector;negLastUntil=Date.now()+1800;negLastOK=d.ok===true;
        negPending=null;negPendingSector=null;
        clearTimeout(negClearTimer);negClearTimer=setTimeout(()=>{if(!negPending)negPanel.replaceChildren();},3000);
        negStatus.textContent=d.won===true?'wygrana':d.won===false?'przegrana':'ready';
        setBattleFeedback(d.message);
        if(typeof d.won==='boolean'){negDone++;if(d.won)negWins++;negStats.textContent='🤝 '+negWins+'/'+negDone;}
        if(d.ok&&d.refreshed){// progres odświeżony — model jest już zaktualizowany przez emit
        }
        if(autoNegSector!==null){
          if(d.stopAuto||(!(d.ok&&d.refreshed)&&!d.continueAuto)){stopAutoNeg(d.message);}
          else{
            const id=autoNegSector;
            const delay=(autoSettings.min+Math.random()*(autoSettings.max-autoSettings.min))*1000;
            autoNegTimer=setTimeout(()=>{if(autoNegSector===id)startNeg(id);},delay);
          }
        } else {
          // Jednorazowa negocjacja skończona — ukryj panel po chwili.
          // Zachowaj przebieg i jego stałą wysokość również po zakończeniu.
        }
        paintOpenSectors();
      }
    });
    function startFight(id,automatic=false){
      if(!automatic&&autoSector!==null)stopAuto();
      if(!battleReady||battlePending){if(autoSector!==null)stopAuto('Brak gotowego połączenia.');return;}
      const row=FoeModel.rows(battle,true).rows.find(r=>r.id===id&&r.until<=Date.now()/1000);
      if(!row){stopAuto('Sektor nie jest już dostępny.');return;}
      battlePending=crypto.randomUUID();battlePendingSector=id;
      setBattleFeedback((battleWaveSector===id?'Kolejna fala: ':'Pobieranie i wymiana armii: ')+row.sector+'…');
      window.postMessage({channel:'foe-quick-battle',token:battlePending,provinceId:id,automatic,...(automatic?{reserve:autoSettings.reserve}:{})},location.origin);paintOpenSectors();
    }
    let battleReady=false,battlePending=null,battlePendingSector=null,battleLastSector=null,battleLastUntil=0,battleLastOK=false,battleWaveSector=null,battleReadyReason='Oczekiwanie na moduł połączenia. Przeładuj rozszerzenie i odśwież grę, jeśli komunikat nie znika.';
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin)return;
      const data=event.data;
      if(data?.channel==='foe-map-refresh-error')setBattleFeedback(data.message);
      if(data?.channel==='foe-battle-ready'){
        battleReady=data.ready===true;battleReadyReason=data.reason||'';
        const d=data.diagnostics;
        paintOpenSectors();
      }
      if(data?.channel==='foe-quick-battle-result'&&data.token===battlePending){
        battleLastSector=battlePendingSector;battleLastUntil=Date.now()+1800;battleLastOK=data.ok===true;
        battlePending=null;battlePendingSector=null;if(data.uncertain)battleReady=false;
        if(data.invalidWave)battleWaveSector=null;
        else if(data.ok)battleWaveSector=data.nextWave?data.provinceId:null;
        setBattleFeedback(data.message);
        if(data.ok&&!data.nextWave&&typeof data.won==='boolean'){
          fights++;if(data.won)wins++;lossStreak=data.won?0:lossStreak+1;stats.textContent='🏆 '+wins+'/'+fights;
        }
        if(autoSector!==null){
          if(!data.ok||(!data.nextWave&&(!data.refreshed||typeof data.won!=='boolean')))stopAuto(data.message);
          else if(autoStopRequested&&!data.nextWave)stopAuto('Autoatak zatrzymany po zakończeniu walki.');
          else if(lossStreak>=3)stopAuto('Autoatak zatrzymany po 3 kolejnych porażkach.');
          else{
            const id=autoSector;
            const delay=(autoSettings.min+Math.random()*(autoSettings.max-autoSettings.min))*1000;
            autoTimer=setTimeout(()=>{if(autoSector===id)startFight(id,true);},delay);
          }
        }
        paintOpenSectors();
      }
    });
    window.postMessage({channel:'foe-battle-state-query'},location.origin);
    setInterval(()=>{if(!battleReady&&!battlePending)window.postMessage({channel:'foe-battle-state-query'},location.origin);},3000);
    function paintOpenSectors(){
      const list=$('open-sectors');
      const snapshot=JSON.stringify([battle?FoeModel.rows(battle,true).rows.filter(r=>r.until<=Date.now()/1000):null,battleReady,battlePending,battlePendingSector,battleWaveSector,autoSector,autoNegSector,negPending,negPendingSector,battleLastSector,Date.now()<battleLastUntil,battleLastOK,negLastSector,Date.now()<negLastUntil,negLastOK]);
      if(list.renderSnapshot===snapshot)return;
      list.renderSnapshot=snapshot;list.replaceChildren();
      list.copyText='';
      if(!battle){list.textContent='Otwórz mapę Pól Chwały w grze.';return;}
      const open=FoeModel.rows(battle,true).rows.filter(r=>r.until<=Date.now()/1000).sort((a,b)=>Number(a.ignored)-Number(b.ignored)||(a.progress??0)-(b.progress??0)||a.id-b.id);
      if(!open.length){list.textContent='Brak otwartych sektorów sąsiadujących z naszymi polami.';return;}
      list.copyText=open.map(row=>{
        const type=row.isAttackBattleType===true?'🟥 ':row.isAttackBattleType===false?'🟦 ':'';
        return `${type}${row.color} ${row.sector} | ${row.progress}/${row.maxProgress??'—'} | ${row.gainAttritionChance==null?'—':row.gainAttritionChance+'%'}`;
      }).join('\n');
      for(const row of open){
        const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #345058';
        if(row.ignored){line.style.background='rgba(190,45,45,0.16)';line.title='Prowincja oznaczona przez gildię jako ignorowana';}
        const name=document.createElement('span');name.textContent=(row.isAttackBattleType===true?'🟥 ':row.isAttackBattleType===false?'🟦 ':'')+row.color+' '+row.sector;name.style.flex='1';
        const progress=document.createElement('span');progress.textContent=row.progress+'/'+(row.maxProgress??'—');progress.title='Postęp przejęcia naszej gildii';
        const chance=document.createElement('span');chance.textContent='🔥 '+(row.gainAttritionChance===null?'—':row.gainAttritionChance+'%');chance.title='Szansa na wzrost oporu';

        // isAttackBattleType wybiera atak lub obronę, nie walkę lub negocjacje.
        // Obie akcje są dostępne; serwer potwierdza możliwość ich wykonania.
        const isBattle = false;
        const isNegOnly = false;

        const action=document.createElement('button');
        action.className='action-start';
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
          auto.onclick=()=>{if(autoSector===row.id){requestStopAuto();return;}autoSector=row.id;lossStreak=0;stopButton.hidden=false;startFight(row.id,true);};
        } else {
          auto.style.display='none';
        }

        // --- Przyciski negocjacji (gdy isAttackBattleType !== true) ---
        const negBtn=document.createElement('button');
        negBtn.className='action-start';
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
        if($('list').textContent!=='Otwórz mapę Pól Chwały w grze.')$('list').textContent='Otwórz mapę Pól Chwały w grze.';
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

      const scheduleText=output||'Brak sektorów do wyświetlenia.';
      if($('list').textContent!==scheduleText)$('list').textContent=scheduleText;

      if (!result.rows.length) {
        $('notice').textContent =
          result.warning;
      }
    };

    let contributionPending=null,contributionMessage='',contributionBlocked=false;
    function contributionButton(amount,icon,title,desiredTotal,lock){
      const button=document.createElement('button');button.textContent=icon;button.title=title;button.setAttribute('aria-label',title);
      button.disabled=!!contributionPending||contributionBlocked||!battleReady||!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(construction?.level);
      const targetKey=JSON.stringify([construction?.target,construction?.level]);
      button.onclick=()=>{
        if(contributionPending||contributionBlocked||targetKey!==JSON.stringify([construction?.target,construction?.level]))return;
        try{
          const request=FoePearls.contributionRequest(construction,amount,0);
          contributionPending='pearl-'+Date.now();contributionMessage='Wpłacanie '+amount+' PR…';
          window.postMessage({channel:'foe-contribute',token:contributionPending,request,desiredTotal,lock},location.origin);paintPearl();
        }catch(error){contributionMessage=error.message;$('pearl-feedback').textContent=contributionMessage;}
      };
      return button;
    }
    let contributionDismissTimer=null;
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-contribution-result'||event.data.token!==contributionPending)return;
      contributionPending=null;
      if(contributionDismissTimer){clearTimeout(contributionDismissTimer);contributionDismissTimer=null;}
      if(event.data.ok){
        // #7: komunikat ok z emoji, bez drugiego zdania (notka niżej)
        contributionMessage='✅ '+event.data.message;
        // #6: komunikat znika po 8 sekundach
        contributionDismissTimer=setTimeout(()=>{contributionMessage='';contributionDismissTimer=null;paintPearl();},8000);
      }else{
        contributionMessage=event.data.message;
      }
      if(!event.data.ok&&/odśwież/.test(contributionMessage))contributionBlocked=true;
      paintPearl();
    });
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

      // Uzupełniaj także po opóźnionym odczycie kosztu, bez nadpisywania ręcznej wartości.
      if(!pearlTotals.has(target)){
        const cost=construction?.forge_points_for_level_up;
        $('pearl-total').value=Number.isSafeInteger(cost)&&cost>0?String(cost):'';
      }

      $('pearl-rows').replaceChildren();

      $('pearl-status').textContent =
        !result
          ? 'Wpisz przelicznik większy od 0 i nie większy niż 10 (do 4 miejsc po przecinku).'
          : !construction
            ? 'Otwórz perłę w grze.'
            : result.totalCost !== null
              ? 'Koszt poziomu: ' + result.totalCost + ' PR'
              : '';

      $('pearl-feedback').textContent = contributionMessage;

      if (!result || !construction) return;

      const blockText=$('pearl-total').value.trim();
      const ownerPaid=FoePearls.ownerContribution(construction);
      const paidInfo=document.createElement('small');
      paidInfo.style.cssText='display:block;color:#a5b8bc;margin:6px 0';
      paidInfo.textContent='Wpłacono przez właściciela: '+(ownerPaid??0)+' PR';
      $('pearl-rows').append(paidInfo);
      const blocks=blockText!==''&&ownerPaid!==null?FoePearls.liveLocks(Number(blockText),result.rows,construction):null;
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
          small.title='Dopłata od obecnego stanu perły: rzeczywiste wpłaty wszystkich graczy; dla wolnego miejsca planowana kwota inwestora. Remis zachowuje wcześniejsze miejsce.';
          const blockAmount=document.createElement('span');
          blockAmount.textContent=block.additional+' PR';
          blockAmount.style.cssText='flex:0 0 68px;width:68px;white-space:nowrap;font-variant-numeric:tabular-nums';
          const blockCopy=document.createElement('button');
          blockCopy.textContent='📋';blockCopy.title='Kopiuj dopłatę właściciela przed P'+row.rank;
          blockCopy.setAttribute('aria-label',blockCopy.title);
          blockCopy.style.cssText='padding:1px 3px;margin:0;min-width:0;font-size:10px;line-height:1.2';
          blockCopy.onclick=async()=>{
            try{await navigator.clipboard.writeText(String(block.additional));$('pearl-feedback').textContent='Skopiowano dopłatę przed P'+row.rank+': '+block.additional;}
            catch{$('pearl-feedback').textContent='Nie udało się skopiować.';}
          };
          const cumulative=document.createElement('span');cumulative.textContent='· łącznie '+block.cumulative+' PR';
          small.append(blockAmount,blockCopy);
          small.append(cumulative);
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
        if(ownPlayerId&&construction.target?.playerId!==ownPlayerId){
          const paid=construction.rankings?.find(r=>r.player?.player_id===ownPlayerId)?.forge_points??0;
          const remaining=row.amount===null?null:Math.max(0,row.amount-paid);
        }
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
    const collectionBonusBar=document.createElement('div');collectionBonusBar.id='collection-bonuses';collectionBonusBar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:11px;color:#f1d69a;margin:6px 0';
    $('city-list').before(collectionBonusBar);
    const favoritesKey=()=> 'foe-companion.favorites.'+(ownPlayerId??'unknown');
    function readFavorites(){try{const v=JSON.parse(localStorage.getItem(favoritesKey())||'[]');return new Set(Array.isArray(v)?v:[]);}catch{return new Set();}}
    const favoriteId=b=>b.id+':'+b.ceid;
    let cityCategory='favorites';
    const cityCategories=[['favorites','Ulubione','⭐'],['fp','+PR','🔬'],['pearls','Perły','🏛️'],['army','Wojsko','⚔️'],['other','Pozostałe','📦']];
    const inCityCategory=(b,key)=>key==='favorites'?readFavorites().has(favoriteId(b)):key==='pearls'?b.type==='greatbuilding':key==='army'?(b.producesUnits??b.productionUnits>0):key==='fp'?b.type!=='greatbuilding'&&(b.producesFP??b.productionFP>0):b.type!=='greatbuilding'&&!(b.producesFP??b.productionFP>0)&&!(b.producesUnits??b.productionUnits>0);
    const cityTabs=document.createElement('div');cityTabs.setAttribute('role','tablist');cityTabs.setAttribute('aria-label','Kategorie zbiorów');cityTabs.style.cssText='display:flex;gap:5px;margin:6px 0 10px';
    const cityTabButtons=new Map();
    for(const [key,label,emoji] of cityCategories){
      const button=document.createElement('button');button.type='button';button.textContent=emoji;button.dataset.tooltip=label;button.id='city-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls','city-list');
      button.onclick=()=>{cityCategory=key;hideTip();paintCity();};cityTabButtons.set(key,button);cityTabs.append(button);
    }
    $('city-list').before(cityTabs);$('city-list').setAttribute('role','tabpanel');
    const collectAll=document.createElement('button');collectAll.textContent='🤲 Zbierz wszystkie';collectAll.style.cssText='display:block;font-size:11px;margin:0 0 6px auto';$('city-list').before(collectAll);
    const canCollect=b=>b.ready&&attemptedCollections.get(b.id)!==JSON.stringify(b.raw.state);
    function startCollection(buildings){
      if(collectPending)return;
      const selected=buildings.filter(canCollect);if(!selected.length)return;
      const token=crypto.randomUUID();collectPending=token;
      for(const b of selected)attemptedCollections.set(b.id,JSON.stringify(b.raw.state));
      collectFeedback='Zbieranie: '+selected.length+'…';
      window.postMessage({channel:'foe-collect',token,entityIds:selected.map(b=>b.id)},location.origin);paintCity();
      setTimeout(()=>{if(collectPending!==token)return;collectPending=null;collectFeedback='Brak potwierdzenia zbiorów. Sprawdź stan w grze przed ponowieniem.';paintCity();},25000);
    }
    collectAll.onclick=()=>startCollection(FoeModel.cityRows().filter(b=>inCityCategory(b,cityCategory)));
    const cityNamesKey='foe-companion.customBuildingNames';
    const resetNames=document.createElement('button');resetNames.id='reset-building-names';resetNames.type='button';resetNames.textContent='Resetuj nazwy';resetNames.style.cssText='margin:10px 0 20px;font-size:11px;padding:3px 8px;cursor:pointer';
    $('city-list').after(resetNames);
    resetNames.onclick=()=>{
      hideTip();
      try{localStorage.removeItem(cityNamesKey);collectFeedback='Przywrócono nazwy automatyczne.';}catch{collectFeedback='Nie udało się zresetować nazw.';}
      paintCity();
    };
    function readCityNames(){try{const value=JSON.parse(localStorage.getItem(cityNamesKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
    window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='foe-collect-result'||event.data.token!==collectPending)return;collectPending=null;for(const r of event.data.results||[])if(!r.ok&&r.retryable)attemptedCollections.delete(r.entityId);collectFeedback=event.data.message;paintCity();});
    setInterval(()=>paintCity(),1000);
    paintCity = () => {
      const bonuses=FoeModel.getCollectionBonuses();
      const bonusSnapshot=JSON.stringify(bonuses);
      if(collectionBonusBar.dataset.snapshot!==bonusSnapshot){
        collectionBonusBar.dataset.snapshot=bonusSnapshot;collectionBonusBar.replaceChildren();
        for(const bonus of bonuses||[]){
          const label=document.createElement('span');
          label.style.cssText='flex:0 0 calc((100% - 18px)/4);min-width:0;display:flex;align-items:center;justify-content:center;gap:5px;padding:4px 3px;background:#19352d;border:1px solid #365b48;white-space:nowrap';
          const uses=document.createElement('small');uses.textContent=bonus.amount+'x';uses.style.cssText='font-size:10px;color:#b7c8ce';
          const effect=document.createElement('strong');effect.textContent=bonus.type==='double_collection'?'x2':'🔨 '+bonus.value+'%';effect.style.cssText='font-size:11px;font-weight:700;color:#b5dbba';
          label.append(uses,effect);
          label.dataset.tooltip=bonus.type==='double_collection'?'Szansa podwojenia zbioru: '+bonus.value+'%.\nPozostało prób: '+bonus.amount+'. Wynik losowy.':'Premia do zbioru zaopatrzenia: +'+bonus.value+'%.\nPozostało użyć: '+bonus.amount+'.';
          collectionBonusBar.append(label);
        }
        collectionBonusBar.style.display=bonuses?.length?'flex':'none';
      }
      // Live timers and network updates must not replace an input being edited.
      if(root.activeElement?.matches('input[data-building-name]'))return;
      const customNames=readCityNames();
      const allRows = FoeModel.cityRows();
      for(const [key,label,emoji] of cityCategories){
        const button=cityTabButtons.get(key),selected=cityCategory===key;
        const ready=allRows.filter(b=>inCityCategory(b,key)&&b.ready&&attemptedCollections.get(b.id)!==JSON.stringify(b.raw.state)).length;
        const text=emoji+(ready?' ● '+ready:'');if(button.textContent!==text)button.textContent=text;
        button.dataset.tooltip=label+(ready?' — gotowe do zbioru: '+ready:'');
        button.setAttribute('aria-selected',String(selected));button.setAttribute('aria-label',label+(ready?': gotowe do zbioru '+ready:''));
        button.style.cssText='flex:1;padding:5px 4px;font-size:12px;border-bottom:2px solid '+(selected?'#f1d69a':'#2d454d')+';background:'+(selected?'#243d45':'transparent')+';color:'+(ready?'#ffd76a':'#dce8ec')+';font-weight:'+(ready?'bold':'normal');
      }
      const rows=allRows.filter(b=>inCityCategory(b,cityCategory));
      collectAll.disabled=!!collectPending||!rows.some(canCollect);
      $('city-list').setAttribute('aria-labelledby','city-tab-'+cityCategory);
      const statusEl = $('city-status');
      const listEl = $('city-list');

      if (!rows.length) {
        statusEl.textContent = collectFeedback||(cityCategory==='favorites'?'Dodaj budynki przyciskiem 🤍 na pozostałych listach.':'Brak budynków z produkcją w tej kategorii.');
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

      for (const [index,b] of rows.entries()) {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:baseline;gap:6px;padding:2px 0;border-bottom:1px solid #1a2d33';

        const time = document.createElement('span');
        time.style.cssText = 'font-size:10px;white-space:nowrap;color:#f1d69a;font-variant-numeric:tabular-nums';
        time.textContent = b.ready?'Gotowe':b.until?fmt(b.until):'—';
        const collectionTime=b.raw.state?.next_state_transition_at||b.until;
        const titleTime=collectionTime>0&&collectionTime!==2147483647?new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(collectionTime*1000):(b.ready?'Gotowe':'Brak godziny zbioru');
        row.title='⏰ '+titleTime+'\n'+b.tooltip;

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
        collect.onclick=()=>startCollection([b]);
        const favorite=document.createElement('button'),isFavorite=readFavorites().has(favoriteId(b));favorite.textContent=isFavorite?'❤️':'🤍';favorite.dataset.tooltip=isFavorite?'Usuń z ulubionych':'Dodaj do ulubionych';favorite.setAttribute('aria-label',favorite.dataset.tooltip);favorite.style.cssText='border:0;background:transparent;padding:0;font-size:12px';
        favorite.onclick=()=>{const saved=readFavorites();if(saved.has(favoriteId(b)))saved.delete(favoriteId(b));else saved.add(favoriteId(b));try{localStorage.setItem(favoritesKey(),JSON.stringify([...saved]));}catch{collectFeedback='Nie udało się zapisać ulubionych.';}hideTip();paintCity();};
        if(cityCategory==='favorites'){const number=document.createElement('span');number.textContent=(index+1)+'.';number.style.cssText='flex:0 0 20px;font-size:9px;color:#71858b;text-align:right;font-variant-numeric:tabular-nums';row.append(number);}
        controls.append(time,star,favorite,collect);row.append(name,controls);
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

    $('copy-open').onclick = async () => {
      paintOpenSectors();
      const text=$('open-sectors').copyText;
      if(!text){setBattleFeedback('Brak otwartych sektorów do skopiowania.');return;}
      try{
        await navigator.clipboard.writeText(text);
        setBattleFeedback('Skopiowano otwarte sektory.');
      }catch{
        setBattleFeedback('Nie udało się skopiować otwartych sektorów.');
      }
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
// sshdsd

//oks
