import { APP_CONFIG } from './config.js?v=11';
import { getNflState, getWeekData } from './data-provider.js?v=12';
import { getEspnLeague, hasEspnSession, clearEspnSession, espnSyncConfigured, espnPasswordlessReadAvailable } from './espn-provider.js?v=7';
import { initStore, selectedTeamId, selectTeam, clearSelectedTeam, loadLeague, subscribeLeague } from './store.js?v=17';
import { buildLiveFeed } from './feed.js?v=6';

const root = document.querySelector('#app');
const state = {
  storeMode: 'local',
  selectedTeam: selectedTeamId(),
  tab: 'matchup',
  matchupView: 'mine',
  week: APP_CONFIG.currentWeekFallback,
  players: [],
  playerMap: new Map(),
  league: null,
  dataSource: 'local',
  espnConfigured: espnSyncConfigured(),
  espnSession: hasEspnSession(),
  espnError: '',
  weeklyStatsAvailable: false,
  loading: true,
  networkOnline: typeof navigator === 'undefined' || navigator.onLine !== false,
  playerQuery: '',
  playerPosition: 'ALL',
  playerTeam: 'ALL',
  playerSort: 'rank',
  playerHealth: 'ALL',
  playerView: 'ALL',
  autoRefresh: readAutoRefreshPreference(),
  playingNowExpanded: false,
  feedStatus: 'not-requested',
  sheet: null,
  refreshTimer: null,
  unsub: null,
  lastRefresh: null,
  refreshError: '',
  globalEventsBound: false,
  pullTracking: false,
  pullRefreshing: false,
  pullReady: false,
  pullDistance: 0,
  touchStartY: 0,
  touchStartX: 0
};

boot();

async function boot() {
  root.innerHTML = shellLoading();
  try {
    const store = await initStore();
    state.storeMode = store.mode;
    state.league = await loadLeague(state.week);
    if (state.espnConfigured && espnPasswordlessReadAvailable()) state.league = emptyWatchLeague();
    render();
    const nfl = await getNflState();
    state.week = Number(nfl.display_week || nfl.week || APP_CONFIG.currentWeekFallback);
    await refreshAll({ renderOnStart: true });
    state.unsub = await subscribeLeague(() => refreshLeague());
    render();
    scheduleAutoRefresh();
  } catch (error) {
    console.error(error);
    state.loading = false;
    state.refreshError = 'League data could not be loaded. Try refreshing.';
    render();
  }
}

async function refreshAll({ renderOnStart = false } = {}) {
  state.loading = true;
  state.refreshError = '';
  const includeFeed = state.tab === 'feed';
  if (includeFeed) state.feedStatus = 'loading';
  state.espnSession = hasEspnSession();
  if (renderOnStart) render();
  if (!state.networkOnline && state.storeMode === 'cloud') {
    state.loading = false;
    state.refreshError = 'You are offline. Shared league data will refresh when you reconnect.';
    if (renderOnStart) render();
    return;
  }
  try {
    const [nflResult, localLeague] = await Promise.all([getWeekData(state.week), loadLeague(state.week)]);
    state.weeklyStatsAvailable = Boolean(nflResult.weeklyStatsAvailable);
    let espnLeague = null;
    if (state.espnConfigured && (state.espnSession || espnPasswordlessReadAvailable())) {
      try {
        espnLeague = await getEspnLeague(state.week, { includeFeed });
        state.espnError = '';
        if (includeFeed) {
          state.feedStatus = espnLeague.feedStatus === 'ready' ? 'ready' : 'unavailable';
        }
      } catch (error) {
        console.error(error);
        state.espnError = error.message || 'ESPN sync failed.';
        if (includeFeed) state.feedStatus = 'unavailable';
        if (error.status === 401) {
          clearEspnSession();
          state.espnSession = false;
        }
      }
    }
    const liveReadConfigured = state.espnConfigured && espnPasswordlessReadAvailable();
    state.dataSource = espnLeague ? 'espn' : liveReadConfigured ? 'unavailable' : state.storeMode === 'cloud' ? 'shared' : 'local';
    state.players = espnLeague ? mergeEspnPlayers(espnLeague.players, nflResult.players, state.weeklyStatsAvailable) : liveReadConfigured ? [] : nflResult.players;
    state.playerMap = new Map(state.players.map((p) => [p.id,p]));
    state.league = espnLeague || (liveReadConfigured ? emptyWatchLeague() : localLeague);
    if (state.selectedTeam && !state.league.teams.some((team) => team.id === state.selectedTeam)) {
      clearSelectedTeam();
      state.selectedTeam = '';
    }
    state.lastRefresh = new Date();
  } catch (error) {
    console.error(error);
    state.refreshError = 'Live data is unavailable. Showing the last loaded state.';
    if (includeFeed) state.feedStatus = 'unavailable';
  }
  state.loading = false;
}

async function refreshLeague() {
  if (state.dataSource === 'espn') {
    await refreshAll();
    render();
    return;
  }
  try {
    state.league = await loadLeague(state.week);
    state.refreshError = '';
  } catch (error) {
    console.error(error);
    state.refreshError = 'Shared league data could not be refreshed.';
  }
  render();
}

function scheduleAutoRefresh() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = null;
  if (!state.autoRefresh || !state.networkOnline || document.hidden) return;
  const anyLive = state.players.some((p) => p.game?.started && !p.game?.ended);
  const kickoffSoon = state.players.some((p) => {
    const kickoff = Date.parse(p.game?.kickoff || '');
    return Number.isFinite(kickoff) && kickoff > Date.now() && kickoff - Date.now() <= 30 * 60000;
  });
  const wait = anyLive || kickoffSoon ? 60000 : 300000;
  state.refreshTimer = setTimeout(async () => { await refreshAll(); render(); scheduleAutoRefresh(); }, wait);
}

function render() {
  if (state.loading && state.espnConfigured && espnPasswordlessReadAvailable() && !state.league?.teams?.length) {
    root.innerHTML = shellLoading();
    return;
  }
  if (!state.selectedTeam) return renderTeamGate();
  root.innerHTML = appFrame();
  bindGlobal();
  if (state.sheet) bindSheet();
}

