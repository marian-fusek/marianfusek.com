const ESPN_LEAGUE_API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';
const ESPN_SCOREBOARD_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const POSITION_BY_ID: Record<number, string> = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DEF'
};

const LINEUP_SLOT_BY_ID: Record<number, string> = {
  0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'DEF', 17: 'K',
  20: 'BE', 21: 'IR', 23: 'FLEX'
};

const NFL_TEAM_BY_ESPN_ID: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL',
  7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC',
  13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE', 18: 'NO',
  19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'LAC', 24: 'PIT',
  25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX',
  33: 'BAL', 34: 'HOU'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function clampWeek(value: string | null) {
  const week = Number(value);
  return Number.isFinite(week) && week >= 1 && week <= 18 ? Math.floor(week) : 0;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createSession(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${expiresAt}.${crypto.randomUUID()}`;
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${base64Url(encoder.encode(payload))}.${base64Url(signature)}`;
}

async function validSession(token: string, secret: string) {
  try {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) return false;
    const payload = new TextDecoder().decode(fromBase64Url(payloadPart));
    const expiresAt = Number(payload.split('.')[0]);
    if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
    const key = await hmacKey(secret);
    return await crypto.subtle.verify('HMAC', key, fromBase64Url(signaturePart), encoder.encode(payload));
  } catch (_) {
    return false;
  }
}

function samePassword(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  return difference === 0;
}

function teamCodeForProTeam(id: unknown) {
  return NFL_TEAM_BY_ESPN_ID[Number(id)] || '';
}

function normalizeTeamCode(code: unknown) {
  const value = asText(code).toUpperCase();
  return value === 'WSH' ? 'WAS' : value === 'LA' ? 'LAR' : value;
}

function playerPosition(player: Record<string, any>) {
  return POSITION_BY_ID[Number(player.defaultPositionId)] || asText(player.position) || '—';
}

function lineupSlot(lineupSlotId: unknown) {
  return LINEUP_SLOT_BY_ID[Number(lineupSlotId)] || 'UTIL';
}

function healthLabel(player: Record<string, any>) {
  const raw = [player.injuryStatus, player.injuryStatusText, player.status]
    .map(asText)
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
  if (!raw || /^(ACTIVE|NORMAL)$/.test(raw)) return '';
  if (/INJURED RESERVE|\bIR\b/.test(raw)) return 'IR';
  if (/OUT/.test(raw)) return 'OUT';
  if (/DOUBTFUL/.test(raw)) return 'DOUBTFUL';
  if (/QUESTIONABLE|QUES|DAY[- ]TO[- ]DAY/.test(raw)) return 'QUESTIONABLE';
  if (/SUSPEND/.test(raw)) return 'SUSPENDED';
  return asText(player.injuryStatus || player.injuryStatusText || player.status).toUpperCase();
}

function teamLogo(team: Record<string, any>) {
  let logo = team.logo;
  if (Array.isArray(logo)) logo = logo[0];
  if (logo && typeof logo === 'object') logo = logo.href || logo.url || '';
  if (typeof logo === 'string' && logo) return logo;
  const abbrev = asText(team.abbrev).toLowerCase();
  return abbrev ? `https://a.espncdn.com/i/teamlogos/nfl/500/${encodeURIComponent(abbrev)}.png` : '';
}

function teamName(team: Record<string, any>) {
  const fullName = [asText(team.location), asText(team.nickname)].filter(Boolean).join(' ');
  return fullName || asText(team.name) || `Team ${team.id || ''}`.trim();
}

function normalizeGames(data: Record<string, any>) {
  const games: Record<string, any> = {};
  for (const event of data.events || []) {
    const competition = event.competitions?.[0];
    const competitors = (competition?.competitors || [])
      .map((competitor: Record<string, any>) => normalizeTeamCode(competitor.team?.abbreviation))
      .filter(Boolean);
    if (competitors.length < 2) continue;
    const type = event.status?.type || competition?.status?.type || {};
    const state = type.state || 'pre';
    const label = state === 'post' ? 'Played' : state === 'in' ? 'In progress' : 'Not played';
    competitors.forEach((code: string, index: number) => {
      games[code] = {
        date: event.date || competition?.date || '',
        state,
        label,
        opponent: competitors[index === 0 ? 1 : 0]
      };
    });
  }
  return games;
}

