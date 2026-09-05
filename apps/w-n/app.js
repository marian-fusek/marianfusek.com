const CFG = window.WN_CONFIG || {};
const SUPABASE_KEY = CFG.supabasePublishableKey || CFG.supabaseAnonKey || '';
const SLEEPER = 'https://api.sleeper.app/v1';
const STATS = SLEEPER;
const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const TEAM_CODES = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
const POSITIONS = ['ALL','QB','RB','WR','TE','K','DEF'];
const STARTER_SLOTS = ['QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DEF'];
const BENCH_SLOTS = ['BENCH1','BENCH2','BENCH3','BENCH4','BENCH5','BENCH6'];
const ALL_SLOTS = [...STARTER_SLOTS, ...BENCH_SLOTS];
const STORAGE_KEY = 'wn-state-v1';

let nflState = { week: 1, season: new Date().getFullYear().toString(), season_type: 'regular' };
let players = [];
let weeklyStats = {};
let weeklyProjections = {};
let weeklySchedule = [];
let scheduleKey = '';
let statsKey = '';
let scheduleUnavailable = false;
let state = loadLocalState();
let filteredTeams = new Set(TEAM_CODES);
let activePosition = 'ALL';
let sortMode = 'rank';
let query = '';
let ownershipFilter = 'all';
let healthFilter = 'all';
let supabaseClient = null;
let syncReady = false;
let refreshTimer = null;
let saveStatusTimer = null;
let saveStatusMode = 'local';
let lastSavedAt = Number(localStorage.getItem('wn-last-saved-at') || 0);
let sharedBaseState = null;

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

function defaultState(){
  return {
    teams: [
      { id:'a', name:'Team One', logo:'', roster:{}, lineups:{} },
      { id:'b', name:'Team Two', logo:'', roster:{}, lineups:{} }
    ],
    week: 1,
    benchEnabled: false,
    transactions: [],
    results: {},
    updatedAt: Date.now()
  };
}

function loadLocalState(){
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return defaultState(); }
}
function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function normalizeState(raw={}){
  const defaults=defaultState();
  const next={...defaults,...raw};
  next.benchEnabled=raw.benchEnabled === true;
  next.week=Math.min(18,Math.max(1,Number(next.week)||1));
  next.teams=[0,1].map(i=>{
    const incoming=next.teams?.[i] || {};
    const team={...defaults.teams[i],...incoming};
    team.roster=normalizeRoster(incoming.roster);
    team.lineups=normalizeLineups(incoming.lineups);
    if(team.lineups[next.week]) team.roster={...team.lineups[next.week]};
    else team.lineups[next.week]={...team.roster};
    return team;
  });
  next.transactions=Array.isArray(next.transactions) ? next.transactions : [];
  next.results=next.results && typeof next.results === 'object' ? next.results : {};
  return next;
}

function activeRosterSlots(){ return state.benchEnabled ? ALL_SLOTS : STARTER_SLOTS; }
function activeRosterSize(){ return activeRosterSlots().length; }

function normalizeRoster(raw={}){
  const source=raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {};
  const roster={...source};
  if(roster.RB && !roster.RB1) roster.RB1=roster.RB;
  if(roster.WR && !roster.WR1) roster.WR1=roster.WR;
  if(roster.BENCH && !roster.BENCH1) roster.BENCH1=roster.BENCH;
  delete roster.RB;
  delete roster.WR;
  delete roster.BENCH;
  return roster;
}

function normalizeLineups(raw={}){
  const source=raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(source).map(([week,roster])=>[week,normalizeRoster(roster)]));
}

function cloneState(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mergeChangedMap(base={}, local={}, remote={}){
  const next={...(remote || {})};
  const keys=new Set([...Object.keys(base || {}), ...Object.keys(local || {})]);
  keys.forEach(key=>{
    const baseValue=base?.[key] ?? null;
    const localValue=local?.[key] ?? null;
    if(localValue === baseValue) return;
    if(localValue == null) delete next[key];
    else next[key]=localValue;
  });
  return next;
}

function mergeChangedLineups(base={}, local={}, remote={}){
  const next={...(remote || {})};
  const weeks=new Set([...Object.keys(base || {}), ...Object.keys(local || {})]);
  weeks.forEach(week=>{
    next[week]=mergeChangedMap(base?.[week], local?.[week], remote?.[week]);
  });
  return next;
}

function transactionKey(tx){ return `${tx?.ts || ''}|${tx?.text || ''}`; }

function mergeTransactions(base=[], local=[], remote=[]){
  const next=[...(remote || [])];
  const seen=new Set(next.map(transactionKey));
  const baseKeys=new Set((base || []).map(transactionKey));
  (local || []).filter(tx=>!baseKeys.has(transactionKey(tx))).forEach(tx=>{
    const key=transactionKey(tx);
    if(!seen.has(key)){ next.push(tx); seen.add(key); }
  });
  return next.sort((a,b)=>Number(a?.ts || 0)-Number(b?.ts || 0));
}

function mergeResults(base={}, local={}, remote={}){
  const next={...(remote || {})};
  const weeks=new Set([...Object.keys(base || {}), ...Object.keys(local || {})]);
  weeks.forEach(week=>{
    const baseValue=JSON.stringify(base?.[week] ?? null);
    const localValue=JSON.stringify(local?.[week] ?? null);
    if(localValue !== baseValue){
      if(local?.[week] == null) delete next[week];
      else next[week]=cloneState(local[week]);
    }
  });
  return next;
}

function mergeLeagueState(base, local, remote){
  if(!remote) return cloneState(local);
  if(!base) return cloneState(local);
  const next=cloneState(remote);
  next.teams=(remote.teams || local.teams || []).map((remoteTeam,index)=>{
    const baseTeam=base.teams?.[index] || {};
    const localTeam=local.teams?.[index] || remoteTeam;
    const team={...remoteTeam};
    ['name','logo'].forEach(field=>{
      if(localTeam[field] !== baseTeam[field]) team[field]=localTeam[field];
    });
    team.roster=mergeChangedMap(baseTeam.roster, localTeam.roster, remoteTeam.roster);
    team.lineups=mergeChangedLineups(baseTeam.lineups, localTeam.lineups, remoteTeam.lineups);
    return team;
  });
  if(local.benchEnabled !== base.benchEnabled) next.benchEnabled=local.benchEnabled;
  if(local.week !== base.week) next.week=local.week;
  next.results=mergeResults(base.results, local.results, remote.results);
  next.transactions=mergeTransactions(base.transactions, local.transactions, remote.transactions);
  return next;
}

async function initSupabase(){
  if (!CFG.supabaseUrl || !SUPABASE_KEY) {
    setSync(false, 'Local only');
    return;
  }
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseClient = createClient(CFG.supabaseUrl, SUPABASE_KEY);
    const { data, error } = await supabaseClient.from('wn_state').select('state').eq('league_id', CFG.leagueId).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      state = normalizeState(data.state);
      sharedBaseState = cloneState(state);
      if (Number(state.updatedAt)) markSaved('shared', Number(state.updatedAt));
    }
    else {
      const initialSaveOk=await pushSharedState();
      if(!initialSaveOk) setSync(false, 'Sync unavailable');
    }
    saveLocal();
    syncReady=true;
    if(data?.state) setSync(true, 'Live sync on');
    supabaseClient.channel('wn_state_sync')
      .on('postgres_changes', { event:'*', schema:'public', table:'wn_state', filter:`league_id=eq.${CFG.leagueId}` }, payload => {
        const remote = payload.new?.state;
        if (remote && remote.updatedAt > (state.updatedAt || 0)) {
          state = normalizeState(remote); sharedBaseState = cloneState(state); saveLocal(); markSaved('shared', Number(state.updatedAt) || Date.now()); renderAll(); showToast('League synced');
        }
      }).subscribe();
  } catch (e) {
    console.warn('Supabase unavailable', e);
    syncReady=false;
    setSync(false, 'Sync unavailable');
  }
}