function renderTeamGate() {
  const hasRoster = Object.values(state.league?.roster || {}).some((players) => players.length);
  const teams = state.dataSource === 'espn' || hasRoster || state.storeMode === 'cloud'
    ? (state.league?.teams || APP_CONFIG.teams)
    : [];
  const liveConnected = state.dataSource === 'espn';
  const liveUnavailable = state.dataSource === 'unavailable';
  const localStateActive = state.dataSource === 'local' && hasRoster;
  root.innerHTML = `
    <main class="gate">
      <div class="gate-brand">${APP_CONFIG.appName.toUpperCase()}</div>
      <section class="gate-panel">
        <p class="eyebrow">${APP_CONFIG.leagueName.toUpperCase()} · ${APP_CONFIG.season}</p>
        <h1>Who are you?</h1>
        <p class="muted">${liveConnected ? 'Live ESPN league connected. Tap your team.' : liveUnavailable ? 'Live ESPN data is unavailable. No local league data is shown.' : localStateActive ? 'Local state · view only.' : 'Loading the live ESPN league…'}</p>
        ${state.loading ? '<div class="data-status" role="status">Loading league…</div>' : ''}
        ${!state.networkOnline && state.storeMode === 'cloud' ? '<div class="data-status error" role="status">You are offline. Shared league data is paused.</div>' : ''}
        ${state.refreshError ? `<div class="data-status error" role="alert"><span>${escapeHtml(state.refreshError)}</span><button class="status-retry" data-action="retry-refresh">Retry</button></div>` : ''}
        ${state.espnConfigured && !state.espnSession && !espnPasswordlessReadAvailable() ? `<div class="data-status connection-status" role="status"><span>Exact teams and lineups load from the existing Sheeesh ESPN connection.</span><a class="connection-link" href="${escapeAttr(APP_CONFIG.espnSync.connectionUrl)}">Connect ESPN ↗</a></div>` : ''}
        ${state.espnConfigured && state.dataSource !== 'espn' && !state.espnSession && espnPasswordlessReadAvailable() && !state.espnError ? '<div class="data-status connection-status" role="status">Connecting to the live ESPN mirror…</div>' : ''}
        ${state.espnError ? `<div class="data-status error" role="alert"><span>${escapeHtml(state.espnError)}</span><button class="status-retry" data-action="retry-refresh">Retry live data</button></div>` : ''}
        ${teams.length ? `<div class="team-grid">${teams.map(teamLogoCard).join('')}</div>` : '<div class="data-status">Live ESPN data is unavailable. No local league state is loaded.</div>'}
      </section>
    </main>`;
  root.querySelectorAll('[data-team-pick]').forEach((btn) => btn.addEventListener('click', () => {
    state.selectedTeam = btn.dataset.teamPick;
    selectTeam(state.selectedTeam);
    render();
  }));
  root.querySelector('[data-action="retry-refresh"]')?.addEventListener('click', async () => { await refreshAll({ renderOnStart: true }); render(); });
}


function appFrame() {
  const team = teamById(state.selectedTeam);
  return `
    <div class="app-shell">
      ${pullRefreshMarkup()}
      <header class="topbar">
        <button class="brand-button" data-action="home"><span class="brand-ball" aria-hidden="true">🏈</span><span>${APP_CONFIG.appName}</span></button>
        <nav class="primary-nav" aria-label="Primary">
          ${navButton('matchup','Matchup',iconVs())}
          ${navButton('team','Team',iconTeam())}
          ${navButton('players','Players',iconSearch())}
          ${navButton('league','League',iconLeague())}
          ${navButton('feed','Feed',iconFeed())}
        </nav>
        <div class="topbar-right">
          <span class="sync-dot ${state.dataSource === 'espn' || state.storeMode === 'cloud' ? 'online' : ''}" role="status" aria-label="${state.dataSource === 'espn' ? 'ESPN league connected' : state.storeMode === 'cloud' ? 'Shared league connected' : 'Local preview mode'}"></span>
          <button class="avatar-button" data-action="switch-team">${logoMarkup(team, 'tiny')}</button>
        </div>
      </header>
      ${state.tab !== 'feed' && state.dataSource === 'espn' ? `<div class="data-status connection-status" role="status"><span>Live ESPN mirror · view only</span><span>${lastRefreshLabel()}</span></div>` : ''}
      ${state.tab !== 'feed' && state.dataSource !== 'espn' && state.lastRefresh ? `<div class="data-status connection-status" role="status"><span>Local preview · view only</span><span>${lastRefreshLabel()}</span></div>` : ''}
      ${state.dataSource !== 'espn' && state.espnError ? `<div class="data-status error" role="alert"><span>Live ESPN mirror unavailable. Local preview data is shown.</span><button class="status-retry" data-action="retry-refresh">Retry live data</button></div>` : ''}
      ${!state.networkOnline && state.storeMode === 'cloud' ? '<div class="data-status error" role="status">Offline · shared league updates paused</div>' : ''}
      ${state.loading ? '<div class="data-status" role="status">Updating live data…</div>' : ''}
      ${state.dataSource === 'espn' && !state.loading && !state.weeklyStatsAvailable ? '<div class="data-status error" role="status">Current-week player stats are unavailable. ESPN matchup totals are shown where available; retry to reload weekly stats.</div>' : ''}
      ${state.refreshError ? `<div class="data-status error" role="alert"><span>${escapeHtml(state.refreshError)}</span><button class="status-retry" data-action="retry-refresh">Retry</button></div>` : ''}
      <main class="page"><div class="page-content page-${state.tab}">${pageContent()}</div></main>
      ${state.sheet ? renderSheet() : ''}
    </div>`;
}

function pageContent() {
  if (state.tab === 'team') return teamPage();
  if (state.tab === 'players') return playersPage();
  if (state.tab === 'league') return leaguePage();
  if (state.tab === 'feed') return feedPage();
  return matchupPage();
}

function matchupPage() {
  const mine = teamById(state.selectedTeam);
  const opponentId = opponentFor(state.selectedTeam);
  const opp = teamById(opponentId) || (state.dataSource === 'espn' ? null : APP_CONFIG.teams.find((t) => t.id !== mine.id));
  const mineScore = teamScore(mine.id);
  const oppScore = teamScore(opp?.id);
  const mineProj = teamProjection(mine.id);
  const oppProj = teamProjection(opp?.id);
  const status = matchupStatus(mine, opp);
  return `
    <section class="view-intro matchup-intro">
      <div><p class="eyebrow">${APP_CONFIG.leagueName.toUpperCase()} · ${APP_CONFIG.season}</p><h1>Matchup</h1></div>
      <div class="matchup-intro-meta"><div class="week-picker"><button data-week="prev" aria-label="Previous week" ${state.week <= 1 ? 'disabled' : ''}>←</button><span>Week ${state.week}</span><button data-week="next" aria-label="Next week" ${state.week >= 18 ? 'disabled' : ''}>→</button></div><button class="icon-button" data-action="refresh" aria-label="Refresh" aria-busy="${state.loading}" ${state.loading ? 'disabled' : ''}>${iconRefresh()}</button></div>
    </section>
    <div class="hero-grid">
      <section class="score-card">
        <div class="score-head"><span class="eyebrow">Head to head</span><span class="score-week">Week ${state.week}</span></div>
        <div class="score-body">
          ${scoreTeam(mine, mineScore, mineProj, false)}
          <div class="versus">VS</div>
          ${scoreTeam(opp, oppScore, oppProj, true)}
        </div>
        <div class="score-foot"><span>${matchupLead(mine, opp, mineScore, oppScore)}</span><span class="status-pill"><span class="live-dot"></span>${status}</span></div>
      </section>
    </div>
    <div class="matchup-columns">
      ${matchupRosterCard(mine)}
      ${matchupRosterCard(opp)}
    </div>
  `;
}

