(function attachRosterPolicy(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WN_ROSTER_POLICY = api;
})(typeof window !== 'undefined' ? window : globalThis, function createRosterPolicy(){
  function canChangeRoster(){
    return true;
  }

  return {canChangeRoster};
});