async function pushSharedState(){
  saveCurrentLineup();
  state = normalizeState(state);
  const localState=cloneState(state);
  const savedAt=Date.now();
  state.updatedAt=savedAt;
  saveLocal();
  markSaved(supabaseClient ? 'saving' : 'local', savedAt);
  if (!supabaseClient) {
    markSaved('local', savedAt);
    return true;
  }
  try {
    const {data, error:readError}=await supabaseClient.from('wn_state').select('state').eq('league_id', CFG.leagueId).maybeSingle();
    if(readError) throw readError;
    const remoteState=data?.state ? normalizeState(data.state) : null;
    const baseState=sharedBaseState || localState;
    state=normalizeState(mergeLeagueState(baseState, localState, remoteState));
    state.updatedAt=savedAt;
    saveLocal();
    const {error}=await supabaseClient.from('wn_state').upsert({ league_id: CFG.leagueId, state, updated_at: new Date().toISOString() });
    if(error) throw error;
  } catch(error) {
    console.warn('Supabase save unavailable', error);
    syncReady=false;
    setSync(false, 'Sync unavailable');
    markSaved('local', savedAt);
    return false;
  }
  sharedBaseState=cloneState(state);
  syncReady=true;
  setSync(true, 'Live sync on');
  markSaved('shared', savedAt);
  return true;
}

function saveCurrentLineup(){
  state.teams.forEach(team=>{
    team.lineups ||= {};
    team.lineups[state.week]={...(team.roster || {})};
  });
}

function activateWeek(week){
  saveCurrentLineup();
  state.week=Math.min(18,Math.max(1,Number(week)||1));
  state.teams.forEach(team=>{
    team.lineups ||= {};
    if(team.lineups[state.week]) team.roster={...team.lineups[state.week]};
    else team.lineups[state.week]={...team.roster};
  });
}

function weekRosterLocked(){
  return Boolean(resultForWeek(state.week)) || weekIsComplete();
}

function setSync(online, title){
  const dot = $('#syncDot');
  dot.classList.toggle('online', online);
  dot.classList.toggle('offline', !online);
  dot.title = title;
}

