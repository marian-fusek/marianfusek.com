'use strict';

  function annotateHtmlForPreview(source) {
    let output = '';
    let cursor = 0;
    let rawTag = null;
    const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([A-Za-z][\w:-]*)\b[^>]*>/g;
    let match;

    while ((match = tagPattern.exec(source))) {
      if (rawTag) {
        if (!(match[0].startsWith('</') && match[1]?.toLowerCase() === rawTag)) continue;
        rawTag = null;
        continue;
      }

      const token = match[0];
      const tagName = match[1]?.toLowerCase();
      if (!tagName || token.startsWith('</') || token.startsWith('<!')) continue;

      output += source.slice(cursor, match.index);
      const sourceStart = match.index;
      const closeIndex = token.lastIndexOf('>');
      const selfClosing = /\/\s*>$/.test(token);
      const annotated = `${token.slice(0, closeIndex)} data-n7-source-start="${sourceStart}"${token.slice(closeIndex)}`;
      output += annotated;
      cursor = match.index + token.length;

      if (!selfClosing && (tagName === 'script' || tagName === 'style')) rawTag = tagName;
    }

    return output + source.slice(cursor);
  }

  function htmlTagRangeAt(source, start) {
    if (!Number.isFinite(start) || start < 0 || start >= source.length || source[start] !== '<') return null;
    let quote = null;
    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (char === quote && source[index - 1] !== '\\') quote = null;
        continue;
      }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '>') return { start, end: index + 1 };
    }
    return null;
  }

  function revealHtmlSource(sourceStart) {
    const range = htmlTagRangeAt(state.code.html, Number(sourceStart));
    if (!range) return;

    if (state.view !== 'html') {
      applyView('html', true);
      persistPrefs();
    }

    window.setTimeout(() => {
      const input = getEditorParts(singleEditor).input;
      state.matchRanges.html = [range];
      syncEditor(singleEditor, 'html');
      input.focus({ preventScroll: true });
      input.setSelectionRange(range.start, range.end);

      const before = input.value.slice(0, range.start);
      const line = before.split('\n').length - 1;
      const computed = window.getComputedStyle(input);
      const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
      input.scrollTop = Math.max(0, line * lineHeight - input.clientHeight * 0.42);
      syncScroll(getEditorParts(singleEditor));
    }, state.view === 'html' ? 0 : 240);
  }

  function htmlSourceStartAtOffset(source, offset) {
    const caret = clamp(Number(offset) || 0, 0, source.length);
    const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const stack = [];
    const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([A-Za-z][\w:-]*)\b[^>]*>/g;
    let match;

    while ((match = tagPattern.exec(source))) {
      if (match.index > caret) break;
      const token = match[0];
      const tagName = match[1]?.toLowerCase();
      if (!tagName || token.startsWith('<!')) continue;

      if (token.startsWith('</')) {
        for (let index = stack.length - 1; index >= 0; index -= 1) {
          if (stack[index].tagName === tagName) {
            stack.splice(index);
            break;
          }
        }
        continue;
      }

      const entry = { tagName, sourceStart: match.index, end: match.index + token.length };
      if (caret >= entry.sourceStart && caret <= entry.end) return entry.sourceStart;
      if (!voidTags.has(tagName) && !/\/\s*>$/.test(token)) stack.push(entry);
    }

    return stack.length ? stack[stack.length - 1].sourceStart : null;
  }

  function isDetachedPreviewOpen() {
    return Boolean(state.detachedWindow && !state.detachedWindow.closed);
  }

  function postToPreviewSurfaces(payload) {
    if (preview.contentWindow) preview.contentWindow.postMessage(payload, '*');
    if (isDetachedPreviewOpen()) state.detachedWindow.postMessage(payload, '*');
  }

  function requestPreviewHighlight(sourceStart) {
    if (!state.previewReady && !isDetachedPreviewOpen()) return;
    postToPreviewSurfaces({
      source: 'n7-editor',
      type: 'highlight',
      sourceStart: Number.isFinite(sourceStart) ? sourceStart : null,
      theme: state.theme,
      renderId: state.renderId
    });
  }

  function highlightPreviewFromHtmlInput(input) {
    requestPreviewHighlight(htmlSourceStartAtOffset(state.code.html, input.selectionStart));
  }

  function previewBridge(renderId, options = {}) {
    const hosted = Boolean(options.hosted);
    const runtimeBase = String(options.runtimeBase || '');
    const projectToken = String(options.projectToken || state.projectToken || '');
    return `<script>
(() => {
  const hostedRuntime = ${hosted ? 'true' : 'false'};
  const runtimeBase = ${JSON.stringify(runtimeBase)};
  const projectToken = ${JSON.stringify(projectToken)};
  const lineFrom = (error) => {
    const stack = String(error?.stack || '');
    const match = stack.match(/(?:mf-user\.js|mf-project\/[^:\s]+):(\d+):/);
    return match ? Number(match[1]) : null;
  };
  const host = window.opener && !window.opener.closed ? window.opener : parent;
  const send = (type, message = '', line = null, extra = {}) => host.postMessage({ source: 'n7-preview', type, message, line, renderId: ${renderId}, projectToken, ...extra }, '*');
  window.__n7LibPromises = window.__n7LibPromises || [];
  window.__n7LibraryError = (name) => send('library-error', String(name || 'library'));
  // Sandboxed previews intentionally keep an opaque origin for safety. Some real
  // front-end code still expects Web Storage to exist during startup; provide a
  // preview-local fallback instead of letting SecurityError abort the app.
  const memoryStorage = () => {
    const values = new Map();
    return { get length(){return values.size;}, key(i){return [...values.keys()][i] ?? null;}, getItem(k){k=String(k);return values.has(k)?values.get(k):null;}, setItem(k,v){values.set(String(k),String(v));}, removeItem(k){values.delete(String(k));}, clear(){values.clear();} };
  };
  try { void localStorage.length; } catch { try { Object.defineProperty(window, 'localStorage', { configurable:true, value:memoryStorage() }); } catch {} }
  try { void sessionStorage.length; } catch { try { Object.defineProperty(window, 'sessionStorage', { configurable:true, value:memoryStorage() }); } catch {} }
  send('bridge-ready');
  const inspectMap = new WeakMap();
  const sourceMap = new Map();
  let highlightOverlay = null;
  let highlightedElement = null;
  let highlightTimer = null;
  let loaderRescueDone = false;

  const rescueBlockingLoader = () => {
    if (loaderRescueDone) return false;
    loaderRescueDone = true;
    const candidates = [...document.querySelectorAll('[class*=\"loader\" i],[id*=\"loader\" i],[class*=\"preloader\" i],[id*=\"preloader\" i],[data-loader],[data-loading]')];
    let rescued = false;
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    candidates.forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const coverage = Math.max(0, rect.width) * Math.max(0, rect.height) / viewportArea;
      const blocksViewport = coverage > .42 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      if (!blocksViewport || style.display === 'none' || style.visibility === 'hidden') return;
      element.style.setProperty('transition', 'opacity .5s cubic-bezier(.18,.78,.18,1), filter .5s cubic-bezier(.18,.78,.18,1)', 'important');
      element.style.setProperty('opacity', '0', 'important');
      element.style.setProperty('filter', 'blur(5px)', 'important');
      element.style.setProperty('pointer-events', 'none', 'important');
      window.setTimeout(() => element.style.setProperty('display', 'none', 'important'), 520);
      rescued = true;
    });
    if (rescued) {
      if (document.documentElement) document.documentElement.style.setProperty('overflow', 'auto', 'important');
      if (document.body && getComputedStyle(document.body).overflow === 'hidden') document.body.style.setProperty('overflow', 'auto', 'important');
      send('loader-bypassed');
    }
    return rescued;
  };

  const removeHighlight = () => {
    window.clearTimeout(highlightTimer);
    highlightedElement = null;
    if (!highlightOverlay) return;
    highlightOverlay.style.setProperty('opacity', '0', 'important');
    const overlay = highlightOverlay;
    highlightOverlay = null;
    window.setTimeout(() => overlay.remove(), 360);
  };

  const positionHighlight = () => {
    if (!highlightOverlay || !highlightedElement?.isConnected) return;
    const rect = highlightedElement.getBoundingClientRect();
    const radius = Math.min(26, (parseFloat(getComputedStyle(highlightedElement).borderTopLeftRadius) || 0) + 7);
    const pad = 6;
    highlightOverlay.style.setProperty('left', (rect.left - pad) + 'px', 'important');
    highlightOverlay.style.setProperty('top', (rect.top - pad) + 'px', 'important');
    highlightOverlay.style.setProperty('width', Math.max(rect.width + pad * 2, 12) + 'px', 'important');
    highlightOverlay.style.setProperty('height', Math.max(rect.height + pad * 2, 12) + 'px', 'important');
    highlightOverlay.style.setProperty('border-radius', radius + 'px', 'important');
  };

  const highlightSource = (sourceStart, theme = 'light') => {
    removeHighlight();
    const element = sourceMap.get(Number(sourceStart));
    if (!element) return;
    highlightedElement = element;
    const rect = element.getBoundingClientRect();
    const outside = rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth;
    if (outside) element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });

    const dark = theme === 'dark';
    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('data-n7-highlight-overlay', '');
    const overlayStyle = overlay.style;
    overlayStyle.setProperty('display', 'block', 'important');
    overlayStyle.setProperty('position', 'fixed', 'important');
    overlayStyle.setProperty('box-sizing', 'border-box', 'important');
    overlayStyle.setProperty('pointer-events', 'none', 'important');
    overlayStyle.setProperty('z-index', '2147483647', 'important');
    overlayStyle.setProperty('margin', '0', 'important');
    overlayStyle.setProperty('padding', '0', 'important');
    overlayStyle.setProperty('border', dark ? '1px solid rgba(218,229,239,.32)' : '1px solid rgba(91,111,139,.28)', 'important');
    overlayStyle.setProperty('background', dark ? 'rgba(205,222,236,.055)' : 'rgba(151,181,203,.075)', 'important');
    overlayStyle.setProperty('box-shadow', dark
      ? '0 0 0 1px rgba(255,255,255,.045) inset, 0 0 28px rgba(155,187,213,.13), 0 14px 42px rgba(128,151,178,.08)'
      : '0 0 0 1px rgba(255,255,255,.34) inset, 0 0 30px rgba(140,174,199,.16), 0 14px 42px rgba(93,116,145,.075)', 'important');
    overlayStyle.setProperty('opacity', '0', 'important');
    overlayStyle.setProperty('filter', 'blur(3px)', 'important');
    overlayStyle.setProperty('transition', 'opacity .58s cubic-bezier(.18,.78,.18,1), filter .58s cubic-bezier(.18,.78,.18,1), left .68s cubic-bezier(.18,.78,.18,1), top .68s cubic-bezier(.18,.78,.18,1), width .68s cubic-bezier(.18,.78,.18,1), height .68s cubic-bezier(.18,.78,.18,1), border-radius .68s cubic-bezier(.18,.78,.18,1)', 'important');
    document.documentElement.appendChild(overlay);
    highlightOverlay = overlay;

    const revealDelay = outside ? 420 : 0;
    window.setTimeout(() => {
      positionHighlight();
      if (highlightOverlay !== overlay) return;
      overlay.style.setProperty('opacity', '.92', 'important');
      overlay.style.setProperty('filter', 'blur(0)', 'important');
      window.setTimeout(() => {
        if (highlightOverlay === overlay) overlay.style.setProperty('opacity', '.72', 'important');
      }, 470);
    }, revealDelay);
    highlightTimer = window.setTimeout(removeHighlight, 1720);
  };

  window.addEventListener('scroll', positionHighlight, true);
  window.addEventListener('resize', positionHighlight);

  window.__n7PrepareInspect = () => {
    document.querySelectorAll('[data-n7-source-start]').forEach((element) => {
      const sourceStart = Number(element.getAttribute('data-n7-source-start'));
      if (Number.isFinite(sourceStart)) { inspectMap.set(element, sourceStart); sourceMap.set(sourceStart, element); }
      element.removeAttribute('data-n7-source-start');
    });
  };
  const dismissBlockingOverlay = () => {
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const candidates = [...document.querySelectorAll('body *')].filter((element) => {
      if (!(element instanceof HTMLElement) || element.hasAttribute('data-n7-highlight-overlay')) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const coverage = Math.max(0, rect.width) * Math.max(0, rect.height) / viewportArea;
      const layer = Number.parseInt(style.zIndex, 10);
      return coverage > .38 && ['fixed','sticky'].includes(style.position) && (Number.isFinite(layer) ? layer > 5 : true) && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const element = candidates.sort((a, b) => (Number.parseInt(getComputedStyle(b).zIndex, 10) || 0) - (Number.parseInt(getComputedStyle(a).zIndex, 10) || 0))[0];
    if (!element) return false;
    element.style.setProperty('transition', 'opacity .5s cubic-bezier(.18,.78,.18,1), filter .5s cubic-bezier(.18,.78,.18,1)', 'important');
    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('filter', 'blur(5px)', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
    window.setTimeout(() => element.style.setProperty('display', 'none', 'important'), 520);
    return true;
  };
  const restoreScroll = () => {
    document.documentElement?.style.setProperty('overflow', 'auto', 'important');
    document.body?.style.setProperty('overflow', 'auto', 'important');
    document.documentElement?.style.removeProperty('overscroll-behavior');
    document.body?.style.removeProperty('overscroll-behavior');
    return true;
  };
  const disableMedia = () => {
    let changed = false;
    document.querySelectorAll('video,audio').forEach((media) => { try { media.pause(); media.autoplay = false; media.removeAttribute('autoplay'); changed = true; } catch {} });
    return changed;
  };
  const runRecovery = (action) => {
    let applied = false;
    if (action === 'loader') applied = rescueBlockingLoader();
    if (action === 'overlay') applied = dismissBlockingOverlay();
    if (action === 'scroll') applied = restoreScroll();
    if (action === 'media') applied = disableMedia();
    send('recovery-applied', '', null, { action, applied });
  };
  window.__n7Run = (code) => { try { (0, eval)(code + '\\n//# sourceURL=n7-user.js'); } catch (error) { send('error', error.message || 'JavaScript error', lineFrom(error)); } };
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      const element = event.target;
      const ref = element?.getAttribute?.('data-n7-original-src') || element?.getAttribute?.('src') || element?.getAttribute?.('href') || '';
      const tag = element?.tagName ? String(element.tagName).toLowerCase() : 'resource';
      send('error', 'Resource failed: ' + tag + (ref ? ' · ' + ref : ''), null);
      return;
    }
    send('error', event.message || 'JavaScript error', lineFrom(event.error));
  }, true);
  window.addEventListener('unhandledrejection', (event) => { send('error', String(event.reason || 'Promise error'), lineFrom(event.reason)); });
  window.addEventListener('message', (event) => {
    if (event.source !== host || event.data?.source !== 'n7-editor' || event.data.renderId !== ${renderId}) return;
    if (event.data.type === 'css-update') {
      const style = document.getElementById('mf-user-style');
      if (!style) return;
      style.textContent = String(event.data.css || '');
      positionHighlight();
      send('css-applied', '', null, { cssUpdateId: event.data.cssUpdateId });
    }
    if (event.data.type === 'highlight') highlightSource(event.data.sourceStart, event.data.theme);
    if (event.data.type === 'recover') runRecovery(event.data.action);
    if (event.data.type === 'editor-disconnected') {
      const note = document.createElement('div');
      note.textContent = 'EDITOR DISCONNECTED';
      note.setAttribute('aria-live', 'polite');
      Object.assign(note.style, { position:'fixed', left:'50%', bottom:'18px', transform:'translateX(-50%)', zIndex:'2147483647', padding:'9px 12px', borderRadius:'10px', font:'500 9px/1 sans-serif', letterSpacing:'.08em', background:'rgba(24,28,35,.84)', color:'rgba(255,255,255,.82)', backdropFilter:'blur(18px)' });
      document.documentElement.appendChild(note);
    }
  });
  window.addEventListener('DOMContentLoaded', () => {
    const styleExpectation=window.__n7StyleExpectation;
    if(styleExpectation?.localRefs>0){const active=document.querySelectorAll('style[data-n7-original-href],style[data-n7-fallback-style]').length;if(!active)send('resource-error','STYLES NOT APPLIED');}
    document.addEventListener('click', (event) => {
      let target = event.target;
      while (target && target !== document && !inspectMap.has(target)) target = target.parentElement;
      if (target && inspectMap.has(target)) send('inspect', '', null, { sourceStart: inspectMap.get(target) });
      const link = event.target?.closest?.('a[href]');
      if (link && !hostedRuntime) event.preventDefault();
    }, true);
    if (hostedRuntime && runtimeBase) {
      try {
        const runtimeUrl = new URL(runtimeBase);
        const currentUrl = new URL(location.href);
        const basePath = runtimeUrl.pathname.endsWith('/') ? runtimeUrl.pathname : runtimeUrl.pathname + '/';
        const runtimePath = decodeURIComponent(currentUrl.pathname.startsWith(basePath) ? currentUrl.pathname.slice(basePath.length) : '');
        if (runtimePath) send('navigated', '', null, { runtimePath });
      } catch {}
    }
    send('loaded');
  });
})();
<\/script>`;
  }


  const HOSTED_RUNTIME_CACHE = 'n7-code-runtime-v3';

  function hostedRuntimeCapable() {
    return location.protocol === 'https:' && 'serviceWorker' in navigator && 'caches' in window;
  }

  async function waitForHostedController(timeout = 2400) {
    if (navigator.serviceWorker.controller) return true;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        resolve(value);
      };
      const onChange = () => finish(Boolean(navigator.serviceWorker.controller));
      navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true });
      window.setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), timeout);
    });
  }

  async function initHostedRuntime() {
    state.hostedRuntime.supported = hostedRuntimeCapable();
    if (!state.hostedRuntime.supported) return false;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      try { await registration.update(); } catch {}
      const readyRegistration = await navigator.serviceWorker.ready;
      state.hostedRuntime.registration = readyRegistration || registration;
      state.hostedRuntime.scope = (readyRegistration || registration).scope;
      // Registration readiness alone is not enough: project URLs must actually be
      // controlled before FULL PROJECT mode is allowed to take ownership.
      const controlled = await waitForHostedController();
      state.hostedRuntime.ready = Boolean(controlled);
      if (state.project?.mode === 'folder') renderPreview();
      return state.hostedRuntime.ready;
    } catch (error) {
      console.warn('N7-Code hosted runtime unavailable; using local compatibility preview.', error);
      state.hostedRuntime.ready = false;
      return false;
    }
  }

  function hostedProjectId(project = state.project) {
    return ensureRuntimeProjectId(project) || 'project';
  }

  function hostedPathUrl(path, projectId = hostedProjectId()) {
    const scope = state.hostedRuntime.scope || new URL('./', location.href).href;
    const encodedPath = normalizeProjectPath(path).split('/').filter(Boolean).map((part) => encodeURIComponent(part)).join('/');
    return new URL(`__n7_project__/${encodeURIComponent(projectId)}/${encodedPath}`, scope).href;
  }

  function hostedProjectBase(projectId = hostedProjectId()) {
    const scope = state.hostedRuntime.scope || new URL('./', location.href).href;
    return new URL(`__n7_project__/${encodeURIComponent(projectId)}/`, scope).href;
  }

  function runtimeMime(path, record = null) {
    const ext = String(path || '').split('.').pop()?.toLowerCase() || '';
    const known = {
      html:'text/html; charset=utf-8', htm:'text/html; charset=utf-8', css:'text/css; charset=utf-8', js:'text/javascript; charset=utf-8', mjs:'text/javascript; charset=utf-8',
      json:'application/json; charset=utf-8', svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', avif:'image/avif',
      ico:'image/x-icon', woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf', mp4:'video/mp4', webm:'video/webm', mp3:'audio/mpeg', wav:'audio/wav',
      txt:'text/plain; charset=utf-8', xml:'application/xml; charset=utf-8', pdf:'application/pdf', wasm:'application/wasm'
    };
    return known[ext] || record?.file?.type || 'application/octet-stream';
  }

  function rewriteHostedRootRefs(text, runtimeBase, kind = 'text') {
    let output = String(text || '');
    const rootUrl = (ref) => `${runtimeBase}${String(ref || '').replace(/^\/+/, '')}`;
    if (kind === 'css') {
      output = output.replace(/url\(\s*(["']?)\/(?!\/)([^)"']+)\1\s*\)/gi, (m, q, ref) => `url("${rootUrl(ref)}")`);
      output = output.replace(/(@import\s+(?:url\(\s*)?["']?)\/(?!\/)([^"')\s;]+)/gi, (m, lead, ref) => `${lead}${rootUrl(ref)}`);
    }
    if (kind === 'js') {
      output = output.replace(/(\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["'])\/(?!\/)([^"']+)/g, (m, lead, ref) => `${lead}${rootUrl(ref)}`);
      output = output.replace(/(\bimport\s*\(\s*["'])\/(?!\/)([^"']+)/g, (m, lead, ref) => `${lead}${rootUrl(ref)}`);
    }
    return output;
  }

  function hostedCompatScript(runtimeBase) {
    return `<script data-n7-internal>\n(() => {\n  const base=${JSON.stringify(runtimeBase)};\n  const map=(value)=>{try{const raw=String(value||'');if(raw.startsWith(base))return raw;if(/^\\/(?!\\/)/.test(raw))return base+raw.replace(/^\\/+/, '');}catch{}return value;};\n  const remapNode=(node)=>{if(!(node instanceof Element)||node.hasAttribute('data-n7-internal'))return;['href','src','poster','action','data'].forEach((name)=>{const value=node.getAttribute(name);if(value&&/^\\/(?!\\/)/.test(value))node.setAttribute(name,map(value));});const srcset=node.getAttribute('srcset');if(srcset)node.setAttribute('srcset',srcset.split(',').map((part)=>{const bits=part.trim().split(/\\s+/);if(/^\\/(?!\\/)/.test(bits[0]||''))bits[0]=map(bits[0]);return bits.join(' ');}).join(', '));};\n  const observer=new MutationObserver((records)=>records.forEach((record)=>{if(record.type==='attributes')remapNode(record.target);record.addedNodes?.forEach((node)=>{if(!(node instanceof Element))return;remapNode(node);node.querySelectorAll?.('[href],[src],[poster],[action],[data],[srcset]').forEach(remapNode);});}));\n  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href','src','poster','action','data','srcset']});\n  const nativeFetch=window.fetch?.bind(window);\n  if(nativeFetch)window.fetch=(input,init)=>{try{if(typeof input==='string'||input instanceof URL)return nativeFetch(map(String(input)),init);if(input instanceof Request){if(String(input.url).startsWith(base))return nativeFetch(input,init);const parsed=new URL(input.url);const raw=parsed.pathname+parsed.search+parsed.hash;const mapped=map(raw);if(mapped!==raw)return nativeFetch(new Request(mapped,input),init);}}catch{}return nativeFetch(input,init);};\n  const XHR=window.XMLHttpRequest;if(XHR){const open=XHR.prototype.open;XHR.prototype.open=function(method,url,...rest){return open.call(this,method,map(url),...rest);};}\n  const WorkerCtor=window.Worker;if(WorkerCtor){window.Worker=function(url,options){return new WorkerCtor(map(url),options);};window.Worker.prototype=WorkerCtor.prototype;}\n  const SharedWorkerCtor=window.SharedWorker;if(SharedWorkerCtor){window.SharedWorker=function(url,options){return new SharedWorkerCtor(map(url),options);};window.SharedWorker.prototype=SharedWorkerCtor.prototype;}\n  const push=history.pushState.bind(history),replace=history.replaceState.bind(history);history.pushState=(state,title,url)=>push(state,title,url==null?url:map(url));history.replaceState=(state,title,url)=>replace(state,title,url==null?url:map(url));\n})();\n<\\/script>`;
  }

  function buildHostedHtml(entryPath, renderId, projectId, project = state.project) {
    const record = project?.files.get(entryPath);
    if (!record || typeof record.text !== 'string') return '<!doctype html><html><body></body></html>';
    const runtimeBase = hostedProjectBase(projectId);
    const doc = new DOMParser().parseFromString(record.text, 'text/html');
    const doctype = (record.text.match(/<!doctype[^>]*>/i) || ['<!doctype html>'])[0];

    doc.querySelectorAll('meta[http-equiv]').forEach((meta) => {
      if ((meta.getAttribute('http-equiv') || '').toLowerCase() === 'content-security-policy') meta.remove();
    });

    const rootAttrs = ['href','src','poster','action','data'];
    doc.querySelectorAll('[href],[src],[poster],[action],[data]').forEach((element) => {
      rootAttrs.forEach((attr) => {
        const value = element.getAttribute(attr);
        if (value && /^\/(?!\/)/.test(value)) element.setAttribute(attr, `${runtimeBase}${value.replace(/^\/+/, '')}`);
      });
    });
    doc.querySelectorAll('[srcset]').forEach((element) => {
      const value = element.getAttribute('srcset') || '';
      element.setAttribute('srcset', value.split(',').map((part) => {
        const bits = part.trim().split(/\s+/); if (/^\/(?!\/)/.test(bits[0] || '')) bits[0] = `${runtimeBase}${bits[0].replace(/^\/+/, '')}`; return bits.join(' ');
      }).join(', '));
    });
    doc.querySelectorAll('style').forEach((style) => { style.textContent = rewriteHostedRootRefs(style.textContent || '', runtimeBase, 'css'); });
    doc.querySelectorAll('[style]').forEach((element) => { element.setAttribute('style', rewriteHostedRootRefs(element.getAttribute('style') || '', runtimeBase, 'css')); });
    doc.querySelectorAll('script:not([src])').forEach((script) => {
      const type = (script.getAttribute('type') || '').toLowerCase();
      if (type === 'module') script.textContent = rewriteHostedRootRefs(script.textContent || '', runtimeBase, 'js');
      if (type === 'importmap') {
        try {
          const map = JSON.parse(script.textContent || '{}');
          const rewriteTable = (table) => {
            if (!table || typeof table !== 'object') return;
            Object.keys(table).forEach((key) => {
              const value = table[key];
              if (typeof value === 'string' && /^\/(?!\/)/.test(value)) table[key] = `${runtimeBase}${value.replace(/^\/+/, '')}`;
            });
          };
          rewriteTable(map.imports);
          if (map.scopes && typeof map.scopes === 'object') Object.values(map.scopes).forEach(rewriteTable);
          script.textContent = JSON.stringify(map);
        } catch {}
      }
    });
    doc.querySelectorAll('base[href]').forEach((base) => {
      const href = base.getAttribute('href') || '';
      if (/^\/(?!\/)/.test(href)) base.setAttribute('href', `${runtimeBase}${href.replace(/^\/+/, '')}`);
    });

    if (doc.body) doc.body.innerHTML = annotateHtmlForPreview(doc.body.innerHTML || '');
    const bridgeMarkup = `${previewBridge(renderId, { hosted: true, runtimeBase, projectToken: project?.sessionToken || state.projectToken })}${hostedCompatScript(runtimeBase)}${addonHeadHtml()}`;
    if (doc.head) doc.head.insertAdjacentHTML('afterbegin', bridgeMarkup);
    if (doc.body) doc.body.insertAdjacentHTML('beforeend', '<script data-n7-internal>window.__n7PrepareInspect?.();<\\/script>');

    const htmlAttrs = [...doc.documentElement.attributes].map((a) => `${a.name}="${String(a.value).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`).join(' ');
    const head = doc.head?.innerHTML || '';
    const bodyAttrs = [...(doc.body?.attributes || [])].map((a) => `${a.name}="${String(a.value).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`).join(' ');
    const body = doc.body?.innerHTML || '';
    return `${doctype}\n<html${htmlAttrs ? ' '+htmlAttrs : ''}>\n<head>${head}</head>\n<body${bodyAttrs ? ' '+bodyAttrs : ''}>${body}</body>\n</html>`;
  }

  function hostedRenderProjectId(project, projectToken, renderId) {
    const stable = ensureRuntimeProjectId(project) || createRuntimeProjectId(project);
    const tokenPart = String(projectToken || 'session').replace(/[^a-z0-9-]/gi, '').slice(-14) || 'session';
    return `${stable}-r${renderId.toString(36)}-${tokenPart}`;
  }

  async function syncHostedProject(renderId, project, projectToken) {
    if (!state.hostedRuntime.ready || project?.mode !== 'folder' || !ownsProjectSession(project, projectToken)) return null;

    // Every render is staged into a fresh immutable runtime namespace. We never
    // mutate the runtime currently displayed by the iframe.
    const projectId = hostedRenderProjectId(project, projectToken, renderId);
    const runtimeBase = hostedProjectBase(projectId);
    const cache = await caches.open(HOSTED_RUNTIME_CACHE);
    if (!ownsProjectSession(project, projectToken) || state.renderId !== renderId) return null;

    const stagedUrls = [];
    try {
      for (const record of project.files.values()) {
        if (!ownsProjectSession(project, projectToken) || state.renderId !== renderId) throw new DOMException('Stale render', 'AbortError');
        const url = hostedPathUrl(record.path, projectId);
        let body = null;
        if (record.language === 'html' && typeof record.text === 'string') body = buildHostedHtml(record.path, renderId, projectId, project);
        else if (typeof record.text === 'string') {
          const kind = record.language === 'css' ? 'css' : record.language === 'js' ? 'js' : 'text';
          body = rewriteHostedRootRefs(record.text, runtimeBase, kind);
        } else if (record.file) body = await record.file.arrayBuffer();
        if (!ownsProjectSession(project, projectToken) || state.renderId !== renderId) throw new DOMException('Stale render', 'AbortError');
        if (body === null) body = '';
        await cache.put(url, new Response(body, { status: 200, headers: {
          'Content-Type': runtimeMime(record.path, record),
          'Cache-Control': 'no-store',
          'X-N7-Code-Project': projectId,
          'X-N7-Code-Session': projectToken,
          'X-N7-Code-Render': String(renderId)
        } }));
        stagedUrls.push(url);
      }

      if (!ownsProjectSession(project, projectToken) || state.renderId !== renderId) throw new DOMException('Stale render', 'AbortError');
      const entryPath = project.entryHtmlPath || [...project.files.values()].find((item) => item.language === 'html')?.path;
      if (!entryPath) throw new Error('No HTML entry file');
      const entryUrl = hostedPathUrl(entryPath, projectId);
      const stagedEntry = await cache.match(entryUrl, { ignoreSearch: true });
      if (!stagedEntry) throw new Error('Hosted runtime entry was not staged');
      return { runtimeBase, projectId, entryPath, entryUrl, project, projectToken };
    } catch (error) {
      // A cancelled/failed staged render is disposable and can never become active.
      await Promise.all(stagedUrls.map((url) => cache.delete(url)));
      if (error?.name === 'AbortError') return null;
      throw error;
    }
  }

  async function renderHostedPreview(renderId, project, projectToken) {
    try {
      const previousProjectId = state.hostedRuntime.projectId;
      const synced = await syncHostedProject(renderId, project, projectToken);
      if (!synced || state.renderId !== renderId || !ownsProjectSession(project, projectToken)) return false;
      const { projectId, entryUrl, runtimeBase } = synced;
      const url = `${entryUrl}?mf_render=${renderId}&mf_session=${encodeURIComponent(projectToken)}`;
      if (state.renderId !== renderId || !ownsProjectSession(project, projectToken)) return false;

      // Atomic ownership swap: only a fully staged runtime becomes visible.
      state.hostedRuntime.projectId = projectId;
      state.hostedRuntime.baseUrl = runtimeBase;
      state.hostedRuntime.renderUrl = url;
      preview.dataset.projectSession = projectToken;
      preview.dataset.runtimeProject = projectId;
      delete preview.dataset.runtimeFallback;
      preview.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads allow-pointer-lock');
      preview.removeAttribute('srcdoc');
      preview.src = url;
      if (isDetachedPreviewOpen()) {
        try { state.detachedWindow.opener = null; state.detachedWindow.location.replace(url); } catch {}
      }

      // Keep the previous runtime alive briefly so the old document can finish
      // unloading; then retire it. Never retire the runtime we just activated.
      if (previousProjectId && previousProjectId !== projectId) {
        window.setTimeout(() => {
          if (state.hostedRuntime.projectId !== previousProjectId) void retireHostedProject(previousProjectId);
        }, 1800);
      }
      return true;
    } catch (error) {
      console.error('N7-Code FULL PROJECT render failed; falling back to compatibility preview.', error);
      if (state.renderId === renderId && ownsProjectSession(project, projectToken)) {
        state.hostedRuntime.ready = Boolean(navigator.serviceWorker?.controller && state.hostedRuntime.registration);
      }
      return false;
    }
  }


  function writeDetachedPreview() {
    if (!isDetachedPreviewOpen()) return;
    if (state.project?.mode === 'folder' && state.hostedRuntime.ready && state.hostedRuntime.renderUrl) {
      try { state.detachedWindow.opener = null; state.detachedWindow.location.replace(state.hostedRuntime.renderUrl); } catch { returnPreviewToEditor({ closeWindow: false }); }
      return;
    }
    try {
      const doc = state.detachedWindow.document;
      doc.open();
      doc.write(buildPreviewDocument(state.renderId));
      doc.close();
      state.detachedWindow.document.title = `${state.project?.name || 'N7-Code'} · Preview`;
    } catch { returnPreviewToEditor({ closeWindow: false }); }
  }

  function renderPreview() {
    state.libraryFailures.clear();
    state.renderId += 1;
    state.previewReady = false;
    state.recoveryActive = false;
    closeRecoveryMenu();
    recoverPreviewButton.hidden = true;
    setLiveState('UPDATING');
    const expectedRender = state.renderId;
    const renderProject = state.project;
    const renderProjectToken = state.projectToken || renderProject?.sessionToken || '';

    if (renderProject?.mode === 'folder' && state.hostedRuntime.ready) {
      void renderHostedPreview(expectedRender, renderProject, renderProjectToken).then((usedHosted) => {
        if (!usedHosted && state.renderId === expectedRender && ownsProjectSession(renderProject, renderProjectToken)) {
          preview.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-pointer-lock');
          preview.removeAttribute('src');
          preview.srcdoc = buildPreviewDocument(expectedRender);
          preview.dataset.runtimeFallback = 'true';
          setLiveState('LOCAL COMPAT · FALLBACK');
          writeDetachedPreview();
        }
      });
    } else {
      preview.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-pointer-lock');
      preview.removeAttribute('src');
      delete preview.dataset.runtimeFallback;
      preview.srcdoc = buildPreviewDocument(expectedRender);
      writeDetachedPreview();
    }

    window.setTimeout(() => {
      if (state.renderId !== expectedRender || state.previewReady || liveState.classList.contains('is-error')) return;
      state.previewReady = Boolean(preview.contentWindow);
      setLiveState(state.previewReady ? 'LIVE' : 'PREVIEW WAITING');
    }, 1800);
  }

  function injectPreviewCss() {
    if (!state.previewReady || !preview.contentWindow) {
      renderPreview();
      return;
    }
    state.cssUpdateId += 1;
    setLiveState('UPDATING');
    postToPreviewSurfaces({
      source: 'n7-editor',
      type: 'css-update',
      css: state.code.css,
      renderId: state.renderId,
      cssUpdateId: state.cssUpdateId
    });
  }


  function applyView(view, animate = true) {
    state.view = view;
    const activeTab = tabs.find((tab) => tab.dataset.view === view);
    tabs.forEach((tab) => tab.classList.toggle('is-active', tab === activeTab));
    updateIndicator(activeTab);
    updateFileTreeActive();

    const show = () => {
      if (view === 'all') {
        populateAllEditors();
        singleEditor.hidden = true;
        allEditors.hidden = false;
        footerLanguage.textContent = 'ALL';
      } else {
        allEditors.hidden = true;
        singleEditor.hidden = false;
        setSingleEditor(view);
      }
      requestAnimationFrame(() => singleEditor.classList.remove('is-leaving'));
      updateDiagnosticHint();
    };

    if (!animate) { show(); return; }
    singleEditor.classList.add('is-leaving');
    window.setTimeout(show, 220);
  }
