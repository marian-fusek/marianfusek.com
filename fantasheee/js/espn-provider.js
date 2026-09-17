import { APP_CONFIG } from './config.js?v=10';

const ESPN_SYNC = APP_CONFIG.espnSync || {};
const SESSION_KEY = ESPN_SYNC.sessionKey || 'sheeesh-session-v1';

export function espnSyncConfigured() {
  return Boolean(ESPN_SYNC.enabled && ESPN_SYNC.functionUrl && ESPN_SYNC.publishableKey);
}

export function espnPasswordlessReadAvailable() {
  if (!espnSyncConfigured() || ESPN_SYNC.passwordlessRead !== true) return false;
  if (typeof window === 'undefined') return false;
  const origins = Array.isArray(ESPN_SYNC.allowedOrigins) ? ESPN_SYNC.allowedOrigins : [];
  return origins.includes(window.location.origin);
}

export function hasEspnSession() {
  if (!espnSyncConfigured()) return false;
  try {
    return Boolean(sessionStorage.getItem(SESSION_KEY));
  } catch (_) {
    return false;
  }
}

export function clearEspnSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
}

function sessionToken() {
  try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
}

async function fetchEspn(url, options = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), options.timeoutMs || 15000) : null;
  const token = sessionToken();
  const passwordlessRead = !token && espnPasswordlessReadAvailable();
  if (!token && !passwordlessRead) throw new Error('ESPN session is not active. Open Sheeesh in this browser first.');
  try {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          apikey: ESPN_SYNC.publishableKey,
          ...(token ? { 'x-sheeesh-session': token } : { 'x-fantasheee-client': '1' }),
          ...(options.headers || {})
        },
        ...(controller ? { signal: controller.signal } : {})
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Live ESPN mirror timed out. Retry the live connection.');
      throw new Error('Live ESPN mirror could not be reached. Deploy the updated Sheeesh function, then retry.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || `ESPN sync failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return body;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getEspnLeague(week) {
  if (!espnSyncConfigured()) throw new Error('ESPN sync is not configured.');
  const url = new URL(ESPN_SYNC.functionUrl);
  if (week) url.searchParams.set('week', String(week));
  return normalizeEspnLeague(await fetchEspn(url.toString()));
}

function normalizeEspnLeague(payload) {
  const sourceTeams = Array.isArray(payload?.teams) ? payload.teams : [];
  const teams = sourceTeams.map((team, index) => {
    const id = `team-${String(team.id || index + 1)}`;
    const players = [...(team.starters || []), ...(team.bench || [])].map((player) => normalizePlayer(player));
    const record = team.record || {};
    return {
      id,
      externalId: String(team.id || index + 1),
      name: String(team.name || `Team ${index + 1}`),
      abbr: String(team.abbreviation || '').toUpperCase(),
      logo: team.logo || '',
      logoFallback: team.logoFallback || '',
      wins: Number(team.wins ?? record.wins ?? record.overall?.wins ?? 0),
      losses: Number(team.losses ?? record.losses ?? record.overall?.losses ?? 0),
      ties: Number(team.ties ?? record.ties ?? record.overall?.ties ?? 0),
      waiver_priority: Number(team.waiverPriority ?? team.waiver_priority ?? team.waiverRank ?? 0),
      _players: players
    };
  });

  const roster = {};
  const lineups = {};
  const players = [];
  teams.forEach((team) => {
    roster[team.id] = [];
    lineups[team.id] = {};
    team._players.forEach((player) => {
      if (!player.id || roster[team.id].includes(player.id)) return;
      roster[team.id].push(player.id);
      lineups[team.id][player.id] = player.lineupSlot || (player.bench ? 'BE' : 'UTIL');
      players.push(player);
    });
    delete team._players;
  });

  const teamIds = teams.map((team) => team.id);
  const matchups = normalizeMatchups(payload?.matchups, teamIds);
  const teamScores = normalizeTeamScores(payload?.teamScores, teamIds);

  return {
    source: 'espn',
    season: Number(payload?.season || APP_CONFIG.season),
    week: Number(payload?.week || APP_CONFIG.currentWeekFallback),
    refreshedAt: payload?.refreshedAt || new Date().toISOString(),
    teams,
    roster,
    lineups,
    claims: [],
    transactions: normalizeTransactions(payload?.transactions, teamIds),
    matchups,
    teamScores,
    rosterSlots: normalizeRosterSlots(payload?.rosterSlots),
    players
  };
}

