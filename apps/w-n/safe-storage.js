(function attachSafeStorage(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WN_SAFE_STORAGE = api;
})(typeof window !== 'undefined' ? window : globalThis, function createSafeStorage(){
  function setItemSafe(storage, key, value){
    try {
      storage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`W-N cache write skipped for ${key}`, error);
      return false;
    }
  }

  return {setItemSafe};
});
