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
    const ignored=new Set((participants.get(own)?.signals||[]).filter(s=>s.signal==='ignore').map(s=>s.provinceId??0));
    const colors = {red:'🔴',green:'🟢',yellow:'🟡',teal:'🔵',blue:'🔵',white:'⚪',purple:'🟣',orange:'🟠'};
    const list = battle.map.provinces.filter(p => !p.isSpawnSpot && (!frontierOnly || (p.ownerId!==own && frontier.has(p.id ?? 0)))).map(p => {
      const id = p.id ?? 0; const owner = participants.get(p.ownerId);
      const conquest=p.conquestProgress?.find(c=>c.participantId===own);
      const limits=(p.conquestProgress||[]).map(c=>c.maxProgress).filter(n=>Number.isFinite(n)&&n>0);
      const maxProgress=Number.isFinite(conquest?.maxProgress)&&conquest.maxProgress>0?conquest.maxProgress:limits.length?Math.min(...limits):null;
      const enemy=(p.conquestProgress||[]).filter(c=>c.participantId!==own&&Number.isFinite(c.progress)&&c.progress>0).sort((a,b)=>b.progress-a.progress)[0];
      const race=(topology.sectors[sector(id,battle.map.id)]?.neighbors||[]).some(name=>{
        const neighbor=battle.map.provinces.find(n=>(n.id??0)===topology.sectors[name].id);
        return neighbor?.ownerId!=null&&neighbor.ownerId!==own&&neighbor.ownerId!==p.ownerId&&participants.has(neighbor.ownerId);
      });
      return {id, sector:sector(id,battle.map.id), color:p.ownerId === own ? '⚪' : colors[owner?.colour] || '⚫', owner:owner?.clan?.name || 'Nieznany', until:Number(p.lockedUntil)||0, isAttackBattleType:p.isAttackBattleType===true,
        race,ownerId:p.ownerId,enemyProgress:enemy?.progress??0,enemyMaxProgress:enemy?.maxProgress??maxProgress,ignored:ignored.has(id),progress:conquest?.progress??0,maxProgress,gainAttritionChance:Number.isFinite(p.gainAttritionChance)?p.gainAttritionChance:null};
    }).sort((a,b)=>a.until-b.until || a.id-b.id);
    return {rows:list, warning:frontierOnly ? 'Sąsiedzi własnych pól według stałej mapy. Własna gildia: ⚪.' : 'Wszystkie sektory; to nie jest lista celów dostępnych do ataku.'};
  }

  function updateBattle(current, payload) {
    const full=findBattle(payload);
    if(full) return {battle:full,changed:true,kind:'Pełna mapa'};
    if(!current) return {battle:null,changed:false};
    const queue=[payload], patches=[],participants=[]; let visited=0;
    while(queue.length && visited++<10000){
      const value=queue.shift();
      if(!value || typeof value!=='object')continue;
      if(value.__class__==='GuildBattlegroundProvince') patches.push(value);
      else if(Number.isSafeInteger(value.participantId)&&Array.isArray(value.signals))participants.push(value);
      else if(Array.isArray(value))queue.push(...value.slice(0,1000));
      else for(const [key,child] of Object.entries(value)){
        if(key!=='requestData' && child && typeof child==='object') queue.push(child);
      }
    }
    if(!patches.length&&!participants.length)return {battle:current,changed:false};
    let changed=false;
    const provinces=current.map.provinces.map(p=>{
      const matching=patches.filter(v=>(v.id??0)===(p.id??0));
      if(!matching.length)return p;
      changed=true;
      return matching.reduce((previous,patch)=>{
        return {...previous,...patch,isAttackBattleType:patch.isAttackBattleType??false,gainAttritionChance:patch.gainAttritionChance??0};
      },p);
    });
    const battlegroundParticipants=current.battlegroundParticipants.map(p=>{const matching=participants.filter(v=>v.participantId===p.participantId);if(matching.length){changed=true;return Object.assign({},p,...matching);}return p;});
    return {battle:changed?{...current,battlegroundParticipants,map:{...current.map,provinces}}:current,changed,kind:'Aktualizacja sektorów'};
  }

