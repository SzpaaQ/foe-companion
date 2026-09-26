(function(root) {
  'use strict';
  const topologies = new Map();
  if(typeof module !== 'undefined'){setTopology(require('./sectors.json'));setTopology(require('./sectors-volcano.json'));}

  function setTopology(value) {
    if (!value || typeof value.mapId!=='string' || !value.mapId || !value.sectors) throw new Error('Nieprawidłowa mapa sektorów');
    const entries=Object.entries(value.sectors), ids=new Set();
    if(!entries.length || (value.mapId==='waterfall_archipelago' && entries.length!==61)) throw new Error('Nieprawidłowa liczba sektorów');
    for(const [name,cell] of entries){
      if(!Number.isInteger(cell.id)||cell.id<0||ids.has(cell.id)||(value.mapId==='waterfall_archipelago'&&waterfallSector(cell.id)!==name)) throw new Error('Nieprawidłowy identyfikator sektora');
      ids.add(cell.id);
      if(!Array.isArray(cell.neighbors)||new Set(cell.neighbors).size!==cell.neighbors.length) throw new Error('Nieprawidłowi sąsiedzi');
      for(const neighbor of cell.neighbors) if(neighbor===name||!value.sectors[neighbor]?.neighbors?.includes(name)) throw new Error(`Niesymetryczna granica ${name} / ${neighbor}`);
    }
    topologies.set(value.mapId,value);
  }

  function sector(id, mapId) {
    if (!mapId) return `ID ${id}`;
    const topology = topologies.get(mapId);
    if (topology && topology.sectors) {
      // Dynamiczne szukanie nazwy sektora (klucza) po jego wewnętrznym ID
      const entry = Object.entries(topology.sectors).find(([, cell]) => cell.id === id);
      if (entry) return entry[0];
    }
    // Jeśli z jakiegoś powodu mapa nie ma definicji dla tego ID, generujemy fallback z algorytmu wodospadu
    if (mapId === 'waterfall_archipelago') return waterfallSector(id);
    return `ID ${id}`;
  }

  function waterfallSector(id) {
    if (id === 0) return 'X1X';
    for (const [start,end,ring,count] of [[1,6,2,1],[7,18,3,2],[19,36,4,3],[37,60,5,4]]) {
      if (id >= start && id <= end) return `${'ABCDEF'[Math.floor((id-start)/count)]}${ring}${'ABCD'[(id-start)%count]}`;
    }
    return `ID ${id}`;
  }

  function findBattle(value) {
    const queue = [value]; let visited = 0;
    while (queue.length && visited++ < 5000) {
      const v = queue.shift();
      if (!v || typeof v !== 'object') continue;
      if (Array.isArray(v.map?.provinces) && Array.isArray(v.battlegroundParticipants)) return v;
      if (Array.isArray(v)) queue.push(...v.slice(0,1000));
      else for(const child of Object.values(v)) if(child && typeof child==='object') queue.push(child);
    }
    return null;
  }

  function rows(battle, frontierOnly = true) {
    const own = battle.currentParticipantId;
    const topology=topologies.get(battle.map.id);
    if(!topology) return {rows:[],warning:`Nieobsługiwana mapa: ${battle.map.id}. Potrzebna jest konfiguracja nazw i sąsiedztwa dla tej mapy.`};
    if(own==null) return {rows:[],warning:'Brak currentParticipantId — nie można rozpoznać własnej gildii.'};
    const frontier=new Set();
    if(frontierOnly) for(const province of battle.map.provinces){
      if(province.ownerId===own) for(const neighbor of topology.sectors[sector(province.id??0,battle.map.id)]?.neighbors || []) frontier.add(topology.sectors[neighbor].id);
    }
    const participants = new Map(battle.battlegroundParticipants.map(p => [p.participantId,p]));
    const colors = {red:'🔴',green:'🟢',yellow:'🟡',teal:'🔵',blue:'🔵',white:'⚪',purple:'🟣',orange:'🟠'};
    const list = battle.map.provinces.filter(p => !p.isSpawnSpot && (!frontierOnly || (p.ownerId!==own && frontier.has(p.id ?? 0)))).map(p => {
      const id = p.id ?? 0; const owner = participants.get(p.ownerId);
      return {id, sector:sector(id,battle.map.id), color:p.ownerId === own ? '⚪' : colors[owner?.colour] || '⚫', owner:owner?.clan?.name || 'Nieznany', until:Number(p.lockedUntil)||0, isAttackBattleType:p.isAttackBattleType===true};
    }).sort((a,b)=>a.until-b.until || a.id-b.id);
    return {rows:list, warning:frontierOnly ? 'Sąsiedzi własnych pól według stałej mapy. Własna gildia: ⚪.' : 'Wszystkie sektory; to nie jest lista celów dostępnych do ataku.'};
  }

  function updateBattle(current, payload) {
    const full=findBattle(payload);
    if(full) return {battle:full,changed:true,kind:'Pełna mapa'};
    if(!current) return {battle:null,changed:false};
    const queue=[payload], patches=[]; let visited=0;
    while(queue.length && visited++<10000){
      const value=queue.shift();
      if(!value || typeof value!=='object')continue;
      if(value.__class__==='GuildBattlegroundProvince') patches.push(value);
      else if(Array.isArray(value))queue.push(...value.slice(0,1000));
      else for(const [key,child] of Object.entries(value)){
        if(key!=='requestData' && child && typeof child==='object') queue.push(child);
      }
    }
    if(!patches.length)return {battle:current,changed:false};
    let changed=false;
    const provinces=current.map.provinces.map(p=>{
      const matching=patches.filter(v=>(v.id??0)===(p.id??0));
      if(!matching.length)return p;
      changed=true;
      return matching.reduce((previous,patch)=>{
        return {...previous,...patch};
      },p);
    });
    return {battle:changed?{...current,map:{...current.map,provinces}}:current,changed,kind:'Aktualizacja sektorów'};
  }

function line(row) {
    const time = row.until ? new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',hour12:false}).format(row.until*1000) : '';
    const battleType = row.isAttackBattleType === true ? '🟥 ' : row.isAttackBattleType === false ? '🟦 ' : '';
    return `${time ? time + ' ' : ''}${battleType}${row.color} ${row.sector}`;
  }

  // --- Zbiory ---

  // Słownik ceid → nazwa, uzupełniany ze wszystkich odpowiedzi gry.
  const buildingNames = {};

  // Aktualna lista budynków miasta: Map id → {id, ceid, type, level, until, fp}
  let cityBuildings = new Map();

  // Skraca cityentity_id do czytelnej formy jako fallback nazwy.
  function ceidLabel(ceid) {
    if (!ceid) return '?';
    // Usuń prefix (jedna lub dwie litery + podkreślnik), zamień podkreślniki na spacje
    return ceid.replace(/^[A-Z]+_/, '').replace(/_/g, ' ');
  }

  // Przeszukuje payload w poszukiwaniu par name + cityentity_id / city_entity_id.
  function learnNames(payload) {
    const queue = [payload];
    for (let i = 0; i < queue.length && i < 200000; i++) {
      const v = queue[i];
      if (!v || typeof v !== 'object') continue;
      const ceid = v.cityentity_id || v.city_entity_id || (v.__class__==='GenericCityEntity'?v.id:null);
      if (ceid && typeof v.name === 'string' && v.name.trim()) {
        buildingNames[ceid] = v.name.trim();
      }
      for (const child of Object.values(v)) {
        if (child && typeof child === 'object') queue.push(child);
      }
    }
  }

  // Bezpośrednie zasilenie słownika (np. z pliku building-names.json).
  function seedName(ceid, name) {
    if (ceid && name) buildingNames[ceid] = name;
  }

  // Nazwa budynku: ze słownika lub skrót z ceid.
  function buildingLabel(ceid) {
    return buildingNames[ceid] || ceidLabel(ceid);
  }

  const LS_OWN_PEARLS = 'foe-companion.ownPearls';

  // Wczytuje zapisane perły własne z localStorage.
  function loadOwnPearls() {
    try { return JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem(LS_OWN_PEARLS) : null) || '{}'); } catch { return {}; }
  }

  // Zapisuje dane perły własnej (poziom + fp do nast. poziomu).
  function saveOwnPearl(ceid, level, forgePointsForLevelUp) {
    const data = loadOwnPearls();
    data[ceid] = { level, forgePointsForLevelUp, updatedAt: Date.now() };
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(LS_OWN_PEARLS, JSON.stringify(data)); } catch {}
  }

  // Parsuje listę entities z city_map (StartupService.getData lub CityMapService).
  // Pomija ulice, dekoracje, puste (IdleState bez timera).
  function parseCity(entities, playerId) {
    const map = new Map();
    for (const e of entities) {
      if (!e || e.type === 'street' || e.type === 'decoration' || e.type === 'path') continue;
      const until = e.state?.next_state_transition_at;
      if (!until || until <= 0 || until === 2147483647) continue;
      map.set(e.id, {
        id: e.id,
        ceid: e.cityentity_id,
        type: e.type,
        level: e.level ?? null,
        until: Number(until),
        fp: e.state?.forge_points_for_level_up ?? null,
      });
      // Perła własna → zapisz do localStorage
      if (e.type === 'greatbuilding' && e.player_id === playerId &&
          Number.isSafeInteger(e.level) && Number.isSafeInteger(e.state?.forge_points_for_level_up)) {
        saveOwnPearl(e.cityentity_id, e.level, e.state.forge_points_for_level_up);
      }
    }
    cityBuildings = map;
    return map;
  }

  // Aktualizuje pojedyncze budynki z CityMapEntity w kolejnych odpowiedziach.
  function updateCity(payload) {
    let changed = false;
    const queue = [payload];
    for (let i = 0; i < queue.length && i < 200000; i++) {
      const v = queue[i];
      if (!v || typeof v !== 'object') { continue; }
      if (v.__class__ === 'CityMapEntity' && Number.isSafeInteger(v.id) && cityBuildings.has(v.id)) {
        const until = v.state?.next_state_transition_at;
        const existing = cityBuildings.get(v.id);
        const newUntil = until && until !== 2147483647 ? Number(until) : null;
        if (newUntil !== existing.until || v.level !== existing.level) {
          cityBuildings.set(v.id, {
            ...existing,
            level: v.level ?? existing.level,
            until: newUntil ?? existing.until,
            fp: v.state?.forge_points_for_level_up ?? existing.fp,
          });
          changed = true;
          // Perła własna → zaktualizuj localStorage
          if (v.type === 'greatbuilding' && Number.isSafeInteger(v.level) &&
              Number.isSafeInteger(v.state?.forge_points_for_level_up)) {
            saveOwnPearl(v.cityentity_id, v.level, v.state.forge_points_for_level_up);
          }
        }
      }
      for (const child of Object.values(v)) {
        if (child && typeof child === 'object') queue.push(child);
      }
    }
    return { changed, buildings: cityBuildings };
  }

  // Zwraca listę budynków posortowaną po czasie, z nazwami.
  function cityRows() {
    return Array.from(cityBuildings.values())
      .sort((a, b) => a.until - b.until)
      .map(b => ({
        ...b,
        name: buildingLabel(b.ceid),
      }));
  }

  const pearls = typeof module !== 'undefined' ? require('./pearls.js') : root.FoePearls;
  const findConstruction = pearls.findConstruction, pearlAmounts = pearls.pearlAmounts;

  const api = {sector,findBattle,rows,line,setTopology,updateBattle,findConstruction,pearlAmounts,
    learnNames,seedName,buildingLabel,parseCity,updateCity,cityRows,loadOwnPearls,ceidLabel};
  root.FoeModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