function relativeSaveTime(timestamp){
  const age = Math.max(0, Date.now() - timestamp);
  if (age < 10_000) return 'just now';
  if (age < 60_000) return `${Math.floor(age / 1000)}s ago`;
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`;
  return new Intl.DateTimeFormat(undefined, {hour:'numeric', minute:'2-digit'}).format(timestamp);
}

function renderSaveStatus(){
  const el = $('#saveStatus');
  if (!el) return;
  el.classList.toggle('saving', saveStatusMode === 'saving');
  el.classList.toggle('local', saveStatusMode === 'local');
  if (saveStatusMode === 'saving') {
    el.textContent = 'Saving…';
    el.title = 'Saving league data';
    return;
  }
  if (!lastSavedAt) {
    el.textContent = 'Not saved yet';
    el.title = 'No league data has been saved yet';
    return;
  }
  const prefix = saveStatusMode === 'local' ? 'Saved locally' : 'Saved';
  el.textContent = `${prefix} · ${relativeSaveTime(lastSavedAt)}`;
  el.title = `Last saved ${new Date(lastSavedAt).toLocaleString()}`;
}

function markSaved(mode, timestamp){
  saveStatusMode = mode;
  lastSavedAt = Number(timestamp) || Date.now();
  localStorage.setItem('wn-last-saved-at', String(lastSavedAt));
  renderSaveStatus();
}

async function loadNFLData(force=false){
  $('#refreshBtn').disabled = true;
  try {
    const stateRes = await fetch(`${SLEEPER}/state/nfl`, {cache: force ? 'reload' : 'default'});
    if (stateRes.ok) nflState = await stateRes.json();
    state.week ||= Number(nflState.week || 1);

    const cacheKey = 'wn-player-cache-v2';
    const legacyCacheKey = 'wn-player-cache-v1';
    const cache = JSON.parse(localStorage.getItem(cacheKey) || localStorage.getItem(legacyCacheKey) || 'null');
    if (!force && cache && Date.now() - cache.ts < 24*60*60*1000) {
      players = cache.players.map(normalizeCachedPlayer);
      if (!localStorage.getItem(cacheKey)) localStorage.setItem(cacheKey, JSON.stringify({ts:cache.ts, players}));
    } else {
      const res = await fetch(`${SLEEPER}/players/nfl?active=true`);
      if (!res.ok) throw new Error('Player feed unavailable');
      const map = await res.json();
      players = Object.values(map)
        .filter(p => p && p.player_id && (p.team || p.position === 'DEF') && ['QB','RB','WR','TE','K','DEF'].includes(p.position))
        .map(normalizePlayer);
      localStorage.setItem(cacheKey, JSON.stringify({ts: Date.now(), players}));
    }

    await Promise.all([
      loadWeekStats(state.week, force),
      loadWeekSchedule(state.week, force)
    ]);
    await recordCompletedWeek();
    renderAll();
    configureAutoRefresh();
  } catch (e) {
    console.error(e);
    showToast('NFL data could not refresh');
    renderAll();
    setBootState('NFL data is unavailable. Your local league is ready; try Refresh when you are back online.', true);
  } finally {
    $('#refreshBtn').disabled = false;
  }
}

async function loadWeekSchedule(week, force=false){
  const season = Number(nflState.season || new Date().getFullYear());
  const key = `wn-schedule-v2-${season}-${week}`;
  if (scheduleKey !== key) weeklySchedule = [];
  scheduleKey = key;

  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  if (!force && cached?.data) {
    weeklySchedule = cached.data;
    scheduleUnavailable = false;
    if (Date.now() - cached.ts < 45_000) return;
  }

  try {
    const url = `${SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`;
    const res = await fetch(url, {cache: force ? 'reload' : 'default'});
    if (!res.ok) throw new Error('Schedule feed unavailable');
    const data = await res.json();
    weeklySchedule = (data.events || []).map(normalizeGame).filter(Boolean);
    localStorage.setItem(key, JSON.stringify({ts: Date.now(), data: weeklySchedule}));
    scheduleUnavailable = false;
  } catch (e) {
    console.warn('Schedule unavailable', e);
    scheduleUnavailable = true;
    if (cached?.data) weeklySchedule = cached.data;
  }
}

function normalizeGame(event){
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  if (!event.id || !event.date || competitors.length < 2) return null;
  const status = event.status || competition.status || {};
  const type = status.type || {};
  const teamData = competitors.map(c => ({
    code: normalizeTeamCode(c.team?.abbreviation || ''),
    homeAway: c.homeAway || '',
    score: Number(c.score || 0)
  })).filter(t => t.code);
  return {
    id: String(event.id),
    date: event.date,
    teams: teamData.map(t => t.code),
    state: type.state || 'scheduled',
    statusName: type.name || '',
    detail: type.detail || type.description || '',
    shortDetail: type.shortDetail || type.detail || type.description || '',
    period: Number(status.period || 0),
    clock: status.displayClock || '',
    scores: teamData.reduce((out, team) => { out[team.code] = team.score; return out; }, {})
  };
}

function normalizeTeamCode(code){
  return code === 'WSH' ? 'WAS' : code === 'LA' ? 'LAR' : code;
}

function gameForTeam(teamCode){
  return weeklySchedule.find(game => game.teams.includes(teamCode));
}

function gameStatus(game){
  if (!game) return scheduleUnavailable
    ? {label:'Kickoff TBD', tone:'muted', locked:false}
    : {label:'Bye · no game', tone:'muted', locked:false};
  const kickoff = Date.parse(game.date);
  const startedByClock = Number.isFinite(kickoff) && Date.now() >= kickoff;
  const rawStatus = `${game.state} ${game.statusName} ${game.detail}`.toLowerCase();
  if (/postponed|canceled|cancelled/.test(rawStatus)) return {label:game.shortDetail || 'Game postponed', tone:'muted', locked:false};
  const isLive = game.state === 'in' || game.state === 'live';
  const isFinal = game.state === 'post' || game.state === 'completed';
  if (isFinal) return {label:'Final', tone:'final', locked:true};
  if (isLive) {
    const detail = /half/i.test(game.shortDetail) ? game.shortDetail : game.period && game.clock ? `Q${game.period} ${game.clock}` : game.shortDetail;
    return {label:detail ? `LIVE · ${detail}` : 'LIVE', tone:'live', locked:true};
  }
  if (startedByClock) return {label:'Started · updating', tone:'live', locked:true};
  return {label:formatKickoff(game.date), tone:'upcoming', locked:false};
}

function gameStatusForPlayer(player){
  return gameStatus(gameForTeam(player?.team));
}

function gameLabelForPlayer(player){
  const status = gameStatusForPlayer(player);
  const game = gameForTeam(player?.team);
  const opponent = game?.teams.find(team => team !== player?.team);
  return opponent ? `vs ${opponent} · ${status.label}` : status.label;
}

function formatKickoff(value){
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Kickoff TBD';
  return new Intl.DateTimeFormat(undefined, {weekday:'short', hour:'numeric', minute:'2-digit'}).format(date);
}

function refreshSummary(){
  if (weekRosterLocked()) return 'Week complete · lineup locked';
  if (scheduleUnavailable) return 'Stats fallback · auto 60s';
  const live = weeklySchedule.some(game => gameStatus(game).tone === 'live');
  if (live) return 'Live updates · 45s';
  const upcoming = weeklySchedule
    .filter(game => gameStatus(game).tone === 'upcoming')
    .sort((a,b) => Date.parse(a.date) - Date.parse(b.date))[0];
  if (upcoming) return `Next kickoff · ${formatKickoff(upcoming.date)}`;
  return 'Manual refresh available';
}

function refreshSummaryTone(){
  if (scheduleUnavailable) return '';
  return weeklySchedule.some(game => gameStatus(game).tone === 'live') ? 'live' : '';
}

function normalizePlayer(p){
  const rank=Number(p.search_rank);
  return {
    id: String(p.player_id), first: p.first_name || '', last: p.last_name || '',
    name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.team || 'Unknown',
    team: normalizeTeamCode(p.team || p.player_id), position: p.position || p.fantasy_positions?.[0] || '',
    status: p.status || 'Active', injury: p.injury_status || '', number: p.number || '',
    rank: Number.isFinite(rank) && rank > 0 ? rank : 9999,
    age: p.age || '', years: p.years_exp ?? '',
    espnId: p.espn_id || '', fantasyDataId: p.fantasy_data_id || ''
  };
}

function normalizeCachedPlayer(p){
  const rank=Number(p?.rank);
  return {...p, rank:Number.isFinite(rank) && rank > 0 ? rank : 9999};
}

async function loadWeekStats(week, force=false){
  const season = nflState.season || new Date().getFullYear();
  const key = `wn-stats-${season}-${week}`;
  const pkey = `wn-proj-${season}-${week}`;
  if(statsKey !== key){
    weeklyStats = {};
    weeklyProjections = {};
    statsKey = key;
  }
  if (!force) {
    try {
      const sc = JSON.parse(localStorage.getItem(key) || 'null');
      const pc = JSON.parse(localStorage.getItem(pkey) || 'null');
      if (sc && Date.now()-sc.ts < 60_000) weeklyStats = sc.data;
      if (pc && Date.now()-pc.ts < 5*60_000) weeklyProjections = pc.data;
      if (sc && pc) return;
    } catch {}
  }
  const urls = [
    `${STATS}/stats/nfl/regular/${season}/${week}`,
    `${STATS}/projections/nfl/regular/${season}/${week}`
  ];
  const [sr, pr] = await Promise.all(urls.map(u => fetch(u).catch(()=>null)));
  if (sr?.ok) {
    weeklyStats = await sr.json();
    localStorage.setItem(key, JSON.stringify({ts:Date.now(), data:weeklyStats}));
  }
  if (pr?.ok) {
    weeklyProjections = await pr.json();
    localStorage.setItem(pkey, JSON.stringify({ts:Date.now(), data:weeklyProjections}));
  }
}

function configureAutoRefresh(){
  clearInterval(refreshTimer);
  refreshTimer = null;
  const cadence = scheduleUnavailable
    ? 60_000
    : weeklySchedule.some(game => gameStatus(game).tone === 'live')
      ? 45_000
      : weeklySchedule.some(game => gameStatus(game).tone === 'upcoming' && Date.parse(game.date) - Date.now() < 6 * 60 * 60 * 1000)
        ? 3 * 60_000
        : 0;
  if (!cadence) return;
  refreshTimer = setInterval(refreshCurrentWeek, cadence);
}

async function refreshCurrentWeek(){
  if (document.hidden) return;
  await Promise.all([
    loadWeekStats(state.week, true),
    loadWeekSchedule(state.week, true)
  ]);
  await recordCompletedWeek();
  renderAll();
  configureAutoRefresh();
}

function getStat(id){ return weeklyStats?.[id] || {}; }
function getProj(id){ return weeklyProjections?.[id] || {}; }
function pointsFor(id){
  const s = getStat(id);
  if (typeof s.pts_ppr === 'number') return s.pts_ppr;
  return calcPpr(s);
}
function projectedFor(id){
  const p = getProj(id);
  if (typeof p.pts_ppr === 'number') return p.pts_ppr;
  return calcPpr(p);
}
function calcPpr(s={}){
  const n = k => Number(s[k] || 0);
  return n('pass_yd')/25 + n('pass_td')*4 - n('pass_int')*2 + n('rush_yd')/10 + n('rush_td')*6 + n('rec_yd')/10 + n('rec_td')*6 + n('rec') + n('fum_lost')*-2 + n('fgm_0_19')*3 + n('fgm_20_29')*3 + n('fgm_30_39')*3 + n('fgm_40_49')*4 + n('fgm_50p')*5 + n('xpm');
}

function defenseTeamCode(p){
  const code = normalizeTeamCode(p?.team || '');
  return TEAM_CODES.includes(code) ? code : '';
}
function playerPhoto(p){
  if (!p) return '';
  if (p.position === 'DEF') {
    const code = defenseTeamCode(p);
    return code ? `media/defense-helmets/${encodeURIComponent(code)}.png` : '';
  }
  return `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(p.id)}.jpg`;
}
function playerImageClass(p){ return p?.position === 'DEF' && defenseTeamCode(p) ? ' defense-helmet' : ''; }
function ownerOf(id){
  for (const t of state.teams) for (const [slot,pid] of Object.entries(t.roster||{})) if (pid === id) return t;
  return null;
}

function isInjuredPlayer(player){
  return Boolean(player?.injury || /injured|questionable|doubtful|out|ir|suspended/i.test(player?.status || ''));
}

function playerMatchesFilters(player){
  const owner=ownerOf(player.id);
  const ownershipMatches = ownershipFilter === 'all'
    || (ownershipFilter === 'available' && !owner)
    || ownershipFilter === owner?.id;
  const healthMatches = healthFilter === 'all'
    || (healthFilter === 'injured' && isInjuredPlayer(player))
    || (healthFilter === 'active' && player.status === 'Active' && !isInjuredPlayer(player));
  return ownershipMatches && healthMatches;
}
function teamTotal(team){
  return STARTER_SLOTS.reduce((sum,slot) => sum + pointsFor(team.roster?.[slot]), 0);
}
function hasProjection(id){
  return Boolean(id && Object.keys(getProj(id)).length);
}
function projectionDisplay(id){
  return hasProjection(id) ? fmt(projectedFor(id)) : '—';
}
function teamProjection(team){
  const ids = STARTER_SLOTS.map(slot => team.roster?.[slot]).filter(Boolean);
  if (!ids.some(hasProjection)) return null;
  return ids.reduce((sum,id) => sum + (hasProjection(id) ? projectedFor(id) : 0), 0);
}

function weekIsComplete(){
  return !scheduleUnavailable && weeklySchedule.length > 0 && weeklySchedule.every(game => game.state === 'post' || game.state === 'completed');
}

function resultForWeek(week){
  return state.results?.[week] || null;
}

async function recordCompletedWeek(){
  if (!weekIsComplete()) return false;
  const [a,b] = state.teams;
  const aScore = teamTotal(a), bScore = teamTotal(b);
  const winner = aScore === bScore ? 'tie' : aScore > bScore ? a.id : b.id;
  const next = {aScore, bScore, winner, updatedAt: Date.now()};
  const previous = resultForWeek(state.week);
  if (previous && previous.aScore === next.aScore && previous.bScore === next.bScore && previous.winner === next.winner) return false;
  state.results = {...(state.results || {}), [state.week]: next};
  await pushSharedState();
  return true;
}

function seasonRecord(teamId){
  const summary = {wins:0, losses:0, ties:0, pointsFor:0, pointsAgainst:0};
  for (const result of Object.values(state.results || {})) {
    const own = teamId === state.teams[0].id ? result.aScore : result.bScore;
    const opponent = teamId === state.teams[0].id ? result.bScore : result.aScore;
    summary.pointsFor += Number(own || 0);
    summary.pointsAgainst += Number(opponent || 0);
    if (result.winner === 'tie') summary.ties++;
    else if (result.winner === teamId) summary.wins++;
    else summary.losses++;
  }
  return summary;
}
function isLocked(id){
  if (!id) return false;
  const player = players.find(p => p.id === id);
  const scheduleLock = gameStatusForPlayer(player).locked;
  if (!scheduleUnavailable && player && gameForTeam(player.team)) return scheduleLock;
  const s = getStat(id);
  return Boolean(s.game_id || s.gp || s.pass_att || s.rush_att || s.rec || s.snap || s.pts_ppr);
}

function setBootState(message, visible){
  const el=$('#bootMessage');
  if(!el) return;
  if(message) el.textContent=message;
  el.classList.toggle('visible', Boolean(visible));
}

function renderAll(){ renderMatchup(); renderPlayers(); renderLeague(); setBootState('', false); }

function renderMatchup(){
  const el = $('#view-matchup');
  const [a,b] = state.teams;
  const aScore = teamTotal(a), bScore = teamTotal(b);
  el.innerHTML = `
    <div class="hero-grid">
      <section class="score-card">
        <div class="score-head">
          <span class="eyebrow">Head to head</span>
          <div class="week-picker"><button data-week="prev">←</button><span>Week ${state.week}</span><button data-week="next">→</button></div>
        </div>
        <div class="score-body">
          ${teamScoreBlock(a,aScore,false)}
          <div class="versus">VS</div>
          ${teamScoreBlock(b,bScore,true)}
        </div>
      <div class="score-foot"><span>${winnerText(aScore,bScore)}</span><span class="status-pill ${refreshSummaryTone()}"><span class="live-dot"></span> ${esc(refreshSummary())}</span></div>
      </section>
      <aside class="week-card">
        <div><span class="eyebrow">Season ${nflState.season || ''}</span><h2>Current week</h2></div>
        <div><div class="big">${String(state.week).padStart(2,'0')}</div><div class="muted">NFL regular season</div><div class="week-status ${weekRosterLocked()?'closed':''}">${weekRosterLocked()?'Lineup locked':'Lineup open until kickoff'}</div></div>
      </aside>
    </div>
    <div class="matchup-columns">
      ${rosterCard(a)}
      ${rosterCard(b)}
    </div>`;
  $$('[data-week]', el).forEach(btn => btn.addEventListener('click', async () => {
    const next = btn.dataset.week === 'next' ? state.week+1 : state.week-1;
    activateWeek(next);
    await pushSharedState();
    await Promise.all([
      loadWeekStats(state.week,true),
      loadWeekSchedule(state.week,true)
    ]);
    await recordCompletedWeek();
    configureAutoRefresh();
    renderAll();
  }));
  $$('.player-row[data-player]', el).forEach(r => r.addEventListener('click', () => openPlayer(r.dataset.player)));
}

function teamScoreBlock(team, score, right){
  const projection = teamProjection(team);
  return `<div class="team-score ${right?'right':''}">
    <div class="team-meta">${right?`<div><div class="team-name">${esc(team.name)}</div></div>${logo(team)}`:`${logo(team)}<div><div class="team-name">${esc(team.name)}</div></div>`}</div>
    <div class="score">${fmt(score)}</div>
    <div class="score-label">PPR actual</div>
    <div class="score-projection"><span>Projected</span><strong>${projection === null ? '—' : fmt(projection)}</strong></div>
  </div>`;
}
function winnerText(a,b){
  const result=resultForWeek(state.week);
  if (result || weekIsComplete()) {
    if (result?.winner === 'tie' || (!result && a===b)) return 'Week tied';
    const winnerId=result?.winner || (a>b ? state.teams[0].id : state.teams[1].id);
    return winnerId===state.teams[0].id ? `${state.teams[0].name} wins` : `${state.teams[1].name} wins`;
  }
  if (!a && !b) return 'Week has not started';
  if (a===b) return 'Currently tied';
  return a>b ? `${state.teams[0].name} leads` : `${state.teams[1].name} leads`;
}
function logo(team){ return `<div class="logo-box">${team.logo?`<img src="${team.logo}" alt="">`:esc(team.name.slice(0,2).toUpperCase())}</div>`; }

function rosterCard(team){
  const slots=activeRosterSlots();
  const filled=slots.filter(slot=>team.roster?.[slot]).length;
  return `<section class="roster-card">
    <div class="roster-head"><h3>${esc(team.name)}</h3><span class="small">${filled}/${activeRosterSize()}</span></div>
    ${STARTER_SLOTS.map(slot => rosterRow(team,slot)).join('')}
    ${state.benchEnabled ? `<div class="bench-label">Bench</div>${BENCH_SLOTS.map(slot => rosterRow(team,slot)).join('')}` : ''}
  </section>`;
}
function rosterRow(team, slot){
  const id = team.roster?.[slot];
  if (!id) return `<div class="player-row" data-empty-slot="${slot}" data-team="${team.id}"><div class="slot">${slotLabel(slot)}</div><div class="avatar"></div><div class="player-main"><div class="player-name">Empty slot</div><div class="player-sub">Assign from Players</div></div><div class="player-points"><strong>—</strong></div></div>`;
  const p = players.find(x=>x.id===id) || {id,name:id,team:'',position:slot};
  const pts = pointsFor(id), locked = isLocked(id) || weekRosterLocked(), status = gameStatusForPlayer(p);
  return `<div class="player-row ${locked?'locked':''}" data-player="${id}">
    <div class="slot">${slotLabel(slot)}</div>
    <img class="avatar${playerImageClass(p)}" src="${playerPhoto(p)}" alt="" onerror="this.style.visibility='hidden'">
    <div class="player-main"><div class="player-name">${esc(p.name)}</div><div class="player-sub"><span>${esc(p.team||'FA')} · ${esc(p.position)}</span>${p.injury?`<span>${esc(p.injury)}</span>`:''}<span class="game-status ${status.tone}">${esc(gameLabelForPlayer(p))}</span></div></div>
    <div class="player-points"><strong>${fmt(pts)}</strong><span>PPR actual</span><small class="player-projection">Proj ${projectionDisplay(id)}</small></div>
  </div>`;
}

function filteredPlayerList(){
  const list = players.filter(p => filteredTeams.has(p.team) && (activePosition==='ALL' || p.position===activePosition) && (!query || p.name.toLowerCase().includes(query.toLowerCase())) && playerMatchesFilters(p));
  list.sort((a,b)=> sortMode==='name' ? a.name.localeCompare(b.name) : sortMode==='proj' ? projectedFor(b.id)-projectedFor(a.id) : a.rank-b.rank);
  return list;
}
function renderPlayerList(el){
  const listEl = $('.player-list', el);
  if(!listEl) return;
  const list = filteredPlayerList();
  listEl.innerHTML = list.map((p,i)=>playerListRow(p,i)).join('') || '<div class="empty">No players match these filters.</div>';
  $$('.player-row[data-player]',listEl).forEach(r=>r.addEventListener('click',()=>openPlayer(r.dataset.player)));
}
function renderPlayers(){
  const el = $('#view-players');
  const list = filteredPlayerList();
  el.innerHTML = `
    <div class="view-intro players-intro"><div><span class="eyebrow">${esc(nflState.season || '')} player pool</span><h1>Find the edge.</h1></div><p>Every active player is here. Search the league, build a roster, and pretend the projections were your idea.</p></div>
    <div class="players-toolbar">
      <div class="search-box"><input id="playerSearch" type="search" placeholder="Search players" value="${escAttr(query)}"></div>
      <button class="filter-btn" id="toggleTeams">NFL teams · ${filteredTeams.size}</button>
      <div class="sort-wrap"><select class="sort-select" id="sortSelect"><option value="rank" ${sortMode==='rank'?'selected':''}>Top rated</option><option value="proj" ${sortMode==='proj'?'selected':''}>Projected points</option><option value="name" ${sortMode==='name'?'selected':''}>Name</option></select></div>
    </div>
    <div class="team-filters" id="teamFilters">${TEAM_CODES.map(t=>`<button class="team-chip ${filteredTeams.has(t)?'active':''}" data-team-filter="${t}">${t}</button>`).join('')}</div>
    <div class="position-filters">${POSITIONS.map(p=>`<button class="position-chip ${p===activePosition?'active':''}" data-pos="${p}">${p}</button>`).join('')}</div>
    <div class="filter-groups"><div class="filter-group"><span class="filter-label">Ownership</span>${[['all','All players'],['available','Available'],...state.teams.map(t=>[t.id,t.name])].map(([value,label])=>`<button class="filter-chip ${ownershipFilter===value?'active':''}" data-owner-filter="${escAttr(value)}">${esc(label)}</button>`).join('')}</div><div class="filter-group"><span class="filter-label">Status</span>${[['all','All status'],['active','Active'],['injured','Injured']].map(([value,label])=>`<button class="filter-chip ${healthFilter===value?'active':''}" data-health-filter="${value}">${label}</button>`).join('')}</div></div>
    <div class="player-list">${list.map((p,i)=>playerListRow(p,i)).join('') || '<div class="empty">No players match these filters.</div>'}</div>`;

  $('#playerSearch').addEventListener('input', e=>{ query=e.target.value; renderPlayerList(el); });
  $('#sortSelect').addEventListener('change', e=>{ sortMode=e.target.value; renderPlayers(); });
  $('#toggleTeams').addEventListener('click', ()=>{ filteredTeams = filteredTeams.size ? new Set() : new Set(TEAM_CODES); renderPlayers(); });
  $$('[data-team-filter]',el).forEach(b=>b.addEventListener('click',()=>{ const t=b.dataset.teamFilter; filteredTeams.has(t)?filteredTeams.delete(t):filteredTeams.add(t); renderPlayers(); }));
  $$('[data-pos]',el).forEach(b=>b.addEventListener('click',()=>{activePosition=b.dataset.pos; renderPlayers();}));
  $$('[data-owner-filter]',el).forEach(b=>b.addEventListener('click',()=>{ownershipFilter=b.dataset.ownerFilter; renderPlayers();}));
  $$('[data-health-filter]',el).forEach(b=>b.addEventListener('click',()=>{healthFilter=b.dataset.healthFilter; renderPlayers();}));
  $$('.player-row[data-player]',el).forEach(r=>r.addEventListener('click',()=>openPlayer(r.dataset.player)));
}
function playerListRow(p,i){
  const owner=ownerOf(p.id), pts=projectedFor(p.id), status=gameStatusForPlayer(p);
  return `<div class="player-row" data-player="${p.id}"><div class="rank">${Math.min(p.rank,9999)===9999?'—':p.rank}</div><img class="avatar${playerImageClass(p)}" src="${playerPhoto(p)}" alt="" onerror="this.style.visibility='hidden'"><div class="player-main"><div class="player-name">${esc(p.name)}</div><div class="player-sub"><span>${p.team}</span><span>${p.position}</span>${p.injury?`<span>${esc(p.injury)}</span>`:''}<span class="game-status ${status.tone}">${esc(gameLabelForPlayer(p))}</span></div></div><div class="player-points"><strong>${pts?fmt(pts):'—'}</strong><span>proj.</span></div><div class="owner-tag ${owner?'':'free'}">${owner?esc(owner.name):'Available'}</div></div>`;
}

function renderLeague(){
  const el=$('#view-league');
  const sharedConfigured=Boolean(CFG.supabaseUrl && SUPABASE_KEY);
  const leagueSyncMessage=syncReady
    ? 'Shared sync is connected. Both laptops using this URL will share the league.'
    : sharedConfigured
      ? 'Supabase is configured, but the connection needs attention. Check the sync indicator above.'
      : 'Local mode works immediately. Add free Supabase values in config.js to make both browsers share the same roster in real time.';
  el.innerHTML=`<div class="view-intro league-intro"><div><span class="eyebrow">Private league / setup</span><h1>Make it yours.</h1></div><p>Connect the two laptops, name the teams, then redraft the rosters together every week.</p></div><div class="league-grid">
    ${setupGuideCard()}
    ${teamSetupCard(state.teams[0])}
    ${teamSetupCard(state.teams[1])}
    ${seasonCard()}
    <section class="setup-card league-settings-card"><h2>League settings</h2><div class="field"><label>Shared league ID</label><input value="${escAttr(CFG.leagueId||'whats-nest-private')}" disabled></div><label class="setting-toggle" for="benchToggle"><input id="benchToggle" type="checkbox" ${state.benchEnabled?'checked':''}><span class="toggle-ui" aria-hidden="true"></span><span class="setting-copy"><strong>Enable six-player bench</strong><small>${state.benchEnabled?'On · bench slots are available when drafting.':'Off · nine starters only for now.'}</small></span></label><p class="small">${leagueSyncMessage}</p><button class="secondary" id="clearLeague">Reset league</button></section>
    <section class="setup-card"><h2>Transactions</h2><div class="transaction-list">${state.transactions.length?state.transactions.slice().reverse().slice(0,20).map(tx=>`<div class="transaction"><span>${esc(tx.text)}</span><time>${new Date(tx.ts).toLocaleString()}</time></div>`).join(''):'<div class="small">No roster moves yet.</div>'}</div></section>
  </div>`;
  $$('[data-team-form]',el).forEach(form=>form.addEventListener('submit',async e=>{
    e.preventDefault(); const id=form.dataset.teamForm; const team=state.teams.find(t=>t.id===id); team.name=form.elements.name.value.trim()||team.name; await pushSharedState(); renderAll(); showToast('Team saved');
  }));
  $$('[data-logo]',el).forEach(inp=>inp.addEventListener('change',e=>{ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=async()=>{state.teams.find(t=>t.id===inp.dataset.logo).logo=r.result; await pushSharedState(); renderAll();}; r.readAsDataURL(f); }));
  $('#benchToggle',el).addEventListener('change',async e=>{ state.benchEnabled=e.target.checked; await pushSharedState(); renderAll(); showToast(state.benchEnabled?'Bench enabled · six slots available':'Bench off · starters only'); });
  $('#clearLeague').addEventListener('click',async()=>{ if(confirm('Reset both teams and all roster moves?')){ state=defaultState(); await pushSharedState(); renderAll(); } });
}

function setupGuideCard(){
  const sharedConfigured=Boolean(CFG.supabaseUrl && SUPABASE_KEY);
  const rosterPlan=state.benchEnabled ? 'rebuild both 15-player rosters, including six bench slots' : 'rebuild both nine-player starting rosters';
  const lineupPlan=state.benchEnabled ? 'Use Move player to place starters and bench players.' : 'Use Move player to arrange the nine starters. Turn on the bench in League later if you want six extra slots.';
  const syncLabel=syncReady ? 'Shared sync connected' : sharedConfigured ? 'Shared sync needs attention' : 'Local mode only';
  const syncClass=syncReady ? 'ready' : sharedConfigured ? 'attention' : '';
  const syncIntro=syncReady
    ? 'Both laptops can use the same public URL. The league state is shared; the NFL feed remains public and free.'
    : sharedConfigured
      ? 'The shared settings are present, but the connection needs attention. Check the sync dot above before drafting.'
      : 'This copy is local-only until Supabase is configured. Two laptops will otherwise create two perfectly independent realities.';
  const setupInstructions=syncReady ? '' : `<div class="sync-setup"><div><div class="eyebrow">One-time connection</div><strong>Make both laptops share one league</strong><span>Supabase stores the league state. It does not host this website, and it does not need your fantasy life story.</span></div><ol class="sync-steps"><li>Create a free Supabase project.</li><li>Run <code>supabase.sql</code> in SQL Editor.</li><li>Paste the Project URL and publishable key into <code>config.js</code>.</li><li>Deploy this folder and open the same URL on both laptops.</li></ol><a class="guide-link" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase ↗</a></div>`;
  return `<section class="setup-card guide-card"><div class="guide-head"><div><div class="eyebrow">Start here</div><h2>Weekly redraft setup</h2></div><span class="setup-badge ${syncClass}">${syncLabel}</span></div><p class="guide-intro">${syncIntro}</p>${setupInstructions}<ol class="guide-steps"><li><strong>Open the same public URL</strong><span>Both of you use the deployed site, not separate downloaded copies. Browsers enjoy making this sound more complicated than it is.</span></li><li><strong>Name your teams</strong><span>Set the two team names once, save them, and add logos only if the league deserves branding.</span></li><li><strong>Redraft from Players</strong><span>At the start of each week, search players, drop or replace as needed, and ${rosterPlan}. There is no draft-room engine or commissioner ceremony—just two adults making increasingly confident decisions.</span></li><li><strong>Set the weekly lineup</strong><span>${lineupPlan} Each week keeps its own roster snapshot, and bench players do not score.</span></li><li><strong>Check Matchup before kickoff</strong><span>Review both rosters, projections, and player game status. A player locks at that player’s kickoff, so late heroics are mostly a scheduling problem.</span></li></ol><p class="guide-note">Redraft both teams together at the start of each week, then use Matchup as the weekly scoreboard. No login is used by design, so keep the public link between the two of you.</p></section>`;
}

function seasonCard(){
  const [a,b]=state.teams, ar=seasonRecord(a.id), br=seasonRecord(b.id);
  const results=Object.entries(state.results || {}).sort((x,y)=>Number(y[0])-Number(x[0]));
  return `<section class="setup-card season-card"><div class="eyebrow">Season ${esc(nflState.season || '')}</div><h2>Record</h2><div class="season-teams">${seasonTeamSummary(a,ar)}${seasonTeamSummary(b,br)}</div><div class="result-list">${results.length ? results.map(([week,result])=>resultRow(week,result)).join('') : '<div class="small">No completed weeks yet.</div>'}</div></section>`;
}

function seasonTeamSummary(team,record){
  return `<div class="season-team"><div class="season-team-head">${logo(team)}<div><strong>${esc(team.name)}</strong><div class="small">${record.wins}–${record.losses}–${record.ties}</div></div></div><div class="season-metrics"><span><strong>${fmt(record.pointsFor)}</strong><small>PF</small></span><span><strong>${fmt(record.pointsAgainst)}</strong><small>PA</small></span></div></div>`;
}

function resultRow(week,result){
  const [a,b]=state.teams;
  const winner=result.winner==='tie' ? 'Tie' : result.winner===a.id ? `${a.name} wins` : `${b.name} wins`;
  return `<div class="result-row"><span>Week ${esc(week)}</span><strong>${esc(winner)}</strong><span>${fmt(result.aScore)}–${fmt(result.bScore)}</span></div>`;
}
function teamSetupCard(team){
  return `<section class="setup-card team-setup-card team-${team.id}"><div class="team-card-rail"><span class="eyebrow">${team.id==='a'?'Team one':'Team two'}</span><span class="team-index">${team.id==='a'?'01':'02'}</span></div><div class="team-identity">${logo(team)}<div><h2>${esc(team.name)}</h2><p>Give this side a name worth defending.</p></div></div><form data-team-form="${team.id}"><div class="field"><label>Display name</label><input name="name" value="${escAttr(team.name)}"></div><div class="field"><label>Team mark</label><div class="upload-row"><div class="logo-box logo-preview">${team.logo?`<img src="${team.logo}" alt="">`:esc(team.name.slice(0,2).toUpperCase())}</div><label class="file-picker"><span>Choose logo</span><small>PNG, JPG, or SVG · square works best</small><input type="file" accept="image/*" data-logo="${team.id}"></label></div></div><button class="primary save-team-btn" type="submit"><span>Save team</span><span class="button-arrow">↗</span></button></form></section>`;
}

function openPlayer(id){
  const p=players.find(x=>x.id===id); if(!p)return;
  const d=$('#playerDialog'); const owner=ownerOf(id); const s=getStat(id), proj=getProj(id), status=gameStatusForPlayer(p);
  d.innerHTML=`<div class="dialog-content"><div class="dialog-top"><span class="eyebrow">${p.team} · ${p.position}</span><button class="close-btn" aria-label="Close">×</button></div><div class="player-hero"><img class="player-dialog-photo${playerImageClass(p)}" src="${playerPhoto(p)}" alt="${escAttr(p.name)}" onerror="this.style.visibility='hidden'"><div><h2>${esc(p.name)}</h2><div class="small">#${p.number||'—'} · ${p.status}${p.injury?` · ${p.injury}`:''}</div><div class="game-banner ${status.tone}">${esc(gameLabelForPlayer(p))}</div><div class="small" style="margin-top:8px">${owner?`Owned by ${esc(owner.name)}`:'Available'}</div></div></div><div class="stats-grid"><div class="stat-box"><span>This week</span><strong>${fmt(pointsFor(id))}</strong></div><div class="stat-box"><span>Projection</span><strong>${fmt(projectedFor(id))}</strong></div><div class="stat-box"><span>Rank</span><strong>${p.rank===9999?'—':p.rank}</strong></div><div class="stat-box"><span>Pass YD</span><strong>${s.pass_yd??'—'}</strong></div><div class="stat-box"><span>Rush YD</span><strong>${s.rush_yd??'—'}</strong></div><div class="stat-box"><span>Rec YD</span><strong>${s.rec_yd??'—'}</strong></div></div><div class="dialog-actions">${assignmentButtons(p,owner)}</div></div>`;
  $('.close-btn',d).addEventListener('click',()=>d.close());
  $$('[data-assign]',d).forEach(b=>b.addEventListener('click',()=>openAssignDialog(p.id,b.dataset.assign)));
  const move=$('[data-move]',d); if(move) move.addEventListener('click',()=>openMoveDialog(id));
  const drop=$('[data-drop]',d); if(drop) drop.addEventListener('click',async()=>{ if(weekRosterLocked()){showToast('This week is complete');return;} if(isLocked(id)){showToast('Player is locked for this week');return;} await removePlayer(id); d.close(); });
  d.showModal();
}
function assignmentButtons(p,owner){
  const locked = isLocked(p.id) || weekRosterLocked();
  const lockMessage = weekRosterLocked() ? 'Week complete · lineup changes are locked' : `${gameLabelForPlayer(p)} · lineup changes are locked`;
  if(owner) return locked
    ? `<div class="dialog-note">${esc(lockMessage)}</div>`
    : `<button class="primary" data-move="${p.id}">Move player</button><button class="danger" data-drop="${p.id}">Drop player</button>`;
  if(locked) return `<div class="dialog-note">${esc(weekRosterLocked() ? 'Week complete · lineup changes are locked' : `${gameLabelForPlayer(p)} · cannot add after kickoff`)}</div>`;
  return state.teams.map(t=>`<button class="primary" data-assign="${t.id}">Add to ${esc(t.name)}</button>`).join('');
}

