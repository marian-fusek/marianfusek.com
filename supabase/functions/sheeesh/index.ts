const ESPN_LEAGUE_API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';
const ESPN_SCOREBOARD_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const ESPN_GAME_SUMMARY_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary';
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const SUMMARY_CACHE_MS = 20000;
const encoder = new TextEncoder();
const gameSummaryCache = new Map<string, { cachedAt: number; body: Record<string, any> }>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sheeesh-session, x-fantasheee-client',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Fantasheee is intentionally passwordless. Its read-only browser mirror is
// limited to the local preview and the two production site origins; ESPN
// cookies remain server-side in this function.
const FANTASHEEE_ORIGINS = new Set([
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://marianfusek.com',
  'https://www.marianfusek.com'
]);

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

const NFL_TEAM_NICKNAME_BY_CODE: Record<string, string> = {
  ATL: 'Falcons', BUF: 'Bills', CHI: 'Bears', CIN: 'Bengals', CLE: 'Browns',
  DAL: 'Cowboys', DEN: 'Broncos', DET: 'Lions', GB: 'Packers', TEN: 'Titans',
  IND: 'Colts', KC: 'Chiefs', LV: 'Raiders', LAR: 'Rams', MIA: 'Dolphins',
  MIN: 'Vikings', NE: 'Patriots', NO: 'Saints', NYG: 'Giants', NYJ: 'Jets',
  PHI: 'Eagles', ARI: 'Cardinals', LAC: 'Chargers', PIT: 'Steelers', SF: '49ers',
  SEA: 'Seahawks', TB: 'Buccaneers', WAS: 'Commanders', CAR: 'Panthers',
  JAX: 'Jaguars', BAL: 'Ravens', HOU: 'Texans'
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

function teamCodeForPlayer(player: Record<string, any>, position: string) {
  const explicitCode = normalizeTeamCode(
    player.proTeamAbbreviation
      || player.proTeamAbbrev
      || player.editorialTeamAbbreviation
      || player.teamAbbreviation
      || player.proTeam?.abbreviation
  );

  if (position === 'DEF') {
    const name = [player.fullName, player.displayName, player.name]
      .map(asText)
      .join(' ')
      .toLowerCase();
    const namedTeam = Object.entries(NFL_TEAM_NICKNAME_BY_CODE)
      .find(([, nickname]) => name.includes(nickname.toLowerCase()));

    if (namedTeam) return namedTeam[0];
  }

  return explicitCode || teamCodeForProTeam(player.proTeamId);
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

function teamLogoCandidates(team: Record<string, any>) {
  const candidates: string[] = [];
  const visited = new WeakSet<object>();

  const isSafeImageCandidate = (value: string) => {
    if (/^data:image\//i.test(value)) return true;
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname === 'espn.com'
        || hostname.endsWith('.espn.com')
        || hostname === 'espncdn.com'
        || hostname.endsWith('.espncdn.com');
    } catch (_) {
      return false;
    }
  };

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (isSafeImageCandidate(trimmed) && !candidates.includes(trimmed)) candidates.push(trimmed);
      return;
    }
    if (value && typeof value === 'object') {
      if (visited.has(value)) return;
      visited.add(value);
      const item = value as Record<string, any>;
      Object.values(item).forEach(visit);
    }
  };
  [
    team.customLogo, team.customLogoUrl, team.customLogoURL,
    team.logo, team.logos, team.logoUrl, team.logoURL,
    team.teamLogo, team.teamLogoUrl, team.teamLogoURL,
    team.image, team.imageUrl, team.imageURL
  ].forEach(visit);
  return candidates.sort((left, right) => {
    const leftLooksCustom = /mystique-api|\/domains\/lm\/images\/|data:image\//i.test(left) ? 1 : 0;
    const rightLooksCustom = /mystique-api|\/domains\/lm\/images\/|data:image\//i.test(right) ? 1 : 0;
    return rightLooksCustom - leftLooksCustom;
  });
}

