(function attachRefreshHelpers(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WN_REFRESH_HELPERS = api;
})(typeof window !== 'undefined' ? window : globalThis, function createRefreshHelpers(){
  function shouldUsePlayerCache(cache, now=Date.now(), maxAge=86_400_000){
    const age=Number(now) - Number(cache?.ts);
    return Array.isArray(cache?.players) && cache.players.length > 0 && age >= 0 && age < maxAge;
  }

  function refreshCompletionLabel({partial=false}={}){
    return partial ? 'Updated with cached data' : 'Updated just now';
  }

  return {shouldUsePlayerCache, refreshCompletionLabel};
});