function line(row) {
    const time = row.until ? new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',hour12:false}).format(row.until*1000) : '';
    const battleType = row.isAttackBattleType === true ? '🟥 ' : row.isAttackBattleType === false ? '🟦 ' : '';
    const remaining=row.until-Date.now()/1000;
    return `${time ? time + ' ' : ''}${battleType}${row.color} ${row.sector}${row.race&&remaining>0&&remaining<=1800?' 🏃‍♂️':''}`;
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
  // Przyrostki zestawów/ulepszeń — to ekwipunek, jeszcze nie budynek na mapie.
  const KIT_SUFFIX=/\s*-\s*(zestaw|ulepszenie|srebrn\w*|z[łl]ot\w*)/i;
  function learnNames(payload) {
    const queue = [payload];
    for (let i = 0; i < queue.length && i < 200000; i++) {
      const v = queue[i];
      if (!v || typeof v !== 'object') continue;
      // Bezpośrednia para name + ceid (GenericCityEntity, CityMapEntity)
      const ceid = v.cityentity_id || v.city_entity_id || (v.__class__==='GenericCityEntity'?v.id:null);
      if (ceid && typeof v.name === 'string' && v.name.trim()) {
        const name = v.name.trim();
        // Preferuj nazwy bez przyrostka zestawu/ulepszenia
        if (!buildingNames[ceid] || KIT_SUFFIX.test(buildingNames[ceid]))
          buildingNames[ceid] = name;
      }
      // Opcja zestawu wyboru: {name: "Budynek - poz. N" / "Budynek - zestaw", item: {cityEntityId: "W_..."}}
      // "poz. N" to właściwa nazwa budynku; "zestaw/ulepszenie" to ekwipunek — ignorujemy go jako źródło nazwy.
      if (typeof v.name === 'string' && v.item?.cityEntityId) {
        const c2 = v.item.cityEntityId;
        const raw = v.name.trim();
        const isKit = KIT_SUFFIX.test(raw);
        if (!isKit && (!buildingNames[c2] || KIT_SUFFIX.test(buildingNames[c2])))
          buildingNames[c2] = raw;
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
  // Lista pomija ulice i dekoracje; budynki bez aktywnej produkcji pozostają widoczne.

  let cityOwner=null;
  const fpBuildingTypes=new Set();
  function seedProductionType(id,producesFP){if(producesFP===true)fpBuildingTypes.add(id);}
  let collectionBonuses=null;
  function updateCollectionBonuses(payload){
    let changed=false;
    for(const response of Array.isArray(payload)?payload:[payload]){
      if(response?.requestClass!=='BonusService'||response.requestMethod!=='getLimitedBonuses'||!Array.isArray(response.responseData))continue;
      const next=response.responseData.filter(b=>['double_collection','supplies_boost'].includes(b.type)&&b.isActive===true&&Number.isFinite(b.amount)&&b.amount>0&&Number.isFinite(b.value)&&b.value>=0).map(b=>({type:b.type,amount:b.amount,value:b.value,factor:b.factor}));
      if(JSON.stringify(collectionBonuses)!==JSON.stringify(next)){collectionBonuses=next;changed=true;}
    }
    return changed;
  }
  function getCollectionBonuses(){return collectionBonuses?.map(b=>({...b}))??null;}
  function cityBuilding(e){
    const state=e.state||{},kind=state.__class__,until=Number(state.next_state_transition_at)||null;
    const producing=kind==='ProducingState',finished=['ProductionFinishedState','ProductionReadyState'].includes(kind);
    const motivated=['motivate','polish','polivate'].includes(state.socialInteractionId);
    const amounts={},extras=[];
    const unitAmount=p=>p?.reward?.type==='unit'?Number(p.reward.amount)||0:(p?.unitTypeId||p?.__class__==='UnitProduct')?Number(p.amount)||0:0;
    let productionUnits=unitAmount(state.current_product?.product);
    const add=r=>{for(const [k,n] of Object.entries(r||{}))if(typeof n==='number')amounts[k]=(amounts[k]||0)+n;};
    add(state.current_product?.product?.resources);
    for(const p of state.productionOption?.products||[]){if(p.onlyWhenMotivated&&!motivated)continue;productionUnits+=unitAmount(p);if(p.playerResources)add(p.playerResources.resources);else if(p.reward)extras.push((p.reward.name||p.reward.type)+(p.isRandom?' (losowe)':''));}
    const labels={strategy_points:'🏛️',money:'🪙',supplies:'🔨',medals:'🥇',diamonds:'💎',premium:'💎'};
    const goods=new Set('stone lumber marble dye wine limestone ebony iron cloth jewelry gold alabaster honey granite copper silk basalt brass gunpowder rope coffee paper porcelain tar wire lead whaleoil whalebone rubber coke fertilizer textiles gasoline machine_parts tinplate explosives bronze gems cypress sandstone'.split(' '));
    let goodsTotal=0;const parts=[];for(const [k,n] of Object.entries(amounts)){if(goods.has(k))goodsTotal+=n;else parts.push((labels[k]||k)+' '+n.toLocaleString('pl-PL'));}if(goodsTotal)parts.splice(Math.min(1,parts.length),0,'📦 '+goodsTotal.toLocaleString('pl-PL'));
    return {id:e.id,ceid:e.cityentity_id,type:e.type,level:e.level??null,productionFP:amounts.strategy_points||0,producesFP:!!(amounts.strategy_points||state.productionOption?.products?.some(p=>p.playerResources?.resources?.strategy_points>0)),producesUnits:productionUnits>0||!!state.productionOption?.products?.some(p=>unitAmount(p)>0),productionUnits,until:finished?0:until,motivated,producing,finished,collectible:(producing||finished)&&e.connected!==0,tooltip:[...parts,...extras].join('\n')||'Brak danych o produkcji',raw:e};
  }
  function parseCity(entities,playerId){cityOwner=playerId;cityBuildings=new Map();for(const e of entities){if(!e||e.player_id!==playerId||/GuildRaids/.test(e.cityentity_id||''))continue;cityBuildings.set(e.id,cityBuilding(e));if(e.type==='greatbuilding'&&Number.isSafeInteger(e.level)&&Number.isSafeInteger(e.state?.forge_points_for_level_up))saveOwnPearl(e.cityentity_id,e.level,e.state.forge_points_for_level_up);}return cityBuildings;}
  function updateCity(payload){let changed=false;const q=[payload];for(let i=0;i<q.length&&i<200000;i++){const v=q[i];if(!v||typeof v!=='object')continue;if(v.__class__==='CityMapEntity'&&(cityBuildings.has(v.id)?(v.player_id==null||v.player_id===cityOwner):(cityOwner!=null&&v.player_id===cityOwner&&typeof v.cityentity_id==='string'&&typeof v.type==='string'))&&!(/GuildRaids/.test(v.cityentity_id||''))){const previous=cityBuildings.get(v.id),old=previous?.raw;const next=cityBuilding({...old,...v});if(old?.cityentity_id===next.ceid&&!v.state?.productionOption&&!v.state?.current_product){next.producesFP ||= previous.producesFP;next.producesUnits ||= previous.producesUnits;}cityBuildings.set(v.id,next);changed=true;}for(const child of Object.values(v))if(child&&typeof child==='object')q.push(child);}return {changed,buildings:cityBuildings};}
  function cityRows(){return [...cityBuildings.values()].filter(b=>!['street','decoration'].includes(b.type)).sort((a,b)=>Number(a.type==='greatbuilding')-Number(b.type==='greatbuilding')||b.productionFP-a.productionFP||(a.until??Infinity)-(b.until??Infinity)||a.id-b.id).map(b=>({...b,producesFP:b.producesFP||fpBuildingTypes.has(b.ceid),name:buildingLabel(b.ceid),ready:b.collectible&&(b.finished||(b.until!==null&&b.until<=Date.now()/1000))}));}
  const {findConstruction,pearlAmounts}=typeof module!=='undefined'?require('./pearls.js'):root.FoePearls;
  const api = {sector,findBattle,rows,line,setTopology,updateBattle,findConstruction,pearlAmounts,
    learnNames,seedName,seedProductionType,buildingLabel,parseCity,updateCity,cityRows,loadOwnPearls,ceidLabel,updateCollectionBonuses,getCollectionBonuses};
  root.FoeModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