function defaultTeamLogo(team: Record<string, any>) {
  const abbreviation = normalizeTeamCode(team.abbrev).toUpperCase();
  if (!Object.values(NFL_TEAM_BY_ESPN_ID).includes(abbreviation)) return '';
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${encodeURIComponent(abbreviation.toLowerCase())}.png`;
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function privateImageDataUrl(url: string, cookie: string) {
  if (!url) return '';
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Cookie: cookie,
        Origin: 'https://fantasy.espn.com',
        Referer: 'https://fantasy.espn.com/football/',
        'X-Fantasy-Platform': 'espn-fantasy-web',
        'X-Fantasy-Source': 'kona',
        'User-Agent': 'Mozilla/5.0 (compatible; Sheeesh/1.0)'
      }
    });
    if (!response.ok) return '';
    const contentType = (response.headers.get('content-type') || 'image/png').split(';')[0];
    if (!contentType.startsWith('image/')) return '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > 500000) return '';
    return `data:${contentType};base64,${base64FromBytes(bytes)}`;
  } catch (_) {
    return '';
  }
}

async function teamLogoDataUrl(team: Record<string, any>, cookie: string) {
  const candidates = teamLogoCandidates(team);
  for (const candidate of candidates) {
    const image = await privateImageDataUrl(candidate, cookie);
    if (image) return image;
  }
  // A custom ESPN image can require the viewer's browser session even when
  // the server cannot proxy it. Let the browser try that URL first before
  // using the normal NFL logo fallback.
  return candidates.find(candidate => /^https?:\/\//i.test(candidate)) || defaultTeamLogo(team);
}

function teamName(team: Record<string, any>) {
  const fullName = [asText(team.location), asText(team.nickname)].filter(Boolean).join(' ');
  return fullName || asText(team.name) || `Team ${team.id || ''}`.trim();
}

function teamOwnerName(team: Record<string, any>, members: Record<string, any>[]) {
  const known = asText(team.ownerName || team.owner_name || team.managerName);
  if (known) return known;
  const ownerValues = [
    ...(Array.isArray(team.owners) ? team.owners : [team.owners]),
    team.ownerId, team.owner_id, team.primaryOwnerId, team.managerId
  ].filter(Boolean);
  const ownerIds = new Set(ownerValues.flatMap((value: any) => {
    if (value && typeof value === 'object') return [value.id, value.memberId, value.guid, value.userId].filter(Boolean).map(String);
    return [String(value)];
  }));
  const member = members.find((item) => ownerIds.has(String(item.id || '')) || ownerIds.has(String(item.guid || '')));
  if (!member) return '';
  return asText(member.displayName || member.fullName)
    || [asText(member.firstName), asText(member.lastName)].filter(Boolean).join(' ');
}

function playerRecord(entry: Record<string, any>) {
  if (entry.player && typeof entry.player === 'object') return entry.player;
  if (entry.playerPoolEntry?.player && typeof entry.playerPoolEntry.player === 'object') return entry.playerPoolEntry.player;
  return entry.playerPoolEntry && typeof entry.playerPoolEntry === 'object' ? entry.playerPoolEntry : {};
}

function finiteNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function playerFantasyPoints(entry: Record<string, any>, player: Record<string, any>) {
  return finiteNumber(
    entry.appliedStatTotal,
    entry.currentPeriodPoints,
    entry.playerPoolEntry?.appliedStatTotal,
    player.appliedStatTotal,
    player.currentPeriodPoints,
    player.totalPoints
  );
}

function playerProjection(entry: Record<string, any>, player: Record<string, any>) {
  return finiteNumber(
    entry.projectedPointTotal,
    entry.projectedPoints,
    entry.playerPoolEntry?.projectedPointTotal,
    entry.playerPoolEntry?.projectedPoints,
    player.projectedPointTotal,
    player.projectedPoints
  );
}

function normalizeGames(data: Record<string, any>) {
  const games: Record<string, any> = {};
  for (const event of data.events || []) {
    const competition = event.competitions?.[0];
    const competitors = (competition?.competitors || [])
      .map((competitor: Record<string, any>) => ({
        code: normalizeTeamCode(competitor.team?.abbreviation),
        home: competitor.homeAway === 'home'
      }))
      .filter((competitor: Record<string, any>) => Boolean(competitor.code));
    if (competitors.length < 2) continue;
    const type = event.status?.type || competition?.status?.type || {};
    const state = type.state || 'pre';
    const label = state === 'post' ? 'Played' : state === 'in' ? 'In progress' : 'Not played';
    competitors.forEach((competitor: Record<string, any>, index: number) => {
      games[competitor.code] = {
        date: event.date || competition?.date || '',
        state,
        label,
        opponent: competitors[index === 0 ? 1 : 0].code,
        home: competitor.home,
        eventId: String(event.id || competition.id || ''),
        game: asText(event.shortName || event.name)
      };
    });
  }
  return games;
}

function eventTeamCodes(event: Record<string, any>) {
  return (event.competitions?.[0]?.competitors || [])
    .map((competitor: Record<string, any>) => normalizeTeamCode(competitor.team?.abbreviation))
    .filter(Boolean);
}

async function fetchGameSummary(eventId: string) {
  const cached = gameSummaryCache.get(eventId);
  if (cached && Date.now() - cached.cachedAt < SUMMARY_CACHE_MS) return cached.body;
  const summaryUrl = new URL(ESPN_GAME_SUMMARY_API);
  summaryUrl.searchParams.set('event', eventId);
  const result = await fetchJson(summaryUrl.toString(), {
    headers: {
      Accept: 'application/json',
      Origin: 'https://www.espn.com',
      Referer: 'https://www.espn.com/nfl/',
      'User-Agent': 'Mozilla/5.0 (compatible; Sheeesh/1.0)'
    }
  });
  if (!result.response.ok || !result.body || typeof result.body !== 'object') {
    throw new Error(`ESPN game summary returned ${result.response.status}.`);
  }
  if (gameSummaryCache.size >= 64) {
    const oldest = gameSummaryCache.keys().next().value;
    if (oldest) gameSummaryCache.delete(oldest);
  }
  gameSummaryCache.set(eventId, { cachedAt: Date.now(), body: result.body });
  return result.body;
}

function normalizeFeedPlays(summary: Record<string, any>, event: Record<string, any>) {
  const eventId = String(event.id || event.competitions?.[0]?.id || '');
  const competitors = event.competitions?.[0]?.competitors || [];
  const homeTeamCode = normalizeTeamCode(competitors.find((team: Record<string, any>) => team.homeAway === 'home')?.team?.abbreviation);
  const awayTeamCode = normalizeTeamCode(competitors.find((team: Record<string, any>) => team.homeAway === 'away')?.team?.abbreviation);
  const asDrives = (value: unknown) => Array.isArray(value)
    ? value
    : value && typeof value === 'object' ? [value] : [];
  const drives = [
    ...asDrives(summary.drives?.previous),
    ...asDrives(summary.drives?.current)
  ];
  const seen = new Set<string>();
  const result: Record<string, any>[] = [];
  drives.forEach((drive: Record<string, any>) => {
    (drive.plays || []).forEach((play: Record<string, any>) => {
      const id = String(play.id || play.sequenceNumber || '');
      const text = asText(play.text);
      if (!id || !text || seen.has(id)) return;
      seen.add(id);
      const participants = play.teamParticipants || [];
      const offenseId = participants.find((item: Record<string, any>) => item.type === 'offense')?.id;
      const defenseId = participants.find((item: Record<string, any>) => item.type === 'defense')?.id;
      result.push({
        id: `${eventId}:${id}`,
        eventId,
        happenedAt: play.wallclock || event.date || new Date().toISOString(),
        type: asText(play.type?.text) || 'NFL play',
        text,
        statYardage: finiteNumber(play.statYardage),
        scoringPlay: Boolean(play.scoringPlay),
        isTurnover: Boolean(play.isTurnover),
        offenseTeamCode: teamCodeForProTeam(offenseId),
        defenseTeamCode: teamCodeForProTeam(defenseId),
        homeTeamCode,
        awayTeamCode,
        homeScore: finiteNumber(play.homeScore),
        awayScore: finiteNumber(play.awayScore),
        period: finiteNumber(play.period?.number),
        clock: asText(play.clock?.displayValue),
        game: asText(event.shortName || event.name)
      });
    });
  });
  return result;
}

async function liveFeedData(scoreboard: Record<string, any> | null, rosterCodes: Set<string>) {
  if (!scoreboard || !Array.isArray(scoreboard.events)) return { feedEvents: [], feedStatus: 'unavailable' };
  const now = Date.now();
  const recentWindow = 12 * 60 * 60 * 1000;
  const relevant = scoreboard.events.filter((event: Record<string, any>) => {
    const state = event.status?.type?.state || event.competitions?.[0]?.status?.type?.state;
    const kickoff = new Date(event.date || event.competitions?.[0]?.date || 0).getTime();
    const recentFinal = state === 'post' && Number.isFinite(kickoff) && now >= kickoff && now - kickoff <= recentWindow;
    if (state !== 'in' && !recentFinal) return false;
    return eventTeamCodes(event).some((code: string) => rosterCodes.has(code));
  });
  if (!relevant.length) return { feedEvents: [], feedStatus: 'ready' };

  const summaries = await Promise.allSettled(relevant.map(async (event: Record<string, any>) => {
    const summary = await fetchGameSummary(String(event.id || event.competitions?.[0]?.id || ''));
    return normalizeFeedPlays(summary, event);
  }));
  const successful = summaries.filter((result) => result.status === 'fulfilled').length;
  const feedEvents = summaries.flatMap((result: any) => result.status === 'fulfilled' ? result.value : []);
  feedEvents.sort((left: Record<string, any>, right: Record<string, any>) =>
    new Date(left.happenedAt).getTime() - new Date(right.happenedAt).getTime());
  return {
    feedEvents: feedEvents.slice(-600),
    feedStatus: successful ? 'ready' : 'unavailable'
  };
}

function normalizePlayer(entry: Record<string, any>, games: Record<string, any>) {
  const player = playerRecord(entry);
  const position = playerPosition(player);
  const teamCode = teamCodeForPlayer(player, position);
  const slotId = Number(entry.lineupSlotId);
  const playerId = player.id || player.playerId || entry.playerId || '';
  const name = asText(player.fullName)
    || asText(player.displayName)
    || [asText(player.firstName), asText(player.lastName)].filter(Boolean).join(' ')
    || `Player ${playerId}`.trim();
  const game = games[teamCode] || null;
  const avatar = position === 'DEF' && teamCode
    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${encodeURIComponent(teamCode.toLowerCase())}.png`
    : `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(String(playerId))}.png`;
  return {
    id: String(playerId),
    name,
    position,
    lineupSlot: lineupSlot(slotId),
    teamCode,
    avatar,
    health: healthLabel(player),
    game,
    bench: slotId === 20 || slotId === 21,
    points: playerFantasyPoints(entry, player),
    projection: playerProjection(entry, player)
  };
}