function rosterSlot(team,id){
  return Object.entries(team.roster || {}).find(([, playerId]) => playerId === id)?.[0] || '';
}

function openMoveDialog(id){
  const p=players.find(x=>x.id===id), owner=ownerOf(id), current=owner && rosterSlot(owner,id), d=$('#teamDialog');
  if(!p || !owner || !current) return;
  if(weekRosterLocked()){ showToast('This week is complete'); return; }
  if(isLocked(id)){ showToast('Player is locked for this week'); return; }
  const options=activeRosterSlots().filter(slot=>slot!==current && slotEligible(p.position,slot)).map(slot=>{
    const occupantId=owner.roster?.[slot];
    const occupant=occupantId && players.find(x=>x.id===occupantId);
    const canSwap=!occupantId || (occupant && slotEligible(occupant.position,current) && !isLocked(occupantId));
    const label=occupant ? `Swap with ${esc(occupant.name)}` : 'Empty slot';
    return `<button class="move-option secondary" data-move-slot="${slot}" ${canSwap?'':'disabled'}><span>${slotLabel(slot)}</span><small>${label}</small></button>`;
  }).join('');
  d.innerHTML=`<div class="dialog-content"><div class="dialog-top"><div><span class="eyebrow">Move player</span><h2 style="margin:8px 0 0">${esc(p.name)}</h2><div class="small" style="margin-top:6px">Currently ${esc(slotLabel(current))} · ${esc(owner.name)}</div></div><button class="close-btn" aria-label="Close">×</button></div><div class="move-list">${options || '<div class="dialog-note">No eligible open slots.</div>'}</div></div>`;
  $('.close-btn',d).addEventListener('click',()=>d.close());
  $$('[data-move-slot]',d).forEach(b=>b.addEventListener('click',async()=>{
    if(await moveRosterPlayer(id,owner.id,b.dataset.moveSlot)) d.close();
  }));
  $('#playerDialog').close();
  d.showModal();
}

