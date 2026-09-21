import { APP_CONFIG } from './config.js?v=11';

const NFL_TEAM_NAMES = {
  ARI: ['the Cardinals', 'the Cards', 'the desert birds'], ATL: ['the Falcons', 'the Dirty Birds', 'the Atlanta crew'],
  BAL: ['the Ravens', 'the Baltimore boys', 'the Birds'], BUF: ['the Bills', 'the Buffalo crew', 'Bills Mafia'],
  CAR: ['the Panthers', 'the Carolina crew', 'the Cats'], CHI: ['the Bears', 'the Chicago crew', 'the Monsters of the Midway'],
  CIN: ['the Bengals', 'the Cincy crew', 'the stripes'], CLE: ['the Browns', 'the Cleveland crew', 'the Dawg Pound'],
  DAL: ['the Cowboys', 'the Dallas crew', 'the Dallas boys'], DEN: ['the Broncos', 'the Denver crew', 'the Mile High crew'],
  DET: ['the Lions', 'the Detroit crew', 'the Motor City crew'], GB: ['the Packers', 'the Pack', 'the Green Bay crew'],
  HOU: ['the Texans', 'the Houston crew', 'H-Town'], IND: ['the Colts', 'Indy', 'the Horseshoes'],
  JAX: ['the Jaguars', 'the Jags', 'Duval'], KC: ['the Chiefs', 'KC', 'the Kansas City crew'],
  LAC: ['the Chargers', 'the Bolts', 'the LA lightning crew'], LAR: ['the Rams', 'the LA crew', 'the horns'],
  LV: ['the Raiders', 'the Silver and Black', 'the Vegas crew'], MIA: ['the Dolphins', 'the Fins', 'the Miami boys'],
  MIN: ['the Vikings', 'the Vikes', 'the Purple People Eaters'], NE: ['the Patriots', 'the Pats', 'the New England crew'],
  NO: ['the Saints', 'Who Dat', 'the New Orleans crew'], NYG: ['the Giants', 'the G-Men', 'the New York crew'],
  NYJ: ['the Jets', 'Gang Green', 'J-E-T-S'], PHI: ['the Eagles', 'the Philly birds', 'the Birds'],
  PIT: ['the Steelers', 'the Pittsburgh crew', 'the Stillers'], SEA: ['the Seahawks', 'the Hawks', 'the Seattle crew'],
  SF: ['the 49ers', 'the Niners', 'the San Francisco crew'], TB: ['the Buccaneers', 'the Bucs', 'the Tampa crew'],
  TEN: ['the Titans', 'the Tennessee crew', 'the Nashville crew'], WAS: ['the Commanders', 'the Washington crew', 'the DC crew']
};