function teamRecord(team: Record<string, any>) {
  const record = team.record?.overall || team.record || {};
  return {
    wins: finiteNumber(record.wins, team.wins),
    losses: finiteNumber(record.losses, team.losses),
    ties: finiteNumber(record.ties, team.ties)
  };
}

function teamWaiverPriority(team: Record<string, any>) {
  return finiteNumber(
    team.waiverPriority,
    team.waiverRank,
    team.waiver_rank,
    team.settings?.waiverPriority,
    team.settings?.waiverRank
  );
}

function rosterSlotsFromSettings(league: Record<string, any>) {
  const settings = league.settings?.rosterSettings || league.settings?.roster || {};
  const counts = settings.lineupSlotCounts || settings.lineupSlots || {};
  const rows = Array.isArray(counts)
    ? counts
    : Object.entries(counts).map(([lineupSlotId, count]) => ({ lineupSlotId, count }));
  const slots: string[] = [];
  rows.forEach((row: Record<string, any>) => {
    const rawSlot = row.lineupSlotId ?? row.slotId ?? row.lineupSlot ?? row.position;
    const slot = LINEUP_SLOT_BY_ID[Number(rawSlot)] || asText(rawSlot).toUpperCase();
    const count = Math.floor(finiteNumber(row.count, row.slotCount, row.slots));
    if (!slot || !count || !['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BE', 'IR'].includes(slot)) return;
    for (let index = 0; index < count; index += 1) slots.push(slot);
  });
  return slots;
}

