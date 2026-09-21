import { APP_CONFIG } from './config.js?v=11';
import { scoreStats } from './scoring.js?v=8';

const teamAlias = { JAC:'JAX', LAR:'LA', WSH:'WAS' };
const nflTeams = new Set(['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LA','LAC','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']);
const normalizeTeam = (team) => {
  const value = String(team || '').toUpperCase();
  const normalized = teamAlias[value] || value;
  return nflTeams.has(normalized) ? normalized : '';
};

async function getJson(url, { timeoutMs = 12000 } = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {})
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function projectionUrl(week) {
  const p = new URL(`${APP_CONFIG.data.sleeperStatsBase}/projections/nfl/${APP_CONFIG.season}/${week}`);
  p.searchParams.set('season_type','regular');
  APP_CONFIG.data.playerPositions.forEach((pos) => p.searchParams.append('position[]', pos));
  p.searchParams.set('order_by','pts_ppr');
  return p.toString();
}

function statsUrl(week) {
  const p = new URL(`${APP_CONFIG.data.sleeperStatsBase}/stats/nfl/${APP_CONFIG.season}/${week}`);
  p.searchParams.set('season_type','regular');
  APP_CONFIG.data.playerPositions.forEach((pos) => p.searchParams.append('position[]', pos));
  return p.toString();
}

export async function getNflState() {
  try {
    return await getJson(`${APP_CONFIG.data.sleeperAppBase}/v1/state/nfl`);
  } catch (_) {
    return { season: APP_CONFIG.season, week: APP_CONFIG.currentWeekFallback, display_week: APP_CONFIG.currentWeekFallback };
  }
}

export async function getWeekData(week) {
  const [projections, stats, schedule, playerPool] = await Promise.allSettled([
    getJson(projectionUrl(week)),
    getJson(statsUrl(week)),
    getJson(`${APP_CONFIG.data.sleeperAppBase}/schedule/nfl/regular/${APP_CONFIG.season}`),
    getJson(`${APP_CONFIG.data.sleeperAppBase}/players/nfl?active=true`)
  ]);

  const projectionRows = projections.status === 'fulfilled' ? projections.value : [];
  const statRows = stats.status === 'fulfilled' ? stats.value : [];
  const scheduleRows = schedule.status === 'fulfilled' ? schedule.value : [];
  const playerRows = playerPool.status === 'fulfilled' ? playerPool.value : [];

  const projectionMap = normalizeRows(projectionRows);
  const statsMap = normalizeRows(statRows);
  const playerMap = normalizeRows(playerRows);
  const games = normalizeSchedule(scheduleRows, week);
  const sourceOk = projectionRows.length > 0 || statRows.length > 0 || Object.keys(playerRows || {}).length > 0;
  const fallbackMap = new Map();

  const ids = new Set([...projectionMap.keys(), ...statsMap.keys(), ...playerMap.keys(), ...fallbackMap.keys()]);
  const players = [...ids].map((id) => {
    const p = projectionMap.get(id) || {};
    const st = statsMap.get(id) || {};
    const metadata = playerMap.get(id) || {};
    const fallback = fallbackMap.get(id) || {};
    const metadataPlayer = metadata.player && typeof metadata.player === 'object' ? metadata.player : metadata;
    const weeklyPlayer = [p.player, st.player].find((value) => value && typeof value === 'object') || {};
    const player = { ...fallback, ...weeklyPlayer, ...metadataPlayer };
    const position = player.position || player.fantasy_positions?.[0] || weeklyPlayer.position || p.position || st.position || '';
    const nflTeam = normalizeTeam(player.team) || normalizeTeam(weeklyPlayer.team) || normalizeTeam(p.team) || normalizeTeam(st.team) || normalizeTeam(id.startsWith('TEAM_') ? id.replace('TEAM_','') : '');
    const game = games.get(nflTeam) || null;
    const name = player.full_name || player.name || [player.first_name, player.last_name].filter(Boolean).join(' ') || id.replace('TEAM_','') + (position === 'DEF' ? ' D/ST' : '');
    return {
      id,
      name,
      rank: Number(player.search_rank || player.rank || weeklyPlayer.search_rank || p.search_rank || 0),
      firstName: player.first_name || '',
      lastName: player.last_name || '',
      position: position || (id.startsWith('TEAM_') ? 'DEF' : ''),
      nflTeam,
      status: player.status || '',
      injuryStatus: player.injury_status || player.injuryStatus || '',
      photo: id.startsWith('TEAM_') || position === 'DEF'
        ? `https://sleepercdn.com/images/team_logos/nfl/${nflTeam.toLowerCase()}.png`
        : `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(id)}.jpg`,
      projection: projectionMap.has(id) ? scoreStats(p.stats || p, position) : Number(fallback.projection || 0),
      points: statsMap.has(id) ? scoreStats(st.stats || st, position) : Number(fallback.points || 0),
      rawProjection: p.stats || p,
      rawStats: st.stats || st,
      game
    };
  }).filter((player) => APP_CONFIG.data.playerPositions.includes(player.position));

  players.sort((a,b) => (b.projection || 0) - (a.projection || 0));
  return { players, games, sourceOk, weeklyStatsAvailable: stats.status === 'fulfilled' && statsMap.size > 0 };
}

function normalizeRows(rows) {
  const map = new Map();
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const id = String(row.player_id || row.player?.player_id || row.player?.id || row.id || '');
      if (id) map.set(id, row);
    });
  } else if (rows && typeof rows === 'object') {
    Object.entries(rows).forEach(([id,row]) => map.set(String(id), row));
  }
  return map;
}

function normalizeSchedule(rows, week) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).filter((g) => Number(g.week) === Number(week)).forEach((g) => {
    const home = normalizeTeam(g.home || g.home_team || g.homeTeam);
    const away = normalizeTeam(g.away || g.away_team || g.awayTeam);
    const kickoff = new Date(g.date || g.kickoff || g.start_time || g.start || 0);
    const now = Date.now();
    const started = Number.isFinite(kickoff.getTime()) && kickoff.getTime() <= now;
    const ended = ['complete','closed','post','final'].includes(String(g.status || g.state || '').toLowerCase());
    if (home) map.set(home, { opponent: away, kickoff: kickoff.toISOString(), started, ended, home: true });
    if (away) map.set(away, { opponent: home, kickoff: kickoff.toISOString(), started, ended, home: false });
  });
  return map;
}