function teamPage() {
  const team = teamById(state.selectedTeam);
  const counts = lineupCounts(team.id);
  const score = teamScore(team.id);
  const projection = teamProjection(team.id);
  const status = teamGameState(team.id);
  return `
    <section class="view-intro"><div><p class="eyebrow">YOUR TEAM · WEEK ${state.week}</p><h1>Team</h1></div></section>
    <section class="team-summary-card"><div class="team-summary-identity">${logoMarkup(team, 'hero')}<div><p class="eyebrow">${escapeHtml(team.name)}</p><h2>${team.wins || 0}-${team.losses || 0} record</h2><p>Waiver ${team.waiver_priority || '—'} · ${weekContextLabel(status)}</p></div></div><div class="team-summary-score"><span>Week ${state.week} · PPR actual</span><strong>${fmt(score)}</strong><div><span>Projected</span><b>${fmt(projection)}</b></div></div></section>
    <div class="team-roster-grid">
      <section class="setup-card roster-panel"><div class="roster-head"><h3>Starters</h3><span class="small">${counts.starters}/${counts.starterSlots}</span></div>${rosterRows(team.id, 'starters')}</section>
      <section class="setup-card roster-panel"><div class="roster-head"><h3>Bench</h3><span class="small">${counts.bench}/${counts.benchSlots}</span></div>${rosterRows(team.id, 'bench')}</section>
    </div>
  `;
}

function playersPage() {
  const owned = ownedPlayerIds();
  const teams = [...new Set(state.players.map((p) => p.nflTeam).filter(Boolean))].sort();
  let list = state.players.filter((p) => {
    const available = !owned.has(p.id);
    const viewOk = state.playerView === 'ALL' || (state.playerView === 'AVAILABLE' && available) || (state.playerView === 'OWNED' && !available);
    const posOk = state.playerPosition === 'ALL' || p.position === state.playerPosition;
    const teamOk = state.playerTeam === 'ALL' || p.nflTeam === state.playerTeam;
    const healthOk = state.playerHealth === 'ALL' || (state.playerHealth === 'INJURED' ? Boolean(injuryLabel(p)) : !injuryLabel(p));
    const q = state.playerQuery.trim().toLowerCase();
    const qOk = !q || `${p.name} ${p.nflTeam} ${p.position}`.toLowerCase().includes(q);
    return viewOk && posOk && teamOk && healthOk && qOk;
  });
  list.sort((a, b) => {
    if (state.playerSort === 'name') return a.name.localeCompare(b.name);
    if (state.playerSort === 'projection') return Number(b.projection || 0) - Number(a.projection || 0) || a.name.localeCompare(b.name);
    return playerRankValue(a) - playerRankValue(b) || Number(b.projection || 0) - Number(a.projection || 0);
  });
  return `
    <section class="view-intro"><div><p class="eyebrow">${APP_CONFIG.leagueName.toUpperCase()} · WEEK ${state.week}</p><h1>Players</h1></div><p>Search the full player pool, compare projections, and see who belongs to each team.</p></section>
    <div class="players-toolbar"><div class="search-box">${iconSearch()}<input data-player-search placeholder="Search players" value="${escapeHtml(state.playerQuery)}" /></div><select class="player-select" data-player-team aria-label="NFL team"><option value="ALL">All NFL teams</option>${teams.map((team) => `<option value="${escapeAttr(team)}" ${state.playerTeam === team ? 'selected' : ''}>${escapeHtml(team)}</option>`).join('')}</select><select class="player-select" data-player-sort aria-label="Sort players"><option value="rank" ${state.playerSort === 'rank' ? 'selected' : ''}>Top rated</option><option value="projection" ${state.playerSort === 'projection' ? 'selected' : ''}>Projected points</option><option value="name" ${state.playerSort === 'name' ? 'selected' : ''}>Name</option></select></div>
    <div class="players-filter-rail"><div class="chips horizontal-scroll">${['ALL','QB','RB','WR','TE','K','DEF'].map((p) => `<button class="chip ${state.playerPosition === p ? 'active' : ''}" data-position="${p}">${p}</button>`).join('')}</div><div class="segmented player-view" role="tablist" aria-label="Player ownership">${['ALL','AVAILABLE','OWNED'].map((v) => `<button class="${state.playerView === v ? 'active' : ''}" data-player-view="${v}" role="tab" aria-selected="${state.playerView === v}">${titleCase(v)}</button>`).join('')}</div><div class="segmented player-health" role="tablist" aria-label="Player status">${['ALL','ACTIVE','INJURED'].map((v) => `<button class="${state.playerHealth === v ? 'active' : ''}" data-player-health="${v}" role="tab" aria-selected="${state.playerHealth === v}">${titleCase(v)}</button>`).join('')}</div></div>
    <section class="player-list">
      ${list.map((p) => playerRow(p, owned.has(p.id))).join('') || '<div class="empty">No players match.</div>'}
    </section>`;
}

function leaguePage() {
  const teams = standingsTeams();
  const waiverTeams = [...teams].sort((a,b) => (a.waiver_priority || 99) - (b.waiver_priority || 99));
  const pendingClaims = (state.league?.claims || []).filter((claim) => claim.status === 'pending').slice(0,20);
  const recentMoves = (state.league?.transactions || []).slice(0,20);
  return `
    <section class="view-intro"><div><p class="eyebrow">${APP_CONFIG.leagueName.toUpperCase()} · ${APP_CONFIG.season}</p><h1>League</h1></div></section>
    <div class="league-grid">
      <section class="setup-card season-card"><div class="card-title"><span>Standings · Week ${state.week}</span><span class="small">Record</span></div><div class="season-teams">${teams.map((t, index) => seasonTeamCard(t, index + 1)).join('')}</div></section>
      <section class="setup-card waiver-order-card"><div class="card-title">Waiver order</div>${waiverTeams.map((t,i) => `<div class="waiver-row"><strong>${i+1}</strong>${logoMarkup(t,'tiny')}<span>${escapeHtml(t.name)}</span></div>`).join('')}</section>
      <section class="setup-card pending-card"><div class="card-title"><span>Pending waivers</span><span class="card-count">${pendingClaims.length}</span></div>${pendingClaims.map(waiverClaimRow).join('') || '<div class="empty compact">No pending claims.</div>'}</section>
      <section class="setup-card moves-card"><div class="card-title"><span>Recent league activity</span><span class="card-count">${recentMoves.length}</span></div>${recentMoves.map(transactionRow).join('') || '<div class="empty compact">No recent moves.</div>'}</section>
    </div>`;
}