function teamIdFromMatchupSide(side: unknown) {
  if (!side || typeof side !== 'object') return '';
  const value = side as Record<string, any>;
  return String(value.teamId || value.team?.id || value.id || '');
}

function matchupData(league: Record<string, any>, week: number) {
  const matchups: Record<string, string> = {};
  const teamScores: Record<string, any> = {};
  const rows = Array.isArray(league.schedule)
    ? league.schedule
    : Array.isArray(league.matchups) ? league.matchups : [];

  rows.forEach((row: Record<string, any>) => {
    const period = finiteNumber(row.matchupPeriodId, row.scoringPeriodId, row.week, row.period);
    if (period && period !== week) return;
    const home = row.home || row.homeTeam || row.teamA;
    const away = row.away || row.awayTeam || row.teamB;
    const homeId = teamIdFromMatchupSide(home);
    const awayId = teamIdFromMatchupSide(away);
    if (!homeId || !awayId) return;
    matchups[homeId] = awayId;
    matchups[awayId] = homeId;
    teamScores[homeId] = {
      points: finiteNumber(home?.totalPoints, home?.points, home?.score),
      projected: finiteNumber(home?.totalProjectedPoints, home?.projectedPoints, home?.projectedScore)
    };
    teamScores[awayId] = {
      points: finiteNumber(away?.totalPoints, away?.points, away?.score),
      projected: finiteNumber(away?.totalProjectedPoints, away?.projectedPoints, away?.projectedScore)
    };
  });
  return { matchups, teamScores };
}