function normalizePlayer(player) {
  const position = String(player?.position || '').toUpperCase();
  const slot = String(player?.lineupSlot || (player?.bench ? 'BE' : position)).toUpperCase();
  return {
    id: String(player?.id || ''),
    name: String(player?.name || 'Player'),
    position: position || 'UTIL',
    nflTeam: String(player?.teamCode || '').toUpperCase(),
    status: '',
    injuryStatus: String(player?.health || ''),
    photo: player?.avatar || '',
    projection: Number(player?.projection ?? player?.projectedPoints ?? 0),
    points: Number(player?.points ?? player?.appliedStatTotal ?? 0),
    rawProjection: player?.rawProjection || {},
    rawStats: player?.rawStats || {},
    game: normalizeGame(player?.game),
    lineupSlot: slot,
    bench: Boolean(player?.bench || slot === 'BE' || slot === 'IR')
  };
}

function normalizeGame(game) {
  if (!game) return null;
  return {
    opponent: String(game.opponent || ''),
    kickoff: game.date || game.kickoff || '',
    started: game.state === 'in' || game.state === 'post' || Boolean(game.started),
    ended: game.state === 'post' || Boolean(game.ended),
    home: game.home,
    label: game.label || 'Not played'
  };
}

function normalizeMatchups(value, teamIds) {
  if (!value || typeof value !== 'object') return {};
  const result = {};
  Object.entries(value).forEach(([left, right]) => {
    const leftId = teamIds.includes(left) ? left : `team-${left}`;
    const rightId = teamIds.includes(String(right)) ? String(right) : `team-${right}`;
    if (teamIds.includes(leftId) && teamIds.includes(rightId)) result[leftId] = rightId;
  });
  return result;
}

function normalizeTeamScores(value, teamIds) {
  if (!value || typeof value !== 'object') return {};
  const result = {};
  Object.entries(value).forEach(([key, score]) => {
    const teamId = teamIds.includes(key) ? key : `team-${key}`;
    if (!teamIds.includes(teamId) || !score || typeof score !== 'object') return;
    result[teamId] = {
      points: Number(score.points ?? score.actual ?? 0),
      projected: Number(score.projected ?? score.projection ?? 0)
    };
  });
  return result;
}

function normalizeTransactions(value, teamIds) {
  if (!Array.isArray(value)) return [];
  return value.map((transaction) => {
    const rawTeamId = String(transaction.teamId || transaction.team_id || '');
    const teamId = teamIds.includes(rawTeamId) ? rawTeamId : `team-${rawTeamId}`;
    return {
      id: String(transaction.id || crypto.randomUUID()),
      type: String(transaction.type || 'transaction'),
      status: String(transaction.status || 'processed'),
      created_at: transaction.createdAt || transaction.created_at || new Date().toISOString(),
      team_id: teamIds.includes(teamId) ? teamId : '',
      add_player_id: String(transaction.addPlayerId || transaction.add_player_id || ''),
      drop_player_id: String(transaction.dropPlayerId || transaction.drop_player_id || '')
    };
  }).filter((transaction) => transaction.team_id);
}

function normalizeRosterSlots(value) {
  if (!Array.isArray(value)) return [];
  return value.map((slot) => String(slot || '').toUpperCase()).filter((slot) => ['QB','RB','WR','TE','FLEX','K','DEF','BE','IR'].includes(slot));
}
