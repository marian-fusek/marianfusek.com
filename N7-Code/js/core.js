'use strict';


  const PREVIEW_DELAY = 200;
  const SAVE_DELAY = 280;
  const HISTORY_LIMIT = 80;
  const HISTORY_COALESCE_MS = 650;
  const HISTORY_STORAGE_BUDGET = 1500000;
  const INDENT = '  ';
  const PROJECT_FORMAT = 'n7-code-project';
  const LEGACY_PROJECT_FORMAT = 'mf-code-project';
  const PROJECT_VERSION = 1;
  const LARGE_FILE_LINE_THRESHOLD = 5000;
  const LARGE_FILE_CHAR_THRESHOLD = 240000;
  const LARGE_FILE_OVERSCAN = 48;
  const STORAGE = Object.freeze({
    draft: 'n7-code-draft-v1',
    prefs: 'n7-code-prefs-v1',
    history: 'n7-code-history-v1',
    tree: 'n7-code-tree-v1',
    addons: 'n7-code-addons-v1',
    recovery: 'n7-code-recovery-v1'
  });
  const LEGACY_STORAGE = Object.freeze({
    draft: 'mf-code-draft-v1',
    prefs: 'mf-code-prefs-v1',
    history: 'mf-code-history-v1',
    tree: 'mf-code-tree-v1',
    addons: 'mf-code-addons-v1'
  });
  const LANGUAGE_MAP = { html: 'markup', css: 'css', js: 'javascript' };
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  const CLOSERS = new Set(Object.values(PAIRS));
  const STARTER_CODE = Object.freeze({
    html: '<h1>Hello.</h1>\n<p>Start making something.</p>',
    css: 'body {\n  font-family: sans-serif;\n}',
    js: 'console.log("Hello.");'
  });

  const CURATED_LIBRARIES = Object.freeze([
    { id: 'react', name: 'REACT', meta: '18 · GLOBAL', scripts: [
      'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
      'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js'
    ], detect: /(?:react(?:-dom)?(?:\.production)?(?:\.min)?\.js|from\s+[\"']react(?:-dom)?[\"'])/i },
    { id: 'vue', name: 'VUE', meta: '3 · GLOBAL', scripts: ['https://cdn.jsdelivr.net/npm/vue@3.5.41/dist/vue.global.prod.js'], detect: /(?:vue(?:\.global|\.esm-browser)?(?:\.prod)?\.js|from\s+[\"']vue[\"'])/i },
    { id: 'gsap', name: 'GSAP', meta: '3.15', scripts: ['https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js'], detect: /(?:\/gsap(?:@|\/)|gsap(?:\.min)?\.js|from\s+[\"']gsap[\"'])/i },
    { id: 'three', name: 'THREE.JS', meta: '0.185', module: 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js', global: 'THREE', detect: /(?:three(?:\.module)?(?:\.min)?\.js|from\s+[\"']three[\"'])/i },
    { id: 'alpine', name: 'ALPINE', meta: '3.15', scripts: ['https://cdn.jsdelivr.net/npm/alpinejs@3.15.12/dist/cdn.min.js'], detect: /(?:alpinejs|@alpinejs)/i },
    { id: 'tailwind', name: 'TAILWIND', meta: 'BROWSER · 4', scripts: ['https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'], detect: /(?:@tailwindcss\/browser|cdn\.tailwindcss\.com)/i }
  ]);
  const CURATED_FONTS = Object.freeze([
    'Inter','Manrope','Space Grotesk','DM Sans','IBM Plex Sans','Roboto','Roboto Mono','Source Sans 3','Source Code Pro','Work Sans','Outfit','Plus Jakarta Sans','Figtree','Archivo','Playfair Display','Libre Baskerville'
  ]);

  const app = document.querySelector('.app');
  const workspace = document.querySelector('.workspace');
  const editorPane = document.querySelector('.editor-pane');
  const divider = document.querySelector('.workspace-divider');
  const tabs = [...document.querySelectorAll('.view-tab')];
  const indicator = document.querySelector('.tab-indicator');
  const singleEditor = document.querySelector('[data-single-editor]');
  const allEditors = document.querySelector('[data-all-editors]');
  const allSections = [...document.querySelectorAll('.code-section')];
  const footerLanguage = document.querySelector('.footer-language');
  const themeToggle = document.querySelector('.theme-toggle');
  const fontButtons = [...document.querySelectorAll('.font-button')];
  const preview = document.querySelector('[data-preview]');
  const previewPane = document.querySelector('.preview-pane');
  const previewSizeButtons = [...document.querySelectorAll('[data-preview-size]')];
  const previewActionButtons = [...document.querySelectorAll('[data-preview-action]')];
  const refreshPreviewButton = document.querySelector('[data-preview-action="refresh"]');
  const focusPreviewButton = document.querySelector('[data-preview-action="focus"]');
  const detachPreviewButton = document.querySelector('[data-preview-action="detach"]');
  const detachedPreviewPlaceholder = document.querySelector('[data-detached-preview-placeholder]');
  const recoverPreviewButton = document.querySelector('[data-preview-action="recover"]');
  const previewRecoveryMenu = document.querySelector('[data-preview-recovery-menu]');
  const recoveryActions = [...document.querySelectorAll('[data-recovery-action]')];
  const liveState = document.querySelector('.live-state');
  const projectButton = document.querySelector('.project-button');
  const exportButton = document.querySelector('.export-button');
  const projectMenu = document.querySelector('.project-menu');
  const projectInput = document.querySelector('.project-file-input');
  const projectActions = [...document.querySelectorAll('[data-project-action]')];
  const resetAction = document.querySelector('[data-project-action="reset"]');
  const recoverPreviousAction = document.querySelector('[data-project-action="recover-previous"]');
  const toolsButton = document.querySelector('.tools-button');
  const toolsMenu = document.querySelector('.tools-menu');
  const toolsActions = [...document.querySelectorAll('[data-tools-action]')];
  const formatButton = document.querySelector('[data-tools-action="format"]');
  const libraryOverlay = document.querySelector('[data-library-overlay]');
  const libraryClose = document.querySelector('.library-close');
  const libraryList = document.querySelector('[data-library-list]');
  const fontLibraryList = document.querySelector('[data-font-library-list]');
  const fontLibrarySearch = document.querySelector('.font-library-search');
  const filesButton = document.querySelector('.files-button');
  const fileTree = document.querySelector('[data-file-tree]');
  const fileTreeItems = [...document.querySelectorAll('[data-file-language]')];
  const fileTreeList = document.querySelector('[data-file-tree-list]');
  const fileTreeTitle = fileTree.querySelector('.file-tree-title');
  const fileTreeFooter = fileTree.querySelector('.file-tree-footer');
  const fileTreeResizer = fileTree.querySelector('.file-tree-resizer');
  const projectFolderInput = document.querySelector('.project-folder-input');
  const projectSwitchOverlay = document.querySelector('[data-project-switch]');
  const projectSwitchTitle = document.getElementById('project-switch-title');
  const projectSwitchCopy = projectSwitchOverlay.querySelector('.project-switch-copy');
  const projectSwitchActions = [...projectSwitchOverlay.querySelectorAll('[data-project-switch-action]')];
  const findBar = document.querySelector('[data-find-bar]');
  const findInput = document.querySelector('.find-input');
  const replaceInput = document.querySelector('.replace-input');
  const replaceActions = [...document.querySelectorAll('[data-replace-action]')];
  const findReplaceToggle = document.querySelector('[data-find-action="replace-mode"]');
  const findCount = document.querySelector('.find-count');
  const findActions = [...document.querySelectorAll('[data-find-action]')];
  const commandPalette = document.querySelector('[data-command-palette]');
  const commandInput = document.querySelector('.command-input');
  const commandList = document.querySelector('.command-list');
  const autocomplete = document.querySelector('[data-autocomplete]');
  const footerHint = document.querySelector('.footer-hint');
  const helpButton = document.querySelector('.help-button');
  const helpOverlay = document.querySelector('[data-help-overlay]');
  const helpClose = document.querySelector('.help-close');
  const helpStateFields = new Map([...document.querySelectorAll('[data-help-state]')].map((node) => [node.dataset.helpState, node]));
  const switchToast = document.createElement('div');
  switchToast.className = 'project-switch-toast';
  switchToast.hidden = true;
  switchToast.setAttribute('role', 'status');
  switchToast.setAttribute('aria-live', 'polite');
  app.appendChild(switchToast);

  const state = {
    view: 'html',
    theme: 'light',
    font: 'geist',
    previewSize: 'desktop',
    previewFocus: false,
    filesOpen: false,
    filesWidth: 214,
    previewTimer: null,
    draftTimer: null,
    historyTimer: null,
    renderId: 0,
    previewReady: false,
    cssUpdateId: 0,
    menuTimer: null,
    resetTimer: null,
    code: { ...STARTER_CODE },
    errorLine: { html: null, css: null, js: null },
    diagnostics: { html: [], css: [], js: [] },
    matchRanges: { html: [], css: [], js: [] },
    history: { past: [], future: [], lastAt: 0, lastLanguage: null },
    autocomplete: { open: false, items: [], index: 0, input: null, language: null, container: null },
    project: null,
    pendingProjectSwitch: null,
    collapsedFolders: new Set(),
    treeStates: {},
    detachedWindow: null,
    detachedWatchTimer: null,
    recoveryActive: false,
    libraries: new Set(),
    fonts: new Set(),
    addonStates: {},
    libraryFailures: new Set(),
    projectSession: 0,
    projectToken: '',
    hostedRuntime: { supported: false, ready: false, registration: null, scope: '', projectId: null, baseUrl: '', renderUrl: '', projectSerial: 0 }
  };

  if (window.Prism) app.classList.add('has-highlighting');

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const PLATFORM_NAME = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '');
  const IS_MAC = /Mac|iPhone|iPad|iPod/i.test(PLATFORM_NAME);
  const SHORTCUTS = Object.freeze({
    palette: IS_MAC ? '⌘ K' : 'CTRL K',
    undo: IS_MAC ? '⌘ Z' : 'CTRL Z',
    redo: IS_MAC ? '⇧ ⌘ Z' : 'CTRL ⇧ Z',
    find: IS_MAC ? '⌘ F' : 'CTRL F',
    replace: IS_MAC ? '⌥ ⌘ F' : 'CTRL H',
    comment: IS_MAC ? '⌘ /' : 'CTRL /',
    duplicate: IS_MAC ? '⌘ D' : 'CTRL D',
    move: IS_MAC ? '⌥ ↑ / ↓' : 'ALT ↑ / ↓',
    format: IS_MAC ? '⌥ ⇧ F' : 'ALT ⇧ F'
  });
  const commandShortcut = (key) => (SHORTCUTS[key] || '').replace(/ /g, '');
  const primaryModifier = (event) => IS_MAC ? event.metaKey : event.ctrlKey;

  function applyPlatformShortcuts() {
    document.querySelectorAll('[data-shortcut]').forEach((node) => {
      const value = SHORTCUTS[node.dataset.shortcut];
      if (value) node.textContent = value;
    });
    document.querySelectorAll('[data-shortcut-text]').forEach((node) => {
      const value = SHORTCUTS[node.dataset.shortcutText];
      if (value) node.textContent = value;
    });
  }

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* storage can be blocked on some local-file contexts */ }
  }

  function safeJsonParse(value) {
    try { return JSON.parse(value); } catch { return null; }
  }

  function migrateLegacyStorage() {
    Object.entries(LEGACY_STORAGE).forEach(([name, legacyKey]) => {
      if (safeStorageGet(STORAGE[name]) != null) return;
      const value = safeStorageGet(legacyKey);
      if (value != null) safeStorageSet(STORAGE[name], value);
    });
  }

  function isProjectFormat(format) {
    return format === PROJECT_FORMAT || format === LEGACY_PROJECT_FORMAT;
  }

  function saveRecoverySnapshot() {
    try {
      window.localStorage.setItem(STORAGE.recovery, JSON.stringify({ savedAt: Date.now(), payload: createProjectPayload() }));
      return true;
    } catch {
      return false;
    }
  }

  function recoverySnapshot() {
    const stored = safeJsonParse(safeStorageGet(STORAGE.recovery));
    return stored?.payload && isProjectFormat(stored.payload.format) ? stored : null;
  }

  function projectTreeKey(project = state.project) {
    if (!project || project.mode !== 'folder') return null;
    const signature = `${project.name}|${[...project.files.keys()].sort().join('|')}`;
    let hash = 5381;
    for (let i = 0; i < signature.length; i += 1) hash = ((hash << 5) + hash) ^ signature.charCodeAt(i);
    return `p${(hash >>> 0).toString(36)}`;
  }

  function createRuntimeProjectId(project) {
    const tree = projectTreeKey(project) || 'project';
    state.hostedRuntime.projectSerial += 1;
    const entropy = (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9-]/gi, '').slice(0, 20);
    return `${tree}-${state.hostedRuntime.projectSerial.toString(36)}-${entropy}`;
  }

  function ensureRuntimeProjectId(project = state.project) {
    if (!project || project.mode !== 'folder') return null;
    if (!project.runtimeId) project.runtimeId = createRuntimeProjectId(project);
    return project.runtimeId;
  }

  function makeProjectToken(project) {
    state.projectSession += 1;
    const entropy = (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9-]/gi, '').slice(0, 18);
    return `s${state.projectSession.toString(36)}-${entropy}`;
  }

  async function retireHostedProject(projectId) {
    if (!projectId || !('caches' in window)) return;
    try {
      const cache = await caches.open(HOSTED_RUNTIME_CACHE);
      const prefix = hostedProjectBase(projectId);
      const keys = await cache.keys();
      await Promise.all(keys.filter((request) => request.url.startsWith(prefix)).map((request) => cache.delete(request)));
    } catch {}
  }

  function beginProjectSession(project = state.project, { clearPreview = true } = {}) {
    const previousProjectId = state.hostedRuntime.projectId;
    const token = makeProjectToken(project);
    state.projectToken = token;
    if (project) {
      project.sessionToken = token;
      if (project.mode === 'folder') project.runtimeId = createRuntimeProjectId(project);
    }
    state.hostedRuntime.projectId = null;
    state.hostedRuntime.baseUrl = '';
    state.hostedRuntime.renderUrl = '';
    state.previewReady = false;
    if (clearPreview) {
      try { preview.removeAttribute('srcdoc'); preview.src = 'about:blank'; } catch {}
    }
    if (previousProjectId) void retireHostedProject(previousProjectId);
    return token;
  }

  function ownsProjectSession(project, token) {
    return Boolean(project && state.project === project && state.projectToken === token && project.sessionToken === token);
  }

  function persistTreeState() {
    const key = projectTreeKey();
    if (!key) return;
    state.treeStates[key] = [...state.collapsedFolders];
    const entries = Object.entries(state.treeStates).slice(-12);
    state.treeStates = Object.fromEntries(entries);
    safeStorageSet(STORAGE.tree, JSON.stringify(state.treeStates));
  }

  function defaultCollapsedFolders(files) {
    return new Set(
      [...files.keys()].flatMap((path) => {
        const parts = path.split('/');
        return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
      })
    );
  }

  function restoreTreeStateForProject(project = state.project, fallback = null) {
    const key = projectTreeKey(project);
    const saved = key ? state.treeStates[key] : null;
    if (Array.isArray(saved)) return new Set(saved);
    if (Array.isArray(fallback)) return new Set(fallback);
    return project?.mode === 'folder' ? defaultCollapsedFolders(project.files) : new Set();
  }

  function addonProjectKey(project = state.project) {
    if (!project || project.mode === 'simple') return 'simple';
    return projectTreeKey(project) || `folder:${project.name || 'project'}`;
  }

  function addonSnapshot() {
    return { libraries: [...state.libraries], fonts: [...state.fonts] };
  }

  function applyAddonSnapshot(snapshot = null) {
    const validLibraryIds = new Set(CURATED_LIBRARIES.map((item) => item.id));
    state.libraries = new Set(Array.isArray(snapshot?.libraries) ? snapshot.libraries.filter((id) => validLibraryIds.has(id)) : []);
    state.fonts = new Set(Array.isArray(snapshot?.fonts) ? snapshot.fonts.filter((name) => CURATED_FONTS.includes(name)) : []);
    state.libraryFailures.clear();
  }

  function persistAddons() {
    const key = addonProjectKey();
    state.addonStates[key] = addonSnapshot();
    const entries = Object.entries(state.addonStates).slice(-20);
    state.addonStates = Object.fromEntries(entries);
    safeStorageSet(STORAGE.addons, JSON.stringify(state.addonStates));
    persistDraftSoon();
  }

  function restoreAddonsForProject(fallback = null) {
    const key = addonProjectKey();
    applyAddonSnapshot(fallback || state.addonStates[key] || null);
  }

  function validCode(value) {
    return value && ['html', 'css', 'js'].every((language) => typeof value[language] === 'string');
  }


  function codeSnapshot() {
    return { ...state.code };
  }

  function sameCode(a, b) {
    return a && b && a.html === b.html && a.css === b.css && a.js === b.js;
  }

  function boundedHistoryPayload() {
    const payload = { past: state.history.past.slice(-HISTORY_LIMIT), future: state.history.future.slice(-HISTORY_LIMIT) };
    while (JSON.stringify(payload).length > HISTORY_STORAGE_BUDGET && (payload.past.length > 1 || payload.future.length > 0)) {
      if (payload.past.length > 1) payload.past.shift();
      else payload.future.shift();
    }
    state.history.past = payload.past;
    state.history.future = payload.future;
    return payload;
  }

  function persistHistorySoon() {
    window.clearTimeout(state.historyTimer);
    state.historyTimer = window.setTimeout(() => {
      safeStorageSet(STORAGE.history, JSON.stringify(boundedHistoryPayload()));
    }, SAVE_DELAY);
  }

  function persistHistoryNow() {
    window.clearTimeout(state.historyTimer);
    safeStorageSet(STORAGE.history, JSON.stringify(boundedHistoryPayload()));
  }

  function recordHistory(language, coalesce = false) {
    const now = Date.now();
    const canCoalesce = coalesce
      && state.history.past.length
      && state.history.lastLanguage === language
      && now - state.history.lastAt < HISTORY_COALESCE_MS;

    if (!canCoalesce) {
      const snapshot = codeSnapshot();
      if (!sameCode(state.history.past.at(-1), snapshot)) state.history.past.push(snapshot);
      if (state.history.past.length > HISTORY_LIMIT) state.history.past.shift();
    }

    state.history.future = [];
    state.history.lastAt = now;
    state.history.lastLanguage = language;
    persistHistorySoon();
  }

  function breakHistoryCoalescing() {
    state.history.lastAt = 0;
    state.history.lastLanguage = null;
  }


  function undoHistory() {
    const target = state.history.past.pop();
    if (!target) return false;
    const current = codeSnapshot();
    if (!sameCode(state.history.future.at(-1), current)) state.history.future.push(current);
    if (state.history.future.length > HISTORY_LIMIT) state.history.future.shift();
    breakHistoryCoalescing();
    applyHistorySnapshot(target);
    persistHistoryNow();
    return true;
  }

  function redoHistory() {
    const target = state.history.future.pop();
    if (!target) return false;
    const current = codeSnapshot();
    if (!sameCode(state.history.past.at(-1), current)) state.history.past.push(current);
    if (state.history.past.length > HISTORY_LIMIT) state.history.past.shift();
    breakHistoryCoalescing();
    applyHistorySnapshot(target);
    persistHistoryNow();
    return true;
  }



  function persistPrefs() {
    safeStorageSet(STORAGE.prefs, JSON.stringify({
      view: state.view,
      theme: state.theme,
      font: state.font,
      previewSize: state.previewSize,
      editorWidth: Math.round(editorPane.getBoundingClientRect().width),
      filesOpen: state.filesOpen,
      filesWidth: Math.round(state.filesWidth)
    }));
  }

  function getEditorParts(container) {
    return {
      input: container.querySelector('.code-input'),
      numbers: container.querySelector('.line-numbers'),
      highlight: container.querySelector('.code-highlight'),
      code: container.querySelector('.code-highlight code')
    };
  }

  function diagnosticsAtLine(language, line) {
    return state.diagnostics[language].filter((item) => item.line === line);
  }

  function lineNumberMarkup(line, language, firstStyle = '') {
    const items = diagnosticsAtLine(language, line);
    const hasError = state.errorLine[language] === line || items.some((item) => item.severity === 'error');
    const hasWarning = !hasError && items.some((item) => item.severity === 'warning');
    const kind = hasError ? ' is-error' : (hasWarning ? ' is-warning' : '');
    const title = items[0]?.message ? ` title="${escapeHtml(items[0].message).replace(/&quot;/g, '&amp;quot;')}"` : '';
    const style = firstStyle ? ` style="${firstStyle}"` : '';
    return `<span class="line-no${kind}"${title}${style}>${line}</span>`;
  }

  function lineNumbersFor(value, language) {
    const count = Math.max(1, value.split('\n').length);
    return Array.from({ length: count }, (_, index) => lineNumberMarkup(index + 1, language)).join('');
  }

  function escapeHtml(value) {
    return value.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character]));
  }

  function applyMatchRangesToHighlightedHtml(html, ranges) {
    if (!ranges?.length) return html;

    const host = document.createElement('div');
    host.innerHTML = html;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let offset = 0;
    let node;

    while ((node = walker.nextNode())) {
      const start = offset;
      offset += node.nodeValue.length;
      textNodes.push({ node, start, end: offset });
    }

    [...ranges]
      .filter((range) => Number.isFinite(range?.start) && Number.isFinite(range?.end) && range.end > range.start)
      .sort((a, b) => b.start - a.start)
      .forEach((range) => {
        const affected = textNodes
          .filter((entry) => entry.end > range.start && entry.start < range.end)
          .sort((a, b) => b.start - a.start);

        affected.forEach((entry) => {
          if (!entry.node.isConnected) return;
          const localStart = Math.max(0, range.start - entry.start);
          const localEnd = Math.min(entry.node.nodeValue.length, range.end - entry.start);
          if (localEnd <= localStart) return;

          const selected = entry.node.splitText(localStart);
          selected.splitText(localEnd - localStart);
          const marker = document.createElement('span');
          marker.className = 'match-token';
          selected.parentNode.insertBefore(marker, selected);
          marker.appendChild(selected);
        });
      });

    return host.innerHTML;
  }

  function highlightCode(value, language, ranges = state.matchRanges[language]) {
    const prismLanguage = LANGUAGE_MAP[language];
    const grammar = window.Prism?.languages?.[prismLanguage];
    const html = grammar ? window.Prism.highlight(value, grammar, prismLanguage) : escapeHtml(value);
    return applyMatchRangesToHighlightedHtml(html, ranges);
  }

  function isLargeFileValue(value) {
    if (String(value || '').length >= LARGE_FILE_CHAR_THRESHOLD) return true;
    let lines = 1;
    const source = String(value || '');
    for (let i = 0; i < source.length && lines < LARGE_FILE_LINE_THRESHOLD; i += 1) if (source.charCodeAt(i) === 10) lines += 1;
    return lines >= LARGE_FILE_LINE_THRESHOLD;
  }

  function buildLargeFileCache(input) {
    const source = input.value;
    const lines = source.split('\n');
    const starts = new Array(lines.length);
    let offset = 0;
    for (let i = 0; i < lines.length; i += 1) {
      starts[i] = offset;
      offset += lines[i].length + 1;
    }
    input.__n7LargeCache = { source, lines, starts };
    return input.__n7LargeCache;
  }

  function largeFileCache(input) {
    return input.__n7LargeCache?.source === input.value ? input.__n7LargeCache : buildLargeFileCache(input);
  }

  function renderLargeViewport(parts, language) {
    const cache = largeFileCache(parts.input);
    const lineHeight = Number.parseFloat(getComputedStyle(parts.input).lineHeight) || 22.75;
    const visible = Math.max(1, Math.ceil(parts.input.clientHeight / lineHeight));
    const firstVisible = Math.max(0, Math.floor(parts.input.scrollTop / lineHeight));
    const start = Math.max(0, firstVisible - LARGE_FILE_OVERSCAN);
    const end = Math.min(cache.lines.length, firstVisible + visible + LARGE_FILE_OVERSCAN);
    const slice = cache.lines.slice(start, end).join('\n');
    const sourceOffset = cache.starts[start] || 0;
    const sliceRanges = (state.matchRanges[language] || []).map((range) => ({ start: range.start - sourceOffset, end: range.end - sourceOffset })).filter((range) => range.end > 0 && range.start < slice.length).map((range) => ({ start: Math.max(0, range.start), end: Math.min(slice.length, range.end) }));
    const y = start * lineHeight - parts.input.scrollTop;

    parts.code.innerHTML = `${highlightCode(slice, language, sliceRanges)}\n`;
    parts.code.style.transform = `translate(${-parts.input.scrollLeft}px, ${y}px)`;

    const numberRows = [];
    for (let index = start; index < end; index += 1) numberRows.push(lineNumberMarkup(index + 1, language));
    parts.numbers.innerHTML = `<div class="virtual-line-numbers" style="transform:translateY(${y}px)">${numberRows.join('')}</div>`;
    parts.numbers.scrollTop = 0;
    parts.highlight.scrollTop = 0;
    parts.highlight.scrollLeft = 0;
  }

  function scheduleLargeViewport(parts, language) {
    if (parts.input.__n7ScrollFrame) return;
    parts.input.__n7ScrollFrame = requestAnimationFrame(() => {
      parts.input.__n7ScrollFrame = 0;
      renderLargeViewport(parts, language || parts.input.dataset.language);
    });
  }

  function syncScroll(parts, language = parts.input.dataset.language) {
    if (parts.input.dataset.largeFile === 'true') {
      scheduleLargeViewport(parts, language);
      return;
    }
    parts.numbers.scrollTop = parts.input.scrollTop;
    parts.highlight.scrollTop = parts.input.scrollTop;
    parts.highlight.scrollLeft = parts.input.scrollLeft;
  }

  function syncEditor(container, language) {
    const parts = getEditorParts(container);
    const large = isLargeFileValue(parts.input.value);
    parts.input.dataset.largeFile = String(large);
    container.classList.toggle('is-large-file', large);
    if (large) {
      largeFileCache(parts.input);
      renderLargeViewport(parts, language);
      return;
    }
    parts.input.__n7LargeCache = null;
    parts.code.style.transform = '';
    parts.numbers.innerHTML = lineNumbersFor(parts.input.value, language);
    parts.code.innerHTML = `${highlightCode(parts.input.value, language)}\n`;
    syncScroll(parts, language);
  }

  function setEditorValue(container, language, value) {
    const parts = getEditorParts(container);
    parts.input.value = value;
    parts.input.dataset.language = language;
    parts.input.setAttribute('aria-label', `${language.toUpperCase()} code`);
    syncEditor(container, language);
  }


  function populateAllEditors() {
    allSections.forEach((section) => {
      const language = section.dataset.language;
      setEditorValue(section, language, state.code[language]);
    });
  }

  function refreshVisibleEditors() {
    if (state.view === 'all') populateAllEditors();
    else setSingleEditor(state.view);
  }

  function updateIndicator(activeTab) {
    const navRect = activeTab.parentElement.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const width = Math.min(28, Math.max(22, tabRect.width - 28));
    const left = tabRect.left - navRect.left + (tabRect.width - width) / 2;
    indicator.style.width = `${width}px`;
    indicator.style.transform = `translateX(${left - 14}px)`;
  }

  function setLiveState(label, isError = false) {
    liveState.lastChild.textContent = ` ${label}`;
    liveState.classList.toggle('is-error', isError);
  }


  function lineAtOffset(source, offset) {
    return source.slice(0, clamp(offset, 0, source.length)).split('\n').length;
  }

  function pushDiagnostic(language, severity, line, message) {
    const normalizedLine = Math.max(1, Number(line) || 1);
    if (state.diagnostics[language].some((item) => item.line === normalizedLine && item.message === message)) return;
    state.diagnostics[language].push({ severity, line: normalizedLine, message });
  }

  function validateHtml(source) {
    const diagnostics = [];
    const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const stack = [];
    const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([A-Za-z][\w:-]*)\b[^>]*>/g;
    let match;
    while ((match = tagPattern.exec(source))) {
      const token = match[0];
      const tag = match[1]?.toLowerCase();
      if (!tag || token.startsWith('<!')) continue;
      if (token.startsWith('</')) {
        const top = stack.at(-1);
        if (!top) diagnostics.push({ severity: 'warning', line: lineAtOffset(source, match.index), message: `Closing </${tag}> has no matching opening tag.` });
        else if (top.tag !== tag) diagnostics.push({ severity: 'warning', line: lineAtOffset(source, match.index), message: `Expected </${top.tag}> before </${tag}>.` });
        else stack.pop();
      } else if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) {
        stack.push({ tag, offset: match.index });
      }
    }
    stack.slice(-8).forEach((entry) => diagnostics.push({ severity: 'warning', line: lineAtOffset(source, entry.offset), message: `<${entry.tag}> is not closed.` }));
    return diagnostics;
  }

  function validateCss(source) {
    const diagnostics = [];
    let depth = 0;
    let quote = null;
    let comment = false;
    for (let i = 0; i < source.length; i += 1) {
      const c = source[i], n = source[i + 1];
      if (comment) { if (c === '*' && n === '/') { comment = false; i += 1; } continue; }
      if (!quote && c === '/' && n === '*') { comment = true; i += 1; continue; }
      if (quote) { if (c === quote && source[i - 1] !== '\\') quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '{') depth += 1;
      if (c === '}') { depth -= 1; if (depth < 0) { diagnostics.push({ severity: 'error', line: lineAtOffset(source, i), message: 'Unexpected closing brace.' }); depth = 0; } }
    }
    if (depth > 0) diagnostics.push({ severity: 'error', line: source.split('\n').length, message: `${depth} CSS block${depth === 1 ? '' : 's'} not closed.` });

    source.split('\n').forEach((raw, index) => {
      const line = raw.replace(/\/\*.*?\*\//g, '').trim();
      if (!line || line.startsWith('@') || line.endsWith('{') || line === '}' || line.endsWith('}') || line.includes('{')) return;
      if (line.endsWith(';') && !line.includes(':')) diagnostics.push({ severity: 'warning', line: index + 1, message: 'CSS declaration may be missing a colon.' });
    });
    return diagnostics;
  }

  function validateJs(source) {
    const diagnostics = [];
    try { new Function(source); }
    catch (error) {
      let line = null;
      const stack = String(error?.stack || '');
      const stackMatch = stack.match(/<anonymous>:(\d+):(\d+)/);
      if (stackMatch) line = Math.max(1, Number(stackMatch[1]) - 2);
      diagnostics.push({ severity: 'error', line: line || 1, message: error?.message || 'JavaScript syntax error.' });
    }
    return diagnostics;
  }

  function updateDiagnostics(language = null) {
    const languages = language ? [language] : ['html', 'css', 'js'];
    languages.forEach((lang) => {
      state.diagnostics[lang] = lang === 'html' ? validateHtml(state.code.html) : (lang === 'css' ? validateCss(state.code.css) : validateJs(state.code.js));
    });
    updateDiagnosticHint();
  }

  function activeDiagnosticLanguage() {
    if (state.view !== 'all') return state.view;
    const focused = document.activeElement?.dataset?.language;
    return ['html', 'css', 'js'].includes(focused) ? focused : 'html';
  }

  function updateDiagnosticHint() {
    const language = activeDiagnosticLanguage();
    const items = state.diagnostics[language] || [];
    if (!items.length) { footerHint.textContent = ''; footerHint.removeAttribute('title'); return; }
    const first = items[0];
    const count = items.length;
    footerHint.textContent = `L${first.line} · ${first.message}${count > 1 ? `  +${count - 1}` : ''}`;
    footerHint.title = items.map((item) => `L${item.line} · ${item.message}`).join('\n');
  }