// Turn ESPN's real drive-by-drive plays into point changes for players on this league's rosters.
// The source is ESPN play-by-play; the point values use Fantasheee's configured league rules.
export function buildLiveFeed({ plays = [], teams = [], roster = {}, lineups = {}, players = new Map(), selectedTeamId = '', opponentTeamId = '' } = {}) {
  const scoring = APP_CONFIG.scoring;
  const owned = teams.flatMap((team) => (roster[team.id] || [])
    .map((id) => players.get(String(id)))
    .filter(Boolean)
    .map((player) => ({
      player,
      team,
      starter: !['BE', 'IR'].includes(String(lineups[team.id]?.[player.id] || player.lineupSlot || 'BE').toUpperCase())
    })));
  const ownedByNflTeam = new Map();
  owned.forEach((entry) => {
    const code = String(entry.player.nflTeam || '').toUpperCase();
    if (!code) return;
    if (!ownedByNflTeam.has(code)) ownedByNflTeam.set(code, []);
    ownedByNflTeam.get(code).push(entry);
  });

  const changes = [];
  const gameSnapshots = new Map();
  const orderedPlays = [...plays].sort((a, b) => new Date(a.happenedAt || 0) - new Date(b.happenedAt || 0));
  orderedPlays.forEach((play) => {
    const type = String(play.type || '').toLowerCase();
    const text = String(play.text || '');
    const offense = String(play.offenseTeamCode || '').toUpperCase();
    const defense = String(play.defenseTeamCode || '').toUpperCase();
    const offensePlayers = (ownedByNflTeam.get(offense) || []).filter(({ player }) => player.position !== 'DEF');
    const defensePlayers = (ownedByNflTeam.get(defense) || []).filter(({ player }) => player.position === 'DEF');
    const yards = Number(play.statYardage || 0);
    const touchdown = Boolean(play.scoringPlay) && /touchdown/i.test(text + ' ' + play.type);
    const gameKey = String(play.eventId || play.game || '');
    const previous = gameSnapshots.get(gameKey) || { homeScore: 0, awayScore: 0, homeYards: 0, awayYards: 0 };
    const homeScore = Number(play.homeScore ?? previous.homeScore);
    const awayScore = Number(play.awayScore ?? previous.awayScore);
    const homeYards = previous.homeYards + (offense === play.homeTeamCode && isOffensiveYardPlay(type) ? yards : 0);
    const awayYards = previous.awayYards + (offense === play.awayTeamCode && isOffensiveYardPlay(type) ? yards : 0);
    const readablePlay = expandRosterNames(text, owned.map(({ player }) => player));

    const add = (entry, pointsDelta, reason) => {
      if (!entry || !Number.isFinite(pointsDelta) || Math.abs(pointsDelta) < 0.0001) return;
      changes.push({
        id: `${play.id}:${entry.player.id}:${reason}`,
        team: entry.team,
        player: entry.player,
        isStarter: entry.starter,
        pointsDelta: roundPoints(pointsDelta),
        happenedAt: play.happenedAt || new Date().toISOString(),
        play: readablePlay,
        playType: play.type || 'NFL play',
        pointSource: reason,
        nflTeam: entry.player.nflTeam || offense || defense,
        quarter: Number(play.period || 0),
        clock: String(play.clock || ''),
        game: String(play.game || '')
      });
    };

    if (type.includes('pass reception') || type.includes('passing touchdown')) {
      const passIndex = text.search(/\bpass\b/i);
      const passer = passIndex > 0 ? findPlayer(offensePlayers, text.slice(0, passIndex)) : null;
      const toIndex = passIndex >= 0 ? text.slice(passIndex).search(/\bto\b/i) : -1;
      const receiverStart = toIndex >= 0 ? passIndex + toIndex + 2 : -1;
      const receiverText = receiverStart >= 0 ? text.slice(receiverStart).split(/\bfor\s+-?\d+\s+yards\b|,|\bpushed\b|\bto\s+[A-Z]{2,3}\s+\d+/i)[0] : '';
      const receiver = receiverText ? findPlayer(offensePlayers, receiverText) : null;
      if (receiver) add(receiver, Number(scoring.reception || 0) + yards * Number(scoring.recYd || 0) + (type.includes('passing touchdown') ? Number(scoring.recTd || 0) : 0), type.includes('passing touchdown') ? 'receiving-touchdown' : 'reception');
      if (passer) add(passer, yards * Number(scoring.passYd || 0) + (type.includes('passing touchdown') ? Number(scoring.passTd || 0) : 0), type.includes('passing touchdown') ? 'passing-touchdown' : 'passing-yards');
      if (type.includes('passing touchdown')) addExtraPoint(text, offensePlayers, add, scoring);
    } else if (type === 'rush' || type.includes('rushing touchdown')) {
      const runIndex = text.match(/\s+for\s+-?\d+\s+yards\b/i)?.index;
      const runner = findPlayer(offensePlayers, runIndex === undefined ? text : text.slice(0, runIndex));
      if (runner) add(runner, yards * Number(scoring.rushYd || 0) + (type.includes('rushing touchdown') ? Number(scoring.rushTd || 0) : 0), type.includes('rushing touchdown') ? 'rushing-touchdown' : 'rushing-yards');
      if (type.includes('rushing touchdown')) addExtraPoint(text, offensePlayers, add, scoring);
    }

    if (type.includes('field goal good') || (type.includes('field goal') && play.scoringPlay && /is\s+good/i.test(text))) {
      const kicker = findPlayer(offensePlayers, text.split(/\bfield goal\b/i)[0]);
      const distance = Math.abs(yards);
      if (kicker) add(kicker, distance >= 50 ? Number(scoring.fg50plus || 0) : Number(scoring.fg0to49 || 0), 'field-goal');
    } else if ((type.includes('extra point') || type.includes('point after')) && /is\s+good/i.test(text)) {
      const kicker = findPlayer(offensePlayers, text.split(/\bextra point\b|\bpoint after\b/i)[0]);
      if (kicker) add(kicker, Number(scoring.patMade || 0), 'extra-point');
    }

    if (play.scoringPlay && (type.includes('kickoff return') || type.includes('punt return'))) {
      const returner = findPlayer(offensePlayers, text.split(/\bfor\s+-?\d+\s+yards\b|\btouchdown\b/i)[0]);
      if (returner) add(returner, Number(scoring.returnTd || 0), 'return-touchdown');
      addExtraPoint(text, offensePlayers, add, scoring);
      const returnDefense = [...(ownedByNflTeam.get(offense) || []), ...(ownedByNflTeam.get(defense) || [])]
        .find(({ player }) => player.position === 'DEF');
      if (returnDefense) add(returnDefense, Number(scoring.dst?.touchdown || 0), 'special-teams-touchdown');
    }

    if (type.includes('interception')) {
      const passIndex = text.search(/\bpass\b/i);
      const passer = passIndex > 0 ? findPlayer(offensePlayers, text.slice(0, passIndex)) : null;
      if (passer) add(passer, Number(scoring.interceptionThrown || 0), 'interception-thrown');
      const dst = defensePlayers[0];
      if (dst) add(dst, Number(scoring.dst?.interception || 0) + (touchdown ? Number(scoring.dst?.touchdown || 0) : 0), touchdown ? 'pick-six' : 'defensive-interception');
    }

    if (type.includes('sack')) {
      const dst = defensePlayers[0];
      if (dst) add(dst, Number(scoring.dst?.sack || 0), 'sack');
    }
    if (type.includes('blocked')) {
      const dst = defensePlayers[0];
      if (dst) add(dst, Number(scoring.dst?.blockedKick || 0), 'blocked-kick');
    }
    if (type.includes('safety')) {
      const dst = defensePlayers[0];
      if (dst) add(dst, Number(scoring.dst?.safety || 0), 'safety');
    }
    if (type.includes('fumble') && (play.isTurnover || /recovered by|recovery/i.test(text))) {
      const carrierText = text.split(/\bfumbl(?:e|ed)\b/i)[0];
      const carrier = findPlayer(offensePlayers, carrierText);
      if (carrier && play.isTurnover) add(carrier, Number(scoring.fumbleLost || 0), 'fumble-lost');
      const dst = defensePlayers[0];
      if (dst && play.isTurnover && /recovered by|recovery/i.test(text)) add(dst, Number(scoring.dst?.fumbleRecovery || 0), 'fumble-recovery');
    }
    if ((type.includes('two-point') || type.includes('two point')) && play.scoringPlay) {
      const passIndex = text.search(/\bpass\b/i);
      if (passIndex >= 0) {
        const passer = findPlayer(offensePlayers, text.slice(0, passIndex));
        const toIndex = text.slice(passIndex).search(/\bto\b/i);
        const receiver = toIndex >= 0 ? findPlayer(offensePlayers, text.slice(passIndex + toIndex + 2)) : null;
        if (passer) add(passer, Number(scoring.twoPt || 0), 'passing-two-point');
        if (receiver) add(receiver, Number(scoring.twoPt || 0), 'receiving-two-point');
      } else {
        const runner = findPlayer(offensePlayers, text.split(/\b(?:good|no good)\b/i)[0]);
        if (runner) add(runner, Number(scoring.twoPt || 0), 'rushing-two-point');
      }
    }
    if (touchdown && /\b(?:return|intercepted|fumble recovery)\b/i.test(type + ' ' + text)
      && !type.includes('passing touchdown') && !type.includes('kickoff return') && !type.includes('punt return')) {
      const dst = defensePlayers[0];
      if (dst && !type.includes('interception')) add(dst, Number(scoring.dst?.touchdown || 0), 'defensive-touchdown');
    }

    const dst = defensePlayers[0];
    if (dst) {
      const defensiveHome = defense === play.homeTeamCode;
      const allowedBefore = defensiveHome ? previous.awayScore : previous.homeScore;
      const allowedAfter = defensiveHome ? awayScore : homeScore;
      const allowedDelta = dstBucket(allowedAfter, scoring.dst?.pointsAllowed) - dstBucket(allowedBefore, scoring.dst?.pointsAllowed);
      if (allowedDelta) add(dst, allowedDelta, 'points-allowed');

      const yardsBefore = defensiveHome ? previous.awayYards : previous.homeYards;
      const yardsAfter = defensiveHome ? awayYards : homeYards;
      const yardsDelta = dstBucket(yardsAfter, scoring.dst?.yardsAllowed) - dstBucket(yardsBefore, scoring.dst?.yardsAllowed);
      if (yardsDelta) add(dst, yardsDelta, 'yards-allowed');
    }
    gameSnapshots.set(gameKey, { homeScore, awayScore, homeYards, awayYards });
  });

  const repeatCounts = new Map();
  const chronological = changes.sort((a, b) => new Date(a.happenedAt) - new Date(b.happenedAt));
  chronological.forEach((event) => {
    const key = `${event.team.id}:${event.player.id}`;
    const count = (repeatCounts.get(key) || 0) + 1;
    repeatCounts.set(key, count);
    event.commentary = makeCommentary(event, count, chronological.length);
  });

  return chronological
    .filter((event) => event.team && event.player)
    .sort((a, b) => new Date(b.happenedAt) - new Date(a.happenedAt))
    .slice(0, 100);
}