function transactionData(league: Record<string, any>) {
  const rows = Array.isArray(league.transactions)
    ? league.transactions
    : Array.isArray(league.recentActivity) ? league.recentActivity : [];
  return rows.slice(0, 100).map((row: Record<string, any>) => ({
    id: String(row.id || row.transactionId || crypto.randomUUID()),
    type: asText(row.type || row.transactionType || row.executionType || 'transaction'),
    status: asText(row.status || row.processedStatus || 'processed'),
    createdAt: row.processDate || row.createdAt || row.date || null,
    teamId: String(row.teamId || row.team?.id || row.memberId || ''),
    addPlayerId: String(row.addPlayerId || row.addedPlayerId || ''),
    dropPlayerId: String(row.dropPlayerId || row.droppedPlayerId || '')
  }));
}

// Keep every team's starting column in the same fantasy-football order. ESPN
// returns roster entries in an order that is not reliable for presentation.
function sortStarters(players: Record<string, any>[]) {
  const rank: Record<string, number> = {
    QB: 0,
    RB: 1,
    WR: 3,
    FLEX: 5,
    TE: 6,
    DEF: 7,
    K: 8
  };

  return players
    .map((player, index) => ({ player, index }))
    .sort((left, right) => {
      const leftRank = left.player.lineupSlot === 'FLEX'
        ? rank.FLEX
        : rank[left.player.position] ?? 99;
      const rightRank = right.player.lineupSlot === 'FLEX'
        ? rank.FLEX
        : rank[right.player.position] ?? 99;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ player }) => player);
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