function normalizePlayer(entry: Record<string, any>, games: Record<string, any>) {
  const player = entry.player || {};
  const position = playerPosition(player);
  const teamCode = teamCodeForProTeam(player.proTeamId);
  const slotId = Number(entry.lineupSlotId);
  const name = asText(player.fullName)
    || [asText(player.firstName), asText(player.lastName)].filter(Boolean).join(' ')
    || `Player ${entry.playerId || ''}`.trim();
  const game = games[teamCode] || null;
  const avatar = position === 'DEF' && teamCode
    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${encodeURIComponent(teamCode.toLowerCase())}.png`
    : `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(String(entry.playerId || ''))}.png`;
  return {
    id: String(entry.playerId || ''),
    name,
    position,
    lineupSlot: lineupSlot(slotId),
    teamCode,
    avatar,
    health: healthLabel(player),
    game,
    bench: slotId === 20 || slotId === 21
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const password = Deno.env.get('SHEEESH_PASSWORD');
  if (!password) return json({ error: 'Sheeesh password is not configured.' }, 500);

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!samePassword(String(body.password || ''), password)) return json({ error: 'Wrong password.' }, 401);
    return json({ token: await createSession(password), expiresIn: TOKEN_TTL_SECONDS });
  }
  if (request.method !== 'GET') return json({ error: 'Only GET and POST are supported.' }, 405);

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validSession(token, password))) return json({ error: 'Sheeesh session expired.' }, 401);

  const swid = Deno.env.get('ESPN_SWID');
  const espnS2 = Deno.env.get('ESPN_S2');
  const leagueId = Deno.env.get('ESPN_LEAGUE_ID') || '465957009';
  const season = Deno.env.get('ESPN_SEASON') || '2026';
  if (!swid || !espnS2) return json({ error: 'ESPN connection is not configured.' }, 500);

  const url = new URL(request.url);
  const requestedWeek = clampWeek(url.searchParams.get('week'));
  const leagueUrl = new URL(`${ESPN_LEAGUE_API}/${encodeURIComponent(season)}/segments/0/leagues/${encodeURIComponent(leagueId)}`);
  leagueUrl.searchParams.append('view', 'mTeam');
  leagueUrl.searchParams.append('view', 'mRoster');
  leagueUrl.searchParams.append('view', 'mStatus');
  if (requestedWeek) leagueUrl.searchParams.set('scoringPeriodId', String(requestedWeek));

  const leagueResult = await fetchJson(leagueUrl.toString(), {
    headers: { Accept: 'application/json', Cookie: `SWID=${swid}; espn_s2=${espnS2}` }
  });
  if (!leagueResult.response.ok) {
    if (leagueResult.response.status === 401 || leagueResult.response.status === 403) {
      return json({ error: 'ESPN authorization expired. Update ESPN_SWID and ESPN_S2 in Supabase Secrets.' }, 502);
    }
    return json({ error: `ESPN returned ${leagueResult.response.status}.` }, 502);
  }

  const league = leagueResult.body || {};
  const week = requestedWeek || Number(league.status?.currentMatchupPeriod || league.status?.currentScoringPeriod || 1);
  let games: Record<string, any> = {};
  try {
    const scoreboardUrl = new URL(ESPN_SCOREBOARD_API);
    scoreboardUrl.searchParams.set('dates', season);
    scoreboardUrl.searchParams.set('seasontype', '2');
    scoreboardUrl.searchParams.set('week', String(week));
    const scoreboardResult = await fetchJson(scoreboardUrl.toString());
    if (scoreboardResult.response.ok) games = normalizeGames(scoreboardResult.body || {});
  } catch (_) {
    games = {};
  }

  const teams = (league.teams || []).map((team: Record<string, any>) => {
    const players = (team.roster?.entries || []).map((entry: Record<string, any>) => normalizePlayer(entry, games));
    return {
      id: String(team.id || ''),
      name: teamName(team),
      abbreviation: asText(team.abbrev).toUpperCase(),
      logo: teamLogo(team),
      starters: players.filter((player: Record<string, any>) => !player.bench),
      bench: players.filter((player: Record<string, any>) => player.bench)
    };
  });

  return json({ season, week, refreshedAt: new Date().toISOString(), teams });
});