function feedPage() {
  const events = buildLiveFeed({
    plays: state.league?.feedEvents || [],
    teams: state.league?.teams || [],
    roster: state.league?.roster || {},
    lineups: state.league?.lineups || {},
    players: state.playerMap,
    selectedTeamId: state.selectedTeam,
    opponentTeamId: opponentFor(state.selectedTeam),
  });
  const liveTeams = liveRosterTeams();
  const livePlayers = liveTeams.reduce((all, item) => all + item.players.length, 0);
  const livePoints = liveTeams.reduce((all, item) => all + item.players.reduce((sum, player) => sum + playerPoints(player), 0), 0);
  return '<section class="view-intro feed-intro"><h1>Feed</h1><p class="feed-week-label">' +
    escapeHtml(APP_CONFIG.leagueName) + ' · Week ' + state.week + '</p></section>' +
    '<section class="feed-controls" aria-label="Feed refresh controls">' +
      '<label class="feed-auto-control"><span>Auto refresh</span><input data-auto-refresh type="checkbox" ' +
      (state.autoRefresh ? 'checked ' : '') + 'aria-label="Automatically refresh league data"><span class="feed-switch" aria-hidden="true"></span></label>' +
      '<button class="feed-refresh-button" data-action="refresh-feed" aria-busy="' + state.loading + '"' +
      (state.loading ? ' disabled' : '') + '>' + iconRefresh() + '<span>Refresh</span></button>' +
    '</section>' +
    '<div class="feed-refresh-meta"><span>' + lastRefreshLabel() + '</span><span>' +
      (state.autoRefresh ? 'Every minute during live games · otherwise every 5 minutes' : 'Auto refresh off · pull down or tap Refresh') + '</span></div>' +
    feedSourceStatus(events.length) +
    '<section class="feed-playing"><button class="feed-playing-toggle" data-action="toggle-playing" aria-expanded="' +
      state.playingNowExpanded + '"><span class="feed-playing-title"><strong>Playing now</strong><small>' +
      livePlayers + ' roster ' + (livePlayers === 1 ? 'player' : 'players') + ' · ' + fmt(livePoints) +
      ' pts</small></span><span class="feed-playing-arrow" aria-hidden="true">' +
      (state.playingNowExpanded ? '−' : '+') + '</span></button>' +
      (state.playingNowExpanded ? renderLiveRoster(liveTeams) : '') + '</section>' +
    '<section class="feed-events" aria-label="Live scoring events">' +
      (events.length ? events.map(feedEventCard).join('') : '<div class="feed-empty">No fantasy scoring changes yet. Live plays will appear here as they happen.</div>') +
    '</section>';
}

function feedSourceStatus(eventCount) {
  if (state.feedStatus === 'loading') return '<div class="feed-live-note" role="status">Connecting to live ESPN play-by-play…</div>';
  if (state.feedStatus === 'unavailable') return '<div class="feed-live-note error" role="alert">Live ESPN play-by-play is unavailable right now. Sample events are never shown; try refreshing.</div>';
  if (state.dataSource !== 'espn') return '<div class="feed-live-note error" role="alert">The live ESPN mirror is required to show scoring events. Sample events are never shown.</div>';
  return '<div class="feed-live-note" role="status">' + (eventCount ? 'Live ESPN plays · newest first' : 'Live ESPN play-by-play connected · waiting for fantasy scoring changes') + '</div>';
}

function liveRosterTeams() {
  return (state.league?.teams || []).map((team) => {
    const players = [...new Set(state.league?.roster?.[team.id] || [])]
      .map((id) => state.playerMap.get(id))
      .filter((player) => player?.game?.started && !player.game.ended);
    return { team, players };
  }).filter((item) => item.players.length);
}

function renderLiveRoster(items) {
  if (!items.length) return '<div class="feed-playing-content"><div class="empty compact">No fantasy-roster players are in live NFL games right now.</div></div>';
  return '<div class="feed-playing-content">' + items.map((item) =>
    '<section class="feed-playing-team"><div class="feed-playing-team-head">' + logoMarkup(item.team, 'tiny') +
    '<strong>' + escapeHtml(item.team.name) + '</strong><span>' +
    fmt(item.players.reduce((sum, player) => sum + playerPoints(player), 0)) + ' pts</span></div>' +
    item.players.map((player) => '<div class="feed-playing-player"><span>' +
      escapeHtml(shortName(player.name)) + '</span><strong>' + fmt(playerPoints(player)) +
      '</strong></div>').join('') + '</section>'
  ).join('') + '</div>';
}

function feedEventCard(event) {
  const opposingGain = event.team.id === opponentFor(state.selectedTeam);
  const ownGain = event.team.id === state.selectedTeam;
  const impact = !event.isStarter ? 'neutral' : event.pointsDelta < 0 || opposingGain ? 'negative' : ownGain ? 'positive' : 'neutral';
  const context = !event.isStarter ? 'Bench player · no matchup-score impact' : opposingGain ? 'Against you'
    : ownGain ? 'Your matchup' : 'Around the league';
  const delta = event.pointsDelta < 0 ? '−' + fmt(Math.abs(event.pointsDelta)) : '+' + fmt(event.pointsDelta);
  const alert = event.pointsDelta >= 6
    ? '<span class="feed-alert" aria-label="Big scoring gain" title="Big scoring gain">🚨 <span>Big gain</span></span>'
    : '';
  const feedPlayerName = event.player.position === 'DEF' ? 'D/ST' : event.player.name;
  return '<article class="feed-event"><div class="feed-event-top ' + impact + '">' +
    '<div class="feed-event-team">' + logoMarkup(event.team, 'tiny') + '<div class="feed-event-team-copy"><strong>' +
    escapeHtml(event.team.name) + '</strong><span>' + escapeHtml(feedPlayerName) + (event.isStarter ? '' : ' · BENCH') +
    '</span></div></div><div class="feed-event-score">' + alert +
    '<strong class="feed-event-points">' + delta + ' pts</strong></div></div><div class="feed-event-context">' + escapeHtml(context) +
    ' · ' + escapeHtml(event.playType) + (event.quarter ? ' · Q' + event.quarter + (event.clock ? ' ' + escapeHtml(event.clock) : '') : '') + '</div><p>' + escapeHtml(event.commentary) +
    '</p><div class="feed-event-foot"><span class="feed-play-description">' + escapeHtml(event.play) + '</span><time>' +
    formatTimestamp(event.happenedAt) + '</time></div></article>';
}