export function nflTeamName(player, variant = 0) {
  const code = String(player?.nflTeam || '').toUpperCase();
  const names = NFL_TEAM_NAMES[code];
  return names ? names[Math.abs(variant) % names.length] : player?.nflTeam || 'their NFL team';
}

function addExtraPoint(text, offensePlayers, add, scoring) {
  const match = text.match(/([A-Z][A-Za-z.'’\-]*)\s+extra point is GOOD/i);
  if (!match) return;
  const kicker = findPlayer(offensePlayers, match[1]);
  if (kicker) add(kicker, Number(scoring.patMade || 0), 'extra-point');
}

function findPlayer(entries, fragment) {
  if (!fragment) return null;
  const text = normalizeName(fragment);
  const matches = entries.filter(({ player }) => aliases(player.name).some((alias) => (` ${text} `).includes(` ${alias} `)));
  return matches.length === 1 ? matches[0] : null;
}

function aliases(name) {
  const parts = String(name || '').replace(/\b(?:jr|sr|ii|iii|iv)\.?\b/ig, '').split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];
  const first = normalizeName(parts[0]);
  const surname = normalizeName(parts[parts.length - 1]);
  const fullSurname = normalizeName(parts.slice(1).join(' '));
  return [...new Set([`${first[0]} ${surname}`, `${first[0]} ${fullSurname}`].filter((alias) => alias.length > 2))];
}

function expandRosterNames(text, players) {
  const references = players.flatMap((player) => {
    const parts = String(player.name || '').replace(/\b(?:jr|sr|ii|iii|iv)\.?\b/ig, '').split(/\s+/).filter(Boolean);
    if (parts.length < 2) return [];
    const surnames = [...new Set([parts.slice(1).join(' '), parts.at(-1)])];
    return surnames.map((surname) => ({ alias: `${parts[0][0]} ${surname}`, name: player.name }));
  }).sort((a, b) => b.alias.length - a.alias.length);

  return references.reduce((result, reference) => {
    const separator = reference.alias.indexOf(' ');
    const initial = reference.alias.slice(0, separator);
    const surname = reference.alias.slice(separator + 1)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    const pattern = new RegExp(`(^|[^A-Za-z])${initial}\\.?\\s*${surname}(?=$|[^A-Za-z])`, 'gi');
    return result.replace(pattern, (_match, prefix) => `${prefix}${reference.name}`);
  }, String(text || ''));
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function isOffensiveYardPlay(type) {
  return type === 'rush' || type.includes('rushing touchdown') || type.includes('pass reception') || type.includes('passing touchdown') || type.includes('sack');
}

function dstBucket(value, rows = []) {
  const amount = Number(value) || 0;
  const row = rows.find((item) => amount <= Number(item.max));
  return Number(row?.pts || 0);
}

function makeCommentary(event, repeatCount, seed) {
  const credited = creditedPlayer(event.team, event.player);
  const club = nflTeamName(event.player, seed + repeatCount);
  const yards = Math.abs(Number(event.pointsDelta) || 0);
  if (event.pointsDelta < 0) {
    return [
      `${credited} just handed the other side a gift-wrapped ${yards.toFixed(1)}-point swing. Fucking brutal—shake it off and get it back.`,
      `A ${yards.toFixed(1)}-point gut punch for ${event.team.name}. That was ugly as hell; no sulking, next play.`,
      `${credited} dropped ${yards.toFixed(1)} right there. Nasty little momentum theft—but there's still time to swing back.`
    ][Math.abs(seed + repeatCount) % 3];
  }
  if (event.player.position === 'DEF') {
    if (event.pointSource === 'points-allowed') return `${event.team.name}’s defense just let the opponent cross a scoring threshold: −${yards.toFixed(1)}. Painful as hell; go get the ball back.`;
    if (event.pointSource === 'yards-allowed') return `${event.team.name}’s defense gave up enough real estate to lose ${yards.toFixed(1)}. Somebody find these lads a map—and a tackle.`;
    return `${event.team.name}’s D gets a ${event.playType.toLowerCase()} for ${club}. +${yards.toFixed(1)}; make that quarterback feel every bit of it.`;
  }
  const amount = Number(event.pointsDelta).toFixed(1);
  const repeat = repeatCount > 1 ? ' Again. This menace has clearly not read the “stop doing that” memo.' : '';
  if (event.player.position === 'K' && event.pointSource === 'extra-point') {
    return `${credited} tacks on the extra point for ${club}: +${amount}. The quiet bit of business still counts, baby.`;
  }
  if (event.pointSource === 'passing-touchdown') {
    return `${credited} launches the touchdown strike for ${club}: +${amount}. The secondary was sightseeing again.` + repeat;
  }
  if (event.pointSource === 'return-touchdown') {
    return `${credited} takes it back to the house for ${club}: +${amount}. Special teams just committed daylight robbery.` + repeat;
  }
  if (event.pointSource === 'receiving-touchdown' || event.pointSource === 'rushing-touchdown') {
    return [`${credited} finds the end zone for ${club}. +${amount} for ${event.team.name}. Six-point arson, and the defense brought a water pistol.`, `${credited} cashes in the touchdown—${club} can’t keep this bastard out. +${amount}; absolutely filthy.`][repeatCount % 2] + repeat;
  }
  if (event.playType.toLowerCase().includes('field goal')) {
    return `${credited} knocks it through for ${club}: +${amount} to ${event.team.name}. Calm, tidy, and deeply annoying for the other lot.`;
  }
  if (event.playType.toLowerCase().includes('pass reception')) {
    if (event.pointSource === 'passing-yards') return `${credited} adds ${amount} from the completion for ${club}. The arm's warming up; keep the chains moving.` + repeat;
    return `${credited} hauls it in for ${club}: +${amount} for ${event.team.name}. The coverage got cooked and served with a side of “what the hell was that?”` + repeat;
  }
  return `${credited} picks up ${amount} for ${event.team.name} against ${club}. Good work—keep feeding the beast.` + repeat;
}

function creditedPlayer(team, player) {
  const last = String(player.name || 'Player').trim().split(/\s+/).at(-1);
  if (/\bpickens\b/i.test(player.name || '')) return 'Linda’s Pickens';
  const owner = String(team.ownerName || '').trim();
  const genericOwner = /^ESPNFAN\d+$/i.test(owner)
    || owner.toLowerCase() === String(team.name || '').trim().toLowerCase();
  return owner && !genericOwner ? `${owner}’s ${last}` : player.name;
}

function roundPoints(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
