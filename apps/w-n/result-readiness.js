(function attachResultReadiness(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WN_RESULT_READINESS = api;
})(typeof window !== 'undefined' ? window : globalThis, function createResultReadiness(){
  function canRecordCompletedWeek({weekComplete=false, stats={}, rosterIds=[], statsPartial=false}={}){
    if (!weekComplete || statsPartial) return false;
    const ids = rosterIds.filter(Boolean);
    if (!ids.length) return false;
    return ids.every(id => Object.prototype.hasOwnProperty.call(stats, id));
  }

  return {canRecordCompletedWeek};
});
