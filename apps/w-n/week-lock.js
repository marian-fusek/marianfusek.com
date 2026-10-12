(function attachWeekLock(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WN_WEEK_LOCK = api;
})(typeof window !== 'undefined' ? window : globalThis, function createWeekLock(){
  function isFinalGame(game){
    return game?.state === 'post' || game?.state === 'completed';
  }

  function shouldLockWeek({result=null, schedule=[]}={}){
    const games = Array.isArray(schedule) ? schedule : [];
    if (games.length) return games.every(isFinalGame);
    return Boolean(result);
  }

  function visibleResult({result=null, schedule=[]}={}){
    return shouldLockWeek({result, schedule}) ? result : null;
  }

  return {shouldLockWeek, visibleResult};
});
