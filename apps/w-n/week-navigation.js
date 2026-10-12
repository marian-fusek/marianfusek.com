(function attachWeekNavigation(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WN_WEEK_NAV = api;
})(typeof window !== 'undefined' ? window : globalThis, function createWeekNavigation(){
  const MIN_WEEK = 1;
  const MAX_WEEK = 18;

  function clampWeek(value){
    return Math.min(MAX_WEEK, Math.max(MIN_WEEK, Number(value) || MIN_WEEK));
  }

  function targetWeek(current, direction){
    const delta = direction === 'next' ? 1 : direction === 'prev' ? -1 : 0;
    return clampWeek(clampWeek(current) + delta);
  }

  function requestWeek(current, direction, busy){
    const week = clampWeek(current);
    return busy ? {accepted:false, week} : {accepted:true, week:targetWeek(week, direction)};
  }

  return {clampWeek, targetWeek, requestWeek};
});
