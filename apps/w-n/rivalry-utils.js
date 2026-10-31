(function attachRivalry(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WN_RIVALRY = api;
})(typeof window !== 'undefined' ? window : globalThis, function createRivalryUtils(){
  function score(value){
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function scoreLabel(value){
    const number = score(value);
    return Number.isInteger(number) ? String(number) : number.toFixed(1).replace('.0','');
  }

  function metadataFor(playerById, id){
    if (playerById instanceof Map) return playerById.get(id) || {};
    return playerById?.[id] || {};
  }

  function summarizeRivalry({teams=[], results={}, playerById={}}={}){
    const pair = teams.slice(0,2);
    const teamById = Object.fromEntries(pair.map(team=>[team.id, team]));
    const records = Object.fromEntries(pair.map(team=>[team.id, {
      wins:0, losses:0, ties:0, pointsFor:0, pointsAgainst:0
    }]));
    const weeklyResults = Object.entries(results || {})
      .filter(([, result]) => result && typeof result === 'object')
      .map(([week, result]) => {
        const aScore = score(result.aScore);
        const bScore = score(result.bScore);
        const winner = result.winner === 'tie' || teamById[result.winner]
          ? result.winner
          : aScore === bScore ? 'tie' : aScore > bScore ? pair[0]?.id : pair[1]?.id;
        return {
          week: Number(week),
          aScore,
          bScore,
          score: `${scoreLabel(aScore)}–${scoreLabel(bScore)}`,
          winner,
          winnerName: winner === 'tie' ? 'Tie' : teamById[winner]?.name || 'Result saved',
          margin: Math.abs(aScore - bScore),
          combined: aScore + bScore,
          playerScores: Array.isArray(result.playerScores) ? result.playerScores : []
        };
      })
      .filter(result => Number.isInteger(result.week) && result.week >= 1 && result.week <= 18)
      .sort((a,b)=>b.week-a.week);

    weeklyResults.forEach(result=>{
      const a = records[pair[0]?.id];
      const b = records[pair[1]?.id];
      if (!a || !b) return;
      a.pointsFor += result.aScore;
      a.pointsAgainst += result.bScore;
      b.pointsFor += result.bScore;
      b.pointsAgainst += result.aScore;
      if (result.winner === 'tie') {
        a.ties++;
        b.ties++;
      } else if (result.winner === pair[0]?.id) {
        a.wins++;
        b.losses++;
      } else if (result.winner === pair[1]?.id) {
        b.wins++;
        a.losses++;
      }
    });

    const played = weeklyResults.filter(result => result.winner === 'tie' || teamById[result.winner]);
    const decisive = played.filter(result => result.winner !== 'tie');
    const biggestWin = decisive.reduce((best,result)=>!best || result.margin > best.margin ? result : best, null);
    const closestMatchup = decisive.reduce((best,result)=>!best || result.margin < best.margin ? result : best, null);
    const highestCombined = played.reduce((best,result)=>!best || result.combined > best.combined ? result : best, null);

    const scorerMap = new Map();
    played.forEach(result=>result.playerScores.forEach(snapshot=>{
      if (!snapshot?.id) return;
      const id = String(snapshot.id);
      const metadata = metadataFor(playerById, id);
      const team = teamById[snapshot.teamId];
      const points = score(snapshot.points);
      const current = scorerMap.get(id) || {
        id,
        name: snapshot.name || metadata.name || 'Player missing',
        position: snapshot.position || metadata.position || '—',
        nflTeam: snapshot.team || metadata.team || '—',
        teamId: snapshot.teamId || '',
        teamNames: [],
        total: 0,
        best: 0,
        weeks: 0
      };
      const teamName = team?.name || snapshot.teamName;
      if (teamName && !current.teamNames.includes(teamName)) current.teamNames.push(teamName);
      current.total += points;
      current.best = Math.max(current.best, points);
      current.weeks++;
      current.name = snapshot.name || metadata.name || current.name;
      current.position = snapshot.position || metadata.position || current.position;
      current.nflTeam = snapshot.team || metadata.team || current.nflTeam;
      scorerMap.set(id, current);
    }));

    const topScorers = [...scorerMap.values()]
      .sort((a,b)=>b.total-a.total || b.best-a.best || a.name.localeCompare(b.name))
      .slice(0,5);
    const funStats = {
      biggestWin: biggestWin ? {...biggestWin, winnerName: biggestWin.winnerName} : null,
      closestMatchup: closestMatchup ? {...closestMatchup} : null,
      highestCombined: highestCombined ? {...highestCombined} : null
    };

    return {
      records,
      totals: {played: played.length, combinedPoints: played.reduce((sum,result)=>sum+result.combined,0)},
      funStats,
      topScorers,
      weeklyResults
    };
  }

  function buildPlayerScoreSnapshot({teams=[], starterSlots=[], playerById={}, scoreFor=()=>0}={}){
    return teams.slice(0,2).flatMap(team=>starterSlots.map(slot=>{
      const id = team.roster?.[slot];
      if (!id) return null;
      const player = metadataFor(playerById, id);
      return {
        id: String(id),
        teamId: team.id,
        teamName: team.name,
        name: player.name || `Player ${id}`,
        position: player.position || slot,
        team: player.team || '',
        points: score(scoreFor(id))
      };
    }).filter(Boolean));
  }

  return {summarizeRivalry, buildPlayerScoreSnapshot};
});