async function moveRosterPlayer(id,teamId,targetSlot){
  const team=state.teams.find(t=>t.id===teamId), p=players.find(x=>x.id===id);
  if(weekRosterLocked()){ showToast('This week is complete'); return false; }
  if(!team || !p || isLocked(id)) { showToast('Player is locked for this week'); return false; }
  const current=rosterSlot(team,id), existing=team.roster?.[targetSlot];
  if(!current || current===targetSlot || !slotEligible(p.position,targetSlot)) return false;
  if(existing){
    const existingPlayer=players.find(x=>x.id===existing);
    if(isLocked(existing) || !existingPlayer || !slotEligible(existingPlayer.position,current)){
      showToast('That slot cannot be swapped');
      return false;
    }
    team.roster[current]=existing;
  } else delete team.roster[current];
  team.roster[targetSlot]=id;
  const detail=existing ? `swapped ${p.name} with ${players.find(x=>x.id===existing)?.name || existing}` : `moved ${p.name} from ${slotLabel(current)} to ${slotLabel(targetSlot)}`;
  state.transactions.push({ts:Date.now(),text:`${team.name} ${detail}`});
  await pushSharedState();
  renderAll();
  showToast(`${p.name} moved to ${slotLabel(targetSlot)}`);
  return true;
}
function openAssignDialog(id,teamId){
  const p=players.find(x=>x.id===id), team=state.teams.find(t=>t.id===teamId), d=$('#teamDialog');
  if(!p || !team) return;
  if(weekRosterLocked()){ showToast('This week is complete'); return; }
  const eligible=activeRosterSlots().filter(slot=>slotEligible(p.position,slot));
  d.innerHTML=`<div class="dialog-content"><div class="dialog-top"><div><span class="eyebrow">Assign player</span><h2 style="margin:8px 0 0">${esc(p.name)}</h2></div><button class="close-btn" aria-label="Close">×</button></div><div class="dialog-actions" style="margin-top:24px">${eligible.map(slot=>`<button class="secondary" data-slot="${slot}">${slotLabel(slot)}${team.roster?.[slot]?' · replace':''}</button>`).join('')}</div></div>`;
  $('.close-btn',d).addEventListener('click',()=>d.close());
  $$('[data-slot]',d).forEach(b=>b.addEventListener('click',async()=>{
    const slot=b.dataset.slot; const existing=team.roster?.[slot];
    if(existing && isLocked(existing)){showToast('That roster slot is locked');return;}
    if(!team.roster)team.roster={};
    if(existing) delete team.roster[slot];
    team.roster[slot]=id;
    const existingPlayer=existing && players.find(x=>x.id===existing);
    const action=existing ? `replaced ${existingPlayer?.name || existing} with ${p.name} in ${slotLabel(slot)}` : `added ${p.name} to ${slotLabel(slot)}`;
    state.transactions.push({ts:Date.now(),text:`${team.name} ${action}`});
    await pushSharedState(); d.close(); $('#playerDialog').close(); renderAll(); showToast(`${p.name} added`);
  }));
  d.showModal();
}
function slotLabel(slot){
  if(/^BENCH[1-6]$/.test(slot)) return `Bench ${slot.slice(5)}`;
  return ({RB1:'RB 1',RB2:'RB 2',WR1:'WR 1',WR2:'WR 2'})[slot] || slot;
}
function slotEligible(pos,slot){
  const baseSlot=BENCH_SLOTS.includes(slot) || slot==='BENCH' ? 'BENCH' : ({RB1:'RB',RB2:'RB',WR1:'WR',WR2:'WR'})[slot] || slot;
  return baseSlot==='BENCH' || pos===baseSlot || (baseSlot==='FLEX' && ['RB','WR','TE'].includes(pos));
}
async function removePlayer(id,log=true){
  if(weekRosterLocked()){showToast('This week is complete');return false;}
  if(isLocked(id)){showToast('Player is locked for this week');return false;}
  for(const t of state.teams){ for(const [slot,pid] of Object.entries(t.roster||{})){ if(pid===id){ delete t.roster[slot]; if(log){ const p=players.find(x=>x.id===id); state.transactions.push({ts:Date.now(),text:`${t.name} dropped ${p?.name||id}`}); } await pushSharedState(); renderAll(); return true; } } }
  return false;
}

function fmt(n){ const x=Number(n||0); return x.toFixed(1).replace('.0',''); }
function esc(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escAttr(v=''){ return esc(v); }
let toastTimer;
function showToast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2200); }

$$('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b===btn));
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${btn.dataset.view}`));
}));
$('#refreshBtn').addEventListener('click',()=>loadNFLData(true));

document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refreshCurrentWeek(); });

async function boot(){
  renderAll();
  renderSaveStatus();
  clearInterval(saveStatusTimer);
  saveStatusTimer = setInterval(renderSaveStatus, 15_000);
  await initSupabase();
  await loadNFLData();
}

boot();