function isFantasheeeReadRequest(request: Request) {
  return request.method === 'GET'
    && request.headers.get('x-fantasheee-client') === '1'
    && FANTASHEEE_ORIGINS.has(asText(request.headers.get('origin')));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const isPublicFantasheeeRead = isFantasheeeReadRequest(request);
  const password = Deno.env.get('SHEEESH_PASSWORD');
  if (!password && !isPublicFantasheeeRead) return json({ error: 'Sheeesh password is not configured.' }, 500);

  if (request.method === 'POST') {
    if (!password) return json({ error: 'Sheeesh password is not configured.' }, 500);
    const body = await request.json().catch(() => ({}));
    if (!samePassword(String(body.password || ''), password)) return json({ error: 'Wrong password.' }, 401);
    return json({ token: await createSession(password), expiresIn: TOKEN_TTL_SECONDS });
  }
  if (request.method !== 'GET') return json({ error: 'Only GET and POST are supported.' }, 405);

  if (!isPublicFantasheeeRead) {
    const token = request.headers.get('x-sheeesh-session')?.trim() || '';
    if (!password || !token || !(await validSession(token, password))) return json({ error: 'Sheeesh session expired.' }, 401);
  }

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
  leagueUrl.searchParams.append('view', 'mMatchup');
  leagueUrl.searchParams.append('view', 'mSettings');
  leagueUrl.searchParams.append('view', 'mTransactions');
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
  let scoreboardData: Record<string, any> | null = null;
  try {
    const scoreboardUrl = new URL(ESPN_SCOREBOARD_API);
    scoreboardUrl.searchParams.set('dates', season);
    scoreboardUrl.searchParams.set('seasontype', '2');
    scoreboardUrl.searchParams.set('week', String(week));
    scoreboardUrl.searchParams.set('limit', '100');
    const scoreboardResult = await fetchJson(scoreboardUrl.toString(), {
      headers: {
        Accept: 'application/json',
        Origin: 'https://fantasy.espn.com',
        Referer: 'https://fantasy.espn.com/football/',
        'User-Agent': 'Mozilla/5.0 (compatible; Sheeesh/1.0)'
      }
    });
    if (scoreboardResult.response.ok) {
      scoreboardData = scoreboardResult.body || {};
      games = normalizeGames(scoreboardData);
    }
  } catch (_) {
    games = {};
  }

  const espnCookie = `SWID=${swid}; espn_s2=${espnS2}`;
  const matchup = matchupData(league, week);
  const transactions = transactionData(league);
  const rosterSlots = rosterSlotsFromSettings(league);
  const members = Array.isArray(league.members) ? league.members : [];
  const teams = await Promise.all((league.teams || []).map(async (team: Record<string, any>) => {
    const players = (team.roster?.entries || []).map((entry: Record<string, any>) => normalizePlayer(entry, games));
    const starters = sortStarters(players.filter((player: Record<string, any>) => !player.bench));
    const record = teamRecord(team);
    const teamId = String(team.id || '');
    return {
      id: teamId,
      name: teamName(team),
      ownerName: teamOwnerName(team, members),
      abbreviation: asText(team.abbrev).toUpperCase(),
      logo: await teamLogoDataUrl(team, espnCookie),
      logoFallback: defaultTeamLogo(team),
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      waiverPriority: teamWaiverPriority(team),
      starters,
      bench: players.filter((player: Record<string, any>) => player.bench)
    };
  }));

  const includeFeed = url.searchParams.get('feed') === '1';
  const rosterCodes = new Set(teams.flatMap((team: Record<string, any>) =>
    [...team.starters, ...team.bench].map((player: Record<string, any>) => player.teamCode).filter(Boolean)));
  const currentWeek = Number(league.status?.currentScoringPeriod || league.status?.currentMatchupPeriod || week);
  const feed = includeFeed && week === currentWeek
    ? await liveFeedData(scoreboardData, rosterCodes)
    : { feedEvents: [], feedStatus: includeFeed ? 'ready' : 'not-requested' };

  return json({
    season,
    week,
    refreshedAt: new Date().toISOString(),
    teams,
    matchups: matchup.matchups,
    teamScores: matchup.teamScores,
    transactions,
    rosterSlots,
    feedEvents: feed.feedEvents,
    feedStatus: feed.feedStatus
  });
});