function matchupRosterCard(team) {
  if (!team) return '<section class="setup-card roster-card"><div class="empty">Opponent not available.</div></section>';
  return `<section class="setup-card roster-card"><div class="roster-head"><h3>${escapeHtml(team.name)}</h3><span class="small">${fmt(teamScore(team.id))} PTS</span></div><div class="roster-section-label">Starters <span>PROJ · PTS</span></div>${rosterRows(team.id, 'starters')}<div class="roster-section-label bench-title">Bench <span>PROJ · PTS</span></div>${rosterRows(team.id, 'bench')}</section>`;
}

function seasonTeamCard(team, rank) {
  return `<article class="season-team"><div class="season-team-head"><strong class="season-rank">${String(rank).padStart(2, '0')}</strong>${logoMarkup(team,'tiny')}<div><strong>${escapeHtml(team.name)}</strong><div class="small">${team.wins || 0}-${team.losses || 0}${team.ties ? `-${team.ties}` : ''} record</div></div></div><div class="season-metrics"><span><strong>${fmt(teamScore(team.id))}</strong><small>Week ${state.week}</small></span><span><strong>${team.waiver_priority || '—'}</strong><small>Waiver</small></span></div></article>`;
}

function rosterRows(teamId, section = 'all') {
  const roster = state.league?.roster?.[teamId] || [];
  const lineup = state.league?.lineups?.[teamId] || {};
  const rows = roster.map((id) => {
    const player = state.playerMap.get(id);
    return { player, slot: player ? playerSlot(player, lineup[id]) : 'BE' };
  }).filter((x) => x.player);
  const filtered = rows.filter(({slot}) => section === 'all' || (section === 'bench' ? ['BE','IR'].includes(slot) : !['BE','IR'].includes(slot)));
  const visibleRows = [...filtered];
  if (filtered.length && (section === 'starters' || section === 'bench')) {
    const configuredSlots = activeRosterSlots();
    const expectedSlots = section === 'bench'
      ? configuredSlots.filter((slot) => slot === 'BE')
      : configuredSlots.filter((slot) => !['BE','IR'].includes(slot));
    const occupied = new Map();
    filtered.forEach(({slot}) => occupied.set(slot, (occupied.get(slot) || 0) + 1));
    [...new Set(expectedSlots)].forEach((slot) => {
      const used = occupied.get(slot) || 0;
      const capacity = expectedSlots.filter((candidate) => candidate === slot).length;
      for (let i = used; i < capacity; i += 1) visibleRows.push({ slot, empty: true });
    });
  }
  visibleRows.sort((a, b) => slotRank(a.slot) - slotRank(b.slot) || Number(Boolean(a.empty)) - Number(Boolean(b.empty)));
  if (!visibleRows.length) return '<div class="empty">No roster loaded yet.</div>';
  return visibleRows.map(({player,slot,empty}) => empty ? emptyRosterRow(slot) : rosterRow(player, slot)).join('');
}

function rosterRow(p, slot) {
  const locked = isLocked(p);
  return `<button class="roster-row" data-player-id="${p.id}" data-roster-action="view">
    <div class="slot ${locked ? 'locked' : ''}">${escapeHtml(slot)}${locked ? '<span class="lock-dot"></span>' : ''}</div>
    ${playerAvatar(p)}
    <div class="player-main"><strong>${escapeHtml(shortName(p.name))}</strong>${playerMeta(p)}</div>
    <div class="player-number"><span>${fmt(p.projection)}</span><strong>${fmt(playerPoints(p))}</strong></div>
  </button>`;
}

function emptyRosterRow(slot) {
  return `<div class="roster-empty-row"><div class="slot">${escapeHtml(slot)}</div><span class="player-avatar empty-avatar" aria-hidden="true">—</span><div class="player-main"><strong>Empty slot</strong><span>No player in this slot</span></div></div>`;
}

function playerRow(p, owned) {
  const locked = isLocked(p);
  const owner = ownerOf(p.id);
  const status = owner ? (teamById(owner)?.name || 'Owned') : 'Available';
  return `<button class="player-row" data-player-id="${p.id}" data-player-open>
    ${playerAvatar(p)}
    <div class="player-main"><strong>${escapeHtml(p.name)}</strong>${playerMeta(p, true)}</div>
    <div class="player-number"><span>PROJ</span><strong>${fmt(p.projection)}</strong><small>PTS ${fmt(playerPoints(p))}</small></div>
    <span class="ownership ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">${escapeHtml(status)}</span>
  </button>`;
}

function renderSheet() {
  const p = state.playerMap.get(state.sheet.playerId);
  if (!p) return '';
  const owner = ownerOf(p.id);
  const action = `<div class="locked-message">${state.dataSource === 'espn' ? 'Live ESPN mirror · view only. Changes remain in ESPN.' : 'Read-only preview. This app does not change league data.'}</div>`;
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <section class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <button class="sheet-close" data-action="close-sheet" aria-label="Close player details">×</button>
      <div class="player-detail">
        ${playerAvatar(p,'detail')}
        <p class="eyebrow">${escapeHtml(p.position)} · ${escapeHtml(p.nflTeam)}</p>
        <h2>${escapeHtml(p.name)}</h2>
        ${playerMeta(p, true)}
        <div class="detail-stats"><div><span>This week</span><strong>${fmt(playerPoints(p))}</strong></div><div><span>Projection</span><strong>${fmt(p.projection)}</strong></div><div><span>Rank</span><strong>${playerRankLabel(p)}</strong></div><div><span>Pass YD</span><strong>${statLabel(p, ['pass_yd','passYd','passing_yards'])}</strong></div><div><span>Rush YD</span><strong>${statLabel(p, ['rush_yd','rushYd','rushing_yards'])}</strong></div><div><span>Rec YD</span><strong>${statLabel(p, ['rec_yd','recYd','receiving_yards'])}</strong></div></div>
        ${owner ? `<div class="owned-by">Owned by ${escapeHtml(teamById(owner)?.name || 'team')}</div>` : '<div class="owned-by available">Available</div>'}
        ${action}
      </div>
    </section>`;
}

function bindGlobal() {
  root.querySelector('[data-action="home"]')?.addEventListener('click', () => { state.tab='matchup'; state.matchupView='mine'; state.sheet=null; render(); });
  root.querySelectorAll('[data-action="switch-team"]').forEach((b) => b.addEventListener('click', () => { clearSelectedTeam(); state.selectedTeam=''; render(); }));
  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.nav;
    state.sheet = null;
    if (state.tab === 'feed') state.feedStatus = state.dataSource === 'espn' ? 'loading' : 'unavailable';
    render();
    if (state.tab === 'feed' && state.dataSource === 'espn') {
      refreshAll().then(() => { render(); scheduleAutoRefresh(); });
    }
  }));
  root.querySelector('[data-action="refresh"]')?.addEventListener('click', async () => { await refreshAll({ renderOnStart: true }); render(); });
  root.querySelector('[data-action="refresh-feed"]')?.addEventListener('click', async () => { await refreshAll({ renderOnStart: true }); render(); scheduleAutoRefresh(); });
  root.querySelector('[data-action="toggle-playing"]')?.addEventListener('click', () => { state.playingNowExpanded = !state.playingNowExpanded; render(); });
  root.querySelector('[data-auto-refresh]')?.addEventListener('change', (event) => {
    state.autoRefresh = event.target.checked;
    try { window.localStorage.setItem('fantasheee.autoRefresh', state.autoRefresh ? 'on' : 'off'); } catch {}
    scheduleAutoRefresh();
    render();
  });
  root.querySelector('[data-action="retry-refresh"]')?.addEventListener('click', async () => { await refreshAll({ renderOnStart: true }); render(); });
  root.querySelectorAll('[data-week]').forEach((button) => button.addEventListener('click', async () => {
    const delta = button.dataset.week === 'next' ? 1 : -1;
    state.week = Math.max(1, Math.min(18, state.week + delta));
    await refreshAll({ renderOnStart: true });
    render();
  }));
  root.querySelectorAll('[data-matchup-view]').forEach((b) => b.addEventListener('click', () => { state.matchupView = b.dataset.matchupView; state.sheet = null; render(); }));
  root.querySelector('[data-player-search]')?.addEventListener('input', (e) => { state.playerQuery=e.target.value; render(); e.target.focus(); e.target.setSelectionRange(e.target.value.length,e.target.value.length); });
  root.querySelectorAll('[data-position]').forEach((b) => b.addEventListener('click', () => { state.playerPosition=b.dataset.position; render(); }));
  root.querySelectorAll('[data-player-view]').forEach((b) => b.addEventListener('click', () => { state.playerView=b.dataset.playerView; render(); }));
  root.querySelector('[data-player-team]')?.addEventListener('change', (e) => { state.playerTeam=e.target.value; render(); });
  root.querySelector('[data-player-sort]')?.addEventListener('change', (e) => { state.playerSort=e.target.value; render(); });
  root.querySelectorAll('[data-player-health]').forEach((b) => b.addEventListener('click', () => { state.playerHealth=b.dataset.playerHealth; render(); }));
  root.querySelectorAll('[data-player-open]').forEach((b) => b.addEventListener('click', () => { state.sheet={type:'view',playerId:b.dataset.playerId}; render(); }));
  bindRosterButtons();
  if (!state.globalEventsBound) {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.sheet) { state.sheet=null; render(); }
    });
    document.addEventListener('touchstart', handlePullStart, { passive: true });
    document.addEventListener('touchmove', handlePullMove, { passive: false });
    document.addEventListener('touchend', handlePullEnd, { passive: true });
    document.addEventListener('touchcancel', resetPull, { passive: true });
    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = null;
      } else scheduleAutoRefresh();
    });
    state.globalEventsBound = true;
  }
}

function bindRosterButtons() {
  root.querySelectorAll('[data-roster-action]').forEach((b) => b.addEventListener('click', () => { state.sheet={type:b.dataset.rosterAction,playerId:b.dataset.playerId}; render(); }));
}

function bindSheet() {
  root.querySelectorAll('[data-action="close-sheet"]').forEach((b) => b.addEventListener('click', () => { state.sheet=null; render(); }));
}

async function handleConnectivityChange() {
  state.networkOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!state.networkOnline) {
    render();
    scheduleAutoRefresh();
    return;
  }
  if (state.storeMode === 'cloud') await refreshAll({ renderOnStart: true });
  render();
  scheduleAutoRefresh();
}

function pullRefreshMarkup() {
  return `<div class="pull-refresh" data-pull-refresh aria-live="polite"><span class="pull-refresh-icon">↓</span><span class="pull-refresh-label">Pull to refresh</span></div>`;
}

function updatePullIndicator() {
  const indicator = root.querySelector('[data-pull-refresh]');
  if (!indicator) return;
  indicator.style.setProperty('--pull-distance', `${state.pullDistance}px`);
  indicator.classList.toggle('is-visible', state.pullTracking || state.pullRefreshing);
  indicator.classList.toggle('is-ready', state.pullReady);
  const label = indicator.querySelector('.pull-refresh-label');
  if (label) label.textContent = state.pullRefreshing ? 'Refreshing…' : state.pullReady ? 'Release to refresh' : 'Pull to refresh';
}

function handlePullStart(event) {
  if (state.loading || state.pullRefreshing || state.sheet || window.scrollY > 0 || !event.target.closest('.app-shell')) return;
  const touch = event.touches[0];
  if (!touch) return;
  state.pullTracking = true;
  state.pullReady = false;
  state.pullDistance = 0;
  state.touchStartY = touch.clientY;
  state.touchStartX = touch.clientX;
}

function handlePullMove(event) {
  if (!state.pullTracking || state.pullRefreshing) return;
  const touch = event.touches[0];
  if (!touch) return;
  const deltaY = touch.clientY - state.touchStartY;
  const deltaX = Math.abs(touch.clientX - state.touchStartX);
  if (deltaY <= 0 || deltaX > deltaY) {
    resetPull();
    return;
  }
  event.preventDefault();
  state.pullDistance = Math.min(92, Math.round(deltaY * 0.55));
  state.pullReady = state.pullDistance >= 58;
  updatePullIndicator();
}

async function handlePullEnd() {
  if (!state.pullTracking || state.pullRefreshing) return;
  const shouldRefresh = state.pullReady;
  state.pullTracking = false;
  if (!shouldRefresh) {
    resetPull();
    return;
  }
  state.pullRefreshing = true;
  state.pullDistance = 64;
  updatePullIndicator();
  await refreshAll();
  state.pullRefreshing = false;
  state.pullReady = false;
  state.pullDistance = 0;
  render();
  scheduleAutoRefresh();
}

function resetPull() {
  state.pullTracking = false;
  state.pullReady = false;
  state.pullDistance = 0;
  updatePullIndicator();
}

function eligibleSlots(position) {
  const list = ['BE'];
  if (['QB','K','DEF'].includes(position)) list.unshift(position);
  if (['RB','WR','TE'].includes(position)) list.unshift(position,'FLEX');
  return [...new Set(list)];
}

function playerSlot(p, slot) {
  const candidate = String(slot || 'BE').toUpperCase();
  if (candidate === 'IR') return candidate;
  return eligibleSlots(p.position).includes(candidate) ? candidate : 'BE';
}

function isLocked(p) {
  return Boolean(p?.game?.started || p?.game?.ended);
}

function activeRosterSlots() {
  return state.league?.rosterSlots?.length ? state.league.rosterSlots : APP_CONFIG.rosterSlots;
}

function slotRank(slot) {
  const rank = activeRosterSlots().indexOf(slot);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function teamLogoCard(team) { return `<button class="team-pick" data-team-pick="${escapeAttr(team.id)}">${logoMarkup(team,'gate')}<strong>${escapeHtml(team.name)}</strong></button>`; }
function logoMarkup(team,size='normal') {
  if(!team) return '<span class="team-logo"></span>';
  const variant = size === 'gate' ? 'gate-logo' : size;
  const teamClass = team.id ? escapeAttr(team.id) : '';
  const source = team.logo || team.logoFallback || '';
  const fallback = team.logoFallback && team.logoFallback !== source ? team.logoFallback : '';
  return source
    ? `<img class="team-logo ${variant} ${teamClass}" src="${escapeAttr(source)}" alt="${escapeAttr(team.name)}" ${fallback ? `data-fallback="${escapeAttr(fallback)}"` : ''} onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback}else{this.remove()}" />`
    : `<span class="team-logo ${variant} ${teamClass}">${escapeHtml(team.abbr || initials(team.name))}</span>`;
}
function scoreTeam(team, score, proj, right) {
  const status = teamGameState(team?.id);
  return `<div class="team-score ${right ? 'right' : ''}"><div class="team-meta">${right ? `<div><div class="team-name">${escapeHtml(team?.name || 'Opponent')}</div></div>${logoMarkup(team,'score')}` : `${logoMarkup(team,'score')}<div><div class="team-name">${escapeHtml(team?.name || 'Opponent')}</div></div>`}</div><div class="score">${fmt(score)}</div><div class="score-label">PPR actual · ${status}</div><div class="score-projection"><span>Projected</span><strong>${fmt(proj)}</strong></div></div>`;
}
function navButton(id,label,icon) { return `<button class="nav-item ${state.tab===id?'active':''}" data-nav="${id}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}" aria-current="${state.tab===id?'page':'false'}">${icon}<span>${label}</span></button>`; }
function teamById(id) { return (state.league?.teams || APP_CONFIG.teams).find((t)=>t.id===id) || APP_CONFIG.teams.find((t)=>t.id===id); }
function standingsTeams() { return [...(state.league?.teams || APP_CONFIG.teams)].sort((a,b) => Number(b.wins || 0) - Number(a.wins || 0) || Number(b.ties || 0) - Number(a.ties || 0) || Number(a.losses || 0) - Number(b.losses || 0) || Number(b.points_for || b.pointsFor || 0) - Number(a.points_for || a.pointsFor || 0) || Number(a.waiver_priority || 99) - Number(b.waiver_priority || 99)); }
function opponentFor(id) { return state.league?.matchups?.[id] || (state.dataSource === 'espn' ? '' : nextOpponent(id)); }
function nextOpponent(id) { const teams = (state.league?.teams || APP_CONFIG.teams).map((t)=>t.id); const i=teams.indexOf(id); return teams[i%2===0?i+1:i-1] || teams.find((x)=>x!==id); }
function ownedPlayerIds() { const set=new Set(); Object.values(state.league?.roster || {}).flat().forEach((id)=>set.add(id)); return set; }
function ownerOf(playerId) { return Object.entries(state.league?.roster || {}).find(([,ids])=>ids.includes(playerId))?.[0] || ''; }
function teamScore(id) {
  const scores = state.league?.teamScores || {};
  const rosterTotal = activeRosterPlayers(id).reduce((sum,p)=>sum+playerPoints(p),0);
  if (state.dataSource === 'espn' && state.weeklyStatsAvailable) return rosterTotal;
  if (id && Object.prototype.hasOwnProperty.call(scores, id)) return Number(scores[id]?.points || 0);
  return rosterTotal;
}
function teamProjection(id) {
  const sourced = state.league?.teamScores?.[id]?.projected;
  return Number.isFinite(Number(sourced)) && Number(sourced) > 0
    ? Number(sourced)
    : activeRosterPlayers(id).reduce((sum,p)=>sum+(p.projection||0),0);
}
function playerPoints(player) {
  return Number(player?.points || 0);
}
function matchupStatus(mine, opponent) {
  const states = [mine, opponent].filter(Boolean).map((team) => teamGameState(team.id));
  if (states.includes('LIVE')) return 'LIVE';
  if (states.length && states.every((value) => value === 'FINAL')) return 'FINAL';
  return 'UPCOMING';
}
function matchupLead(mine, opponent, mineScore, opponentScore) {
  if (!mine || !opponent) return 'Opponent not available';
  if (!mineScore && !opponentScore) return 'Week has not started';
  if (mineScore === opponentScore) return 'Currently tied';
  return mineScore > opponentScore ? `${mine.name} leads` : `${opponent.name} leads`;
}
function weekContextLabel(status) { return status === 'FINAL' ? 'Week complete' : status === 'LIVE' ? 'Players lock individually at kickoff' : 'Lineup open until kickoff'; }
function activeRosterPlayers(id) { const roster=state.league?.roster?.[id]||[]; const lineup=state.league?.lineups?.[id]||{}; return roster.map((pid)=>state.playerMap.get(pid)).filter(Boolean).filter((p)=>!['BE','IR'].includes(playerSlot(p,lineup[p.id]))); }
function lineupCounts(id) { const roster=state.league?.roster?.[id]||[]; const lineup=state.league?.lineups?.[id]||{}; const slots=roster.map((pid)=>{ const player=state.playerMap.get(pid); return player ? playerSlot(player,lineup[pid]) : 'BE'; }); const configuredSlots=activeRosterSlots(); return { starters:slots.filter((slot)=>!['BE','IR'].includes(slot)).length, starterSlots:configuredSlots.filter((slot)=>!['BE','IR'].includes(slot)).length, bench:slots.filter((slot)=>slot==='BE').length, benchSlots:configuredSlots.filter((slot)=>slot==='BE').length }; }
function teamGameState(id) { const games=activeRosterPlayers(id).map((p)=>p.game).filter(Boolean); if (games.some((game)=>game.started && !game.ended)) return 'LIVE'; if (games.length && games.every((game)=>game.ended)) return 'FINAL'; return 'UPCOMING'; }
function gameLabel(p) { if(!p.game) return 'No game'; if(p.game.ended) return 'FINAL'; if(p.game.started) return `LIVE vs ${p.game.opponent}`; const date=new Date(p.game.kickoff); return `${p.game.home?'vs':'@'} ${p.game.opponent} · ${date.toLocaleDateString([], {weekday:'short'})} ${date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`; }
function waiverClaimRow(claim){ const team=teamById(claim.team_id); const add=state.playerMap.get(claim.add_player_id); const drop=state.playerMap.get(claim.drop_player_id); const details=[add?`Claim ${shortName(add.name)}`:'Claim pending',drop?`drop ${shortName(drop.name)}`:'',claim.process_at?`runs ${formatTimestamp(claim.process_at)}`:''].filter(Boolean).join(' · '); return `<div class="transaction-row">${logoMarkup(team,'tiny')}<div><strong>${escapeHtml(team?.name||'Team')}</strong><span>${escapeHtml(details)} · Pending</span></div></div>`; }
function transactionRow(tx){ const team=teamById(tx.team_id); const add=state.playerMap.get(tx.add_player_id); const drop=state.playerMap.get(tx.drop_player_id); const details=[add?`Added ${shortName(add.name)}`:'',drop?`Dropped ${shortName(drop.name)}`:'',formatTimestamp(tx.created_at)].filter(Boolean).join(' · '); return `<div class="transaction-row">${logoMarkup(team,'tiny')}<div><strong>${escapeHtml(team?.name||'Team')}</strong><span>${escapeHtml(details || titleCase(tx.type || 'Move'))}</span></div></div>`; }
function playerAvatar(p,size=''){ const defense = p.position === 'DEF'; return `<span class="player-avatar ${size}${defense ? ' defense-avatar' : ''}"><img src="${escapeAttr(p.photo)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('image-failed');this.style.display='none'"/><span>${escapeHtml(initials(p.name))}</span></span>`; }
function playerRankValue(p) { const rank = Number(p?.rank || p?.searchRank || 0); return rank > 0 ? rank : 999999; }
function playerRankLabel(p) { const rank = playerRankValue(p); return rank === 999999 ? '—' : String(rank); }
function statLabel(player, keys) { const stats = player?.rawStats || {}; const value = keys.map((key) => stats?.[key]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== ''); return value === undefined ? '—' : String(value); }
function fmt(v){ return Number(v||0).toFixed(1); }
function playerMeta(p, includePosition = false){ const injury=injuryLabel(p); const prefix=includePosition?`${p.position} · ${p.nflTeam} · `:`${p.nflTeam} · `; return `<span class="player-meta">${escapeHtml(prefix + gameLabel(p))}${injury ? ` <strong class="injury-status ${injury.toLowerCase().replace(/[^a-z]+/g,'-')}">${escapeHtml(injury)}</strong>` : ''}</span>`; }
function injuryLabel(p){ const value=String(p?.injuryStatus || '').trim(); return value && !['active','healthy','none','clear'].includes(value.toLowerCase()) ? titleCase(value) : ''; }
function formatTimestamp(value){ const date=new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''; }
function lastRefreshLabel(){ const value=state.lastRefresh || state.league?.refreshedAt; const formatted=formatTimestamp(value); return formatted ? `Last refreshed ${formatted}` : 'Not refreshed yet'; }
function shortName(name){ const parts=String(name||'').split(' '); return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:name; }
function initials(name){ return String(name||'?').split(/\s+/).map((p)=>p[0]).join('').slice(0,2).toUpperCase(); }
function titleCase(s){ return s[0]+s.slice(1).toLowerCase(); }
function escapeHtml(s=''){ return String(s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(s=''){ return escapeHtml(s).replace(/'/g,'&#39;'); }
function shellLoading(){ return '<main class="loading-screen"><div class="spinner"></div><span>Loading league…</span></main>'; }
function emptyWatchLeague(){ return { source:'espn-unavailable', season:APP_CONFIG.season, week:state.week, teams:[], roster:{}, lineups:{}, claims:[], transactions:[], matchups:{}, teamScores:{}, rosterSlots:[] }; }

function mergeEspnPlayers(espnPlayers, providerPlayers, weeklyStatsAvailable = false) {
  const fallbackByName = new Map((providerPlayers || []).map((player) => [playerKey(player), player]));
  const fallbackByUniqueName = new Map();
  (providerPlayers || []).forEach((player) => {
    const key = playerNamePositionKey(player);
    const matches = fallbackByUniqueName.get(key) || [];
    matches.push(player);
    fallbackByUniqueName.set(key, matches);
  });
  const matchedProviderIds = new Set();
  const exact = (espnPlayers || []).map((player) => {
    let fallback = fallbackByName.get(playerKey(player));
    if (!fallback && player?.position !== 'DEF' && !/^TEAM_/i.test(String(player?.id || ''))) {
      const candidates = fallbackByUniqueName.get(playerNamePositionKey(player)) || [];
      if (candidates.length === 1) fallback = candidates[0];
    }
    if (fallback) matchedProviderIds.add(String(fallback.id));
    const merged = fallback ? {
      ...fallback,
      ...player,
      projection: player.projection || fallback.projection || 0,
      points: weeklyStatsAvailable ? Number(fallback.points || 0) : 0,
      rawStats: Object.keys(fallback.rawStats || {}).length ? fallback.rawStats : (player.rawStats || {}),
      game: player.game || fallback.game
    } : { ...player, points: 0 };
    return merged;
  });
  const extras = (providerPlayers || []).filter((player) => !matchedProviderIds.has(String(player.id)));
  return [...exact, ...extras];
}

function playerKey(player) {
  const rawNflTeam = String(player?.nflTeam || '').toUpperCase();
  const nflTeam = ({ JAC: 'JAX', LAR: 'LA', WSH: 'WAS' })[rawNflTeam] || rawNflTeam;
  if (player?.position === 'DEF' || /^TEAM_/i.test(String(player?.id || ''))) return `DEF|${nflTeam}`;
  return `${normalizePlayerName(player?.name)}|${nflTeam}`;
}

function playerNamePositionKey(player) {
  return `${normalizePlayerName(player?.name)}|${String(player?.position || '').toUpperCase()}`;
}

function normalizePlayerName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(?:jr|sr|ii|iii|iv)\.?\b/ig, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function readAutoRefreshPreference(){ try { return window.localStorage.getItem('fantasheee.autoRefresh') !== 'off'; } catch { return true; } }
function iconVs(){return '<svg viewBox="0 0 24 24"><path d="M4 7h6l4 10h6M4 17h6L14 7h6"/></svg>'}
function iconTeam(){return '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 19c.7-4 3-6 6-6s5.3 2 6 6M16 6.5c2.2.1 4 1.9 4 4.2 0 1.6-.8 3-2 3.8"/></svg>'}
function iconSearch(){return '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>'}
function iconLeague(){return '<svg viewBox="0 0 24 24"><path d="M5 20V9m7 11V4m7 16v-7"/></svg>'}
function iconFeed(){return '<svg viewBox="0 0 24 24"><path d="M13.2 2.8 5.6 13h5l-.8 8.2 8.6-11.3h-5.1l.9-7.1Z"/></svg>'}
function iconRefresh(){return '<svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10.2-4.2L4 12m2 0a6 6 0 0 0 10.2 4.2L20 12"/></svg>'}
