(() => {
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
  const STORAGE = {
    draft: 'mf-code-draft-v1',
    prefs: 'mf-code-prefs-v1',
    history: 'mf-code-history-v1',
    tree: 'mf-code-tree-v1',
    addons: 'mf-code-addons-v1',
    recovery: 'n7-code-recovery-v1'
  };
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
      const annotated = `${token.slice(0, closeIndex)} data-mf-source-start="${sourceStart}"${token.slice(closeIndex)}`;
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
      source: 'mf-editor',
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
  const send = (type, message = '', line = null, extra = {}) => host.postMessage({ source: 'mf-preview', type, message, line, renderId: ${renderId}, projectToken, ...extra }, '*');
  window.__mfLibPromises = window.__mfLibPromises || [];
  window.__mfLibraryError = (name) => send('library-error', String(name || 'library'));
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
    overlay.setAttribute('data-mf-highlight-overlay', '');
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

  window.__mfPrepareInspect = () => {
    document.querySelectorAll('[data-mf-source-start]').forEach((element) => {
      const sourceStart = Number(element.getAttribute('data-mf-source-start'));
      if (Number.isFinite(sourceStart)) { inspectMap.set(element, sourceStart); sourceMap.set(sourceStart, element); }
      element.removeAttribute('data-mf-source-start');
    });
  };
  const dismissBlockingOverlay = () => {
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const candidates = [...document.querySelectorAll('body *')].filter((element) => {
      if (!(element instanceof HTMLElement) || element.hasAttribute('data-mf-highlight-overlay')) return false;
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
  window.__mfRun = (code) => { try { (0, eval)(code + '\\n//# sourceURL=mf-user.js'); } catch (error) { send('error', error.message || 'JavaScript error', lineFrom(error)); } };
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      const element = event.target;
      const ref = element?.getAttribute?.('data-mf-original-src') || element?.getAttribute?.('src') || element?.getAttribute?.('href') || '';
      const tag = element?.tagName ? String(element.tagName).toLowerCase() : 'resource';
      send('error', 'Resource failed: ' + tag + (ref ? ' · ' + ref : ''), null);
      return;
    }
    send('error', event.message || 'JavaScript error', lineFrom(event.error));
  }, true);
  window.addEventListener('unhandledrejection', (event) => { send('error', String(event.reason || 'Promise error'), lineFrom(event.reason)); });
  window.addEventListener('message', (event) => {
    if (event.source !== host || event.data?.source !== 'mf-editor' || event.data.renderId !== ${renderId}) return;
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
    const styleExpectation=window.__mfStyleExpectation;
    if(styleExpectation?.localRefs>0){const active=document.querySelectorAll('style[data-mf-original-href],style[data-mf-fallback-style]').length;if(!active)send('resource-error','STYLES NOT APPLIED');}
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


  const HOSTED_RUNTIME_CACHE = 'mf-code-runtime-v2';

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
    return new URL(`__mf_project__/${encodeURIComponent(projectId)}/${encodedPath}`, scope).href;
  }

  function hostedProjectBase(projectId = hostedProjectId()) {
    const scope = state.hostedRuntime.scope || new URL('./', location.href).href;
    return new URL(`__mf_project__/${encodeURIComponent(projectId)}/`, scope).href;
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
    return `<script data-mf-internal>\n(() => {\n  const base=${JSON.stringify(runtimeBase)};\n  const map=(value)=>{try{const raw=String(value||'');if(raw.startsWith(base))return raw;if(/^\\/(?!\\/)/.test(raw))return base+raw.replace(/^\\/+/, '');}catch{}return value;};\n  const remapNode=(node)=>{if(!(node instanceof Element)||node.hasAttribute('data-mf-internal'))return;['href','src','poster','action','data'].forEach((name)=>{const value=node.getAttribute(name);if(value&&/^\\/(?!\\/)/.test(value))node.setAttribute(name,map(value));});const srcset=node.getAttribute('srcset');if(srcset)node.setAttribute('srcset',srcset.split(',').map((part)=>{const bits=part.trim().split(/\\s+/);if(/^\\/(?!\\/)/.test(bits[0]||''))bits[0]=map(bits[0]);return bits.join(' ');}).join(', '));};\n  const observer=new MutationObserver((records)=>records.forEach((record)=>{if(record.type==='attributes')remapNode(record.target);record.addedNodes?.forEach((node)=>{if(!(node instanceof Element))return;remapNode(node);node.querySelectorAll?.('[href],[src],[poster],[action],[data],[srcset]').forEach(remapNode);});}));\n  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href','src','poster','action','data','srcset']});\n  const nativeFetch=window.fetch?.bind(window);\n  if(nativeFetch)window.fetch=(input,init)=>{try{if(typeof input==='string'||input instanceof URL)return nativeFetch(map(String(input)),init);if(input instanceof Request){if(String(input.url).startsWith(base))return nativeFetch(input,init);const parsed=new URL(input.url);const raw=parsed.pathname+parsed.search+parsed.hash;const mapped=map(raw);if(mapped!==raw)return nativeFetch(new Request(mapped,input),init);}}catch{}return nativeFetch(input,init);};\n  const XHR=window.XMLHttpRequest;if(XHR){const open=XHR.prototype.open;XHR.prototype.open=function(method,url,...rest){return open.call(this,method,map(url),...rest);};}\n  const WorkerCtor=window.Worker;if(WorkerCtor){window.Worker=function(url,options){return new WorkerCtor(map(url),options);};window.Worker.prototype=WorkerCtor.prototype;}\n  const SharedWorkerCtor=window.SharedWorker;if(SharedWorkerCtor){window.SharedWorker=function(url,options){return new SharedWorkerCtor(map(url),options);};window.SharedWorker.prototype=SharedWorkerCtor.prototype;}\n  const push=history.pushState.bind(history),replace=history.replaceState.bind(history);history.pushState=(state,title,url)=>push(state,title,url==null?url:map(url));history.replaceState=(state,title,url)=>replace(state,title,url==null?url:map(url));\n})();\n<\\/script>`;
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
    if (doc.body) doc.body.insertAdjacentHTML('beforeend', '<script data-mf-internal>window.__mfPrepareInspect?.();<\\/script>');

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
          'X-MF-Code-Project': projectId,
          'X-MF-Code-Session': projectToken,
          'X-MF-Code-Render': String(renderId)
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
      source: 'mf-editor',
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




  function toggleFiles() {
    applyFilesOpen(!state.filesOpen);
    persistPrefs();
  }


  function replaceSelection(input, replacement, caretOffset = replacement.length) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.setRangeText(replacement, start, end, 'end');
    input.selectionStart = input.selectionEnd = start + caretOffset;
  }

  function lineIndentAt(input) {
    const before = input.value.slice(0, input.selectionStart);
    const line = before.slice(before.lastIndexOf('\n') + 1);
    return line.match(/^\s*/)?.[0] || '';
  }

  function handlePairing(event, input, language, container) {
    const opener = event.key;
    const closer = PAIRS[opener];
    if (!closer || event.metaKey || event.ctrlKey || event.altKey) return false;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = input.value.slice(start, end);
    const next = input.value[end];

    if (opener === closer && !selected && next === closer) {
      event.preventDefault();
      input.selectionStart = input.selectionEnd = end + 1;
      return true;
    }

    event.preventDefault();
    if (selected) replaceSelection(input, `${opener}${selected}${closer}`, selected.length + 1);
    else replaceSelection(input, `${opener}${closer}`, 1);
    updateCode(language, input.value, container);
    return true;
  }

  function handleBackspacePair(event, input, language, container) {
    if (event.key !== 'Backspace' || input.selectionStart !== input.selectionEnd) return false;
    const pos = input.selectionStart;
    if (pos === 0) return false;
    const opener = input.value[pos - 1];
    const closer = input.value[pos];
    if (PAIRS[opener] !== closer) return false;
    event.preventDefault();
    input.setRangeText('', pos - 1, pos + 1, 'end');
    input.selectionStart = input.selectionEnd = pos - 1;
    updateCode(language, input.value, container);
    return true;
  }

  function handleEnter(event, input, language, container) {
    if (event.key !== 'Enter') return false;
    const start = input.selectionStart;
    const before = input.value.slice(0, start);
    const after = input.value.slice(start);
    const indent = lineIndentAt(input);
    const previousChar = before.trimEnd().slice(-1);
    const nextChar = after.trimStart().slice(0, 1);
    const opensBlock = previousChar === '{' && nextChar === '}';

    event.preventDefault();
    if (opensBlock) replaceSelection(input, `\n${indent}${INDENT}\n${indent}`, 1 + indent.length + INDENT.length);
    else replaceSelection(input, `\n${indent}${previousChar === '{' ? INDENT : ''}`);
    updateCode(language, input.value, container);
    return true;
  }

  function activeEditorContext() {
    const focused = document.activeElement?.closest?.('.code-surface');
    if (focused) {
      const container = focused.closest('.code-section') || singleEditor;
      const input = focused.querySelector('.code-input');
      const language = container === singleEditor ? (state.view === 'all' ? 'html' : state.view) : container.dataset.language;
      return { container, input, language };
    }
    if (state.view === 'all') {
      const section = allSections[0];
      return { container: section, input: getEditorParts(section).input, language: section.dataset.language };
    }
    return { container: singleEditor, input: getEditorParts(singleEditor).input, language: state.view };
  }

  function currentLineRange(input) {
    const value = input.value;
    const start = value.lastIndexOf('\n', Math.max(0, input.selectionStart - 1)) + 1;
    const next = value.indexOf('\n', input.selectionEnd);
    return { start, end: next === -1 ? value.length : next };
  }

  function selectedLineRange(input) {
    const value = input.value;
    const start = value.lastIndexOf('\n', Math.max(0, input.selectionStart - 1)) + 1;
    const next = value.indexOf('\n', input.selectionEnd);
    return { start, end: next === -1 ? value.length : next };
  }

  function toggleComment() {
    const { container, input, language } = activeEditorContext();
    const range = selectedLineRange(input);
    const chunk = input.value.slice(range.start, range.end);
    let next;
    if (language === 'html') {
      const trimmed = chunk.trim();
      next = trimmed.startsWith('<!--') && trimmed.endsWith('-->')
        ? chunk.replace(/^(\s*)<!--\s?/, '$1').replace(/\s?-->(\s*)$/, '$1')
        : `<!-- ${chunk} -->`;
    } else {
      const lines = chunk.split('\n');
      const uncomment = lines.every((line) => !line.trim() || /^\s*\/\//.test(line));
      next = lines.map((line) => {
        if (!line.trim()) return line;
        return uncomment ? line.replace(/^(\s*)\/\/\s?/, '$1') : line.replace(/^(\s*)/, '$1// ');
      }).join('\n');
    }
    input.setRangeText(next, range.start, range.end, 'select');
    updateCode(language, input.value, container);
  }

  function duplicateLine() {
    const { container, input, language } = activeEditorContext();
    const range = currentLineRange(input);
    const line = input.value.slice(range.start, range.end);
    const insert = `\n${line}`;
    input.setRangeText(insert, range.end, range.end, 'end');
    updateCode(language, input.value, container);
  }

  function moveLine(direction) {
    const { container, input, language } = activeEditorContext();
    const value = input.value;
    const range = currentLineRange(input);
    const line = value.slice(range.start, range.end);
    if (direction < 0) {
      if (range.start === 0) return;
      const prevEnd = range.start - 1;
      const prevStart = value.lastIndexOf('\n', Math.max(0, prevEnd - 1)) + 1;
      const prev = value.slice(prevStart, prevEnd);
      const replacement = `${line}\n${prev}`;
      input.setRangeText(replacement, prevStart, range.end, 'end');
      input.selectionStart = input.selectionEnd = prevStart + Math.min(input.selectionStart - range.start, line.length);
    } else {
      if (range.end >= value.length) return;
      const nextStart = range.end + 1;
      const nextBreak = value.indexOf('\n', nextStart);
      const nextEnd = nextBreak === -1 ? value.length : nextBreak;
      const next = value.slice(nextStart, nextEnd);
      const replacement = `${next}\n${line}`;
      input.setRangeText(replacement, range.start, nextEnd, 'end');
      input.selectionStart = input.selectionEnd = range.start + next.length + 1 + Math.min(input.selectionStart - range.start, line.length);
    }
    updateCode(language, input.value, container);
  }

  function formatMarkup(source) {
    const compact = source.replace(/>\s+</g, '><').trim();
    const tokens = compact.split(/(<[^>]+>)/g).filter(Boolean);
    let depth = 0;
    const voids = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
    const lines = [];
    tokens.forEach((token) => {
      const trimmed = token.trim();
      if (!trimmed) return;
      const close = trimmed.match(/^<\/([\w-]+)/);
      const open = trimmed.match(/^<([\w-]+)/);
      if (close) depth = Math.max(0, depth - 1);
      lines.push(`${INDENT.repeat(depth)}${trimmed}`);
      if (open && !trimmed.endsWith('/>') && !voids.test(open[1]) && !trimmed.startsWith('<!')) depth += 1;
    });
    return lines.join('\n');
  }

  function formatBraces(source) {
    let depth = 0;
    return source.split('\n').map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const closes = (trimmed.match(/^}+/)?.[0].length || 0);
      depth = Math.max(0, depth - closes);
      const formatted = `${INDENT.repeat(depth)}${trimmed}`;
      let delta = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
      for (let i = 0; i < trimmed.length; i += 1) {
        const c = trimmed[i], n = trimmed[i + 1];
        if (lineComment) break;
        if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i += 1; } continue; }
        if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
        if (c === '/' && n === '/') { lineComment = true; break; }
        if (c === '/' && n === '*') { blockComment = true; i += 1; continue; }
        if ('"\'`'.includes(c)) { quote = c; continue; }
        if (c === '{') delta += 1;
        if (c === '}') delta -= 1;
      }
      depth = Math.max(0, depth + delta + closes);
      return formatted;
    }).join('\n').trim();
  }

  function formatCurrent() {
    const { container, input, language } = activeEditorContext();
    const formatted = language === 'html' ? formatMarkup(input.value) : formatBraces(input.value);
    input.value = formatted;
    updateCode(language, formatted, container);
    previewActionFeedback(formatButton, 'DONE');
  }

  const EMMET_HTML = {
    '!': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>',
    a: '<a href=""></a>', img: '<img src="" alt="">', button: '<button type="button"></button>',
    input: '<input type="text">', textarea: '<textarea></textarea>', select: '<select></select>', option: '<option value=""></option>',
    main: '<main></main>', section: '<section></section>', header: '<header></header>', footer: '<footer></footer>', nav: '<nav></nav>'
  };

  const EMMET_CSS = {
    df: 'display: flex;', dg: 'display: grid;', db: 'display: block;', di: 'display: inline;', dib: 'display: inline-block;', dn: 'display: none;',
    posr: 'position: relative;', posa: 'position: absolute;', posf: 'position: fixed;', poss: 'position: sticky;',
    t0: 'top: 0;', r0: 'right: 0;', b0: 'bottom: 0;', l0: 'left: 0;', inset0: 'inset: 0;',
    w100: 'width: 100%;', h100: 'height: 100%;', maw100: 'max-width: 100%;', mah100: 'max-height: 100%;',
    m0: 'margin: 0;', p0: 'padding: 0;', ma: 'margin: auto;',
    jcc: 'justify-content: center;', jcsb: 'justify-content: space-between;', jcfe: 'justify-content: flex-end;',
    aic: 'align-items: center;', aifs: 'align-items: flex-start;', aife: 'align-items: flex-end;',
    fdc: 'flex-direction: column;', fdr: 'flex-direction: row;', fww: 'flex-wrap: wrap;',
    gtc: 'grid-template-columns: repeat(2, 1fr);',
    oh: 'overflow: hidden;', oa: 'overflow: auto;', oxh: 'overflow-x: hidden;', oyh: 'overflow-y: hidden;',
    curp: 'cursor: pointer;', pe0: 'pointer-events: none;', usn: 'user-select: none;',
    posa50: 'position: absolute;\nleft: 50%;\ntop: 50%;\ntransform: translate(-50%, -50%);'
  };

  const HTML_VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

  function splitTopLevel(value, separator) {
    const parts = [];
    let start = 0, square = 0, curly = 0, round = 0;
    for (let i = 0; i < value.length; i += 1) {
      const char = value[i];
      if (char === '[') square += 1;
      else if (char === ']') square = Math.max(0, square - 1);
      else if (char === '{') curly += 1;
      else if (char === '}') curly = Math.max(0, curly - 1);
      else if (char === '(') round += 1;
      else if (char === ')') round = Math.max(0, round - 1);
      else if (char === separator && square === 0 && curly === 0 && round === 0) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(value.slice(start));
    return parts.filter(Boolean);
  }

  function parseEmmetNode(token) {
    const multiplierMatch = token.match(/\*(\d+)$/);
    const multiplier = multiplierMatch ? Math.min(50, Math.max(1, Number(multiplierMatch[1]))) : 1;
    if (multiplierMatch) token = token.slice(0, multiplierMatch.index);

    let text = '';
    token = token.replace(/\{([^{}]*)\}/g, (_, value) => { text = value; return ''; });
    const attributes = [];
    token = token.replace(/\[([^\]]+)\]/g, (_, body) => {
      body.match(/[^\s=]+(?:=(?:"[^"]*"|'[^']*'|[^\s]+))?/g)?.forEach((entry) => {
        const eq = entry.indexOf('=');
        if (eq === -1) attributes.push([entry, '']);
        else attributes.push([entry.slice(0, eq), entry.slice(eq + 1).replace(/^["']|["']$/g, '')]);
      });
      return '';
    });

    const tag = token.match(/^[A-Za-z][\w-]*/)?.[0] || (token.startsWith('.') || token.startsWith('#') ? 'div' : null);
    if (!tag) return null;
    const id = token.match(/#([\w$-]+)/)?.[1] || '';
    const classes = [...token.matchAll(/\.([\w$-]+)/g)].map((match) => match[1]);
    return { tag, id, classes, attributes, text, multiplier };
  }

  function renderEmmetNode(node, inner = '', index = 1) {
    const replaceNumber = (value) => value.replace(/\$/g, String(index));
    const attrs = [];
    if (node.id) attrs.push(`id="${replaceNumber(node.id)}"`);
    if (node.classes.length) attrs.push(`class="${node.classes.map(replaceNumber).join(' ')}"`);
    node.attributes.forEach(([name, value]) => attrs.push(value ? `${name}="${replaceNumber(value)}"` : name));
    const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
    if (HTML_VOID.has(node.tag.toLowerCase())) return `<${node.tag}${attrText}>`;
    const body = node.text ? replaceNumber(node.text) : inner;
    return `<${node.tag}${attrText}>${body}</${node.tag}>`;
  }

  function indentBlock(value, depth = 1) {
    const prefix = INDENT.repeat(depth);
    return value.split('\n').map((line) => `${prefix}${line}`).join('\n');
  }

  function tokenizeEmmetExpression(expression) {
    const tokens = [];
    let start = 0, square = 0, curly = 0, round = 0;
    for (let i = 0; i < expression.length; i += 1) {
      const char = expression[i];
      if (char === '[') square += 1;
      else if (char === ']') square = Math.max(0, square - 1);
      else if (char === '{') curly += 1;
      else if (char === '}') curly = Math.max(0, curly - 1);
      else if (char === '(') round += 1;
      else if (char === ')') round = Math.max(0, round - 1);
      else if ((char === '+' || char === '>') && square === 0 && curly === 0 && round === 0) {
        if (i > start) tokens.push({ type: 'node', value: expression.slice(start, i) });
        tokens.push({ type: 'op', value: char });
        start = i + 1;
      }
    }
    if (start < expression.length) tokens.push({ type: 'node', value: expression.slice(start) });
    return tokens;
  }

  function buildEmmetTree(expression) {
    const tokens = tokenizeEmmetExpression(expression);
    const root = { children: [] };
    let siblings = root.children;
    let lastNode = null;
    let operator = '+';
    for (const token of tokens) {
      if (token.type === 'op') { operator = token.value; continue; }
      const parsed = parseEmmetNode(token.value);
      if (!parsed) return null;
      const node = { ...parsed, children: [], parent: null };
      if (operator === '>' && lastNode) {
        node.parent = lastNode;
        lastNode.children.push(node);
        siblings = lastNode.children;
      } else {
        siblings.push(node);
        node.parent = siblings === root.children ? root : lastNode?.parent || root;
      }
      lastNode = node;
      operator = '+';
    }
    return root;
  }

  function renderEmmetTreeNode(node, depth = 0) {
    const copies = [];
    for (let index = 1; index <= node.multiplier; index += 1) {
      const childText = node.children.length
        ? `\n${node.children.map((child) => indentBlock(renderEmmetTreeNode(child, depth + 1))).join('\n')}\n`
        : '';
      copies.push(renderEmmetNode(node, childText, index));
    }
    return copies.join('\n');
  }

  function expandEmmetExpression(expression) {
    const tree = buildEmmetTree(expression);
    if (!tree || !tree.children.length) return null;
    return tree.children.map((node) => renderEmmetTreeNode(node)).join('\n');
  }

  function expandHtmlAbbreviation(abbr) {
    if (EMMET_HTML[abbr]) return EMMET_HTML[abbr];
    if (!abbr || /[\s;<]/.test(abbr)) return null;
    return expandEmmetExpression(abbr);
  }

  function expandCssAbbreviation(abbr) {
    if (EMMET_CSS[abbr]) return EMMET_CSS[abbr];
    const numeric = abbr.match(/^(m|mt|mr|mb|ml|mx|my|p|pt|pr|pb|pl|px|py|w|h|gap|fz|lh|br)(-?\d+(?:\.\d+)?)(p|r|e|%)?$/i);
    if (!numeric) return null;
    const [, rawProp, rawValue, rawUnit] = numeric;
    const map = {
      m: 'margin', mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left',
      p: 'padding', pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left',
      w: 'width', h: 'height', gap: 'gap', fz: 'font-size', lh: 'line-height', br: 'border-radius'
    };
    if (rawProp === 'mx' || rawProp === 'my' || rawProp === 'px' || rawProp === 'py') {
      const base = rawProp[0] === 'm' ? 'margin' : 'padding';
      const sides = rawProp[1] === 'x' ? ['left','right'] : ['top','bottom'];
      const unit = rawUnit === '%' ? '%' : rawUnit === 'r' ? 'rem' : rawUnit === 'e' ? 'em' : rawUnit === 'p' ? 'px' : Number(rawValue) === 0 ? '' : 'px';
      return sides.map((side) => `${base}-${side}: ${rawValue}${unit};`).join('\n');
    }
    const property = map[rawProp.toLowerCase()];
    if (!property) return null;
    const unit = rawUnit === '%' ? '%' : rawUnit === 'r' ? 'rem' : rawUnit === 'e' ? 'em' : rawUnit === 'p' ? 'px' : Number(rawValue) === 0 || property === 'line-height' ? '' : 'px';
    return `${property}: ${rawValue}${unit};`;
  }

  function emmetAtCaret(input, language) {
    const before = input.value.slice(0, input.selectionStart);
    const match = before.match(/([^\s;]+)$/);
    if (!match) return false;
    const abbr = match[1];
    const expansion = language === 'html' ? expandHtmlAbbreviation(abbr) : language === 'css' ? expandCssAbbreviation(abbr) : null;
    if (!expansion) return false;
    const start = input.selectionStart - abbr.length;
    input.setRangeText(expansion, start, input.selectionStart, 'end');
    return true;
  }

  const HTML_TAGS = ['a','article','aside','button','canvas','details','dialog','div','figure','figcaption','footer','form','h1','h2','h3','header','img','input','label','li','main','nav','ol','option','p','picture','section','select','span','strong','summary','table','tbody','td','textarea','th','thead','tr','ul','video'];
  const HTML_ATTRIBUTES = ['alt','aria-label','class','data-','disabled','for','height','href','id','loading','name','placeholder','rel','role','src','style','target','title','type','value','width'];
  const CSS_PROPERTIES = ['align-content','align-items','align-self','appearance','aspect-ratio','backdrop-filter','background','background-color','border','border-color','border-radius','border-style','border-width','bottom','box-shadow','box-sizing','color','column-gap','cursor','display','filter','flex','flex-basis','flex-direction','flex-grow','flex-shrink','flex-wrap','font-family','font-size','font-style','font-weight','gap','grid','grid-area','grid-auto-flow','grid-template-columns','grid-template-rows','height','inset','justify-content','justify-items','left','letter-spacing','line-height','margin','margin-bottom','margin-left','margin-right','margin-top','max-height','max-width','min-height','min-width','object-fit','opacity','overflow','overflow-x','overflow-y','padding','padding-bottom','padding-left','padding-right','padding-top','pointer-events','position','right','row-gap','text-align','text-decoration','text-overflow','text-transform','top','transform','transform-origin','transition','user-select','visibility','white-space','width','z-index'];
  const CSS_VALUES = ['absolute','auto','block','border-box','center','column','contents','fixed','flex','grid','hidden','inherit','initial','inline','inline-block','inline-flex','none','normal','relative','repeat(2, 1fr)','row','space-around','space-between','space-evenly','sticky','transparent','unset','visible','wrap'];
  const JS_COMPLETIONS = ['addEventListener','Array.from','async','await','class','classList','const','console.error','console.log','console.warn','document.createElement','document.querySelector','document.querySelectorAll','else','fetch','filter','find','for','forEach','function','if','includes','JSON.parse','JSON.stringify','let','map','Math.max','Math.min','new','Object.entries','Object.keys','Promise.all','reduce','requestAnimationFrame','return','setInterval','setTimeout','some','switch','textContent','throw','try','URL','window','while'];

  function closeAutocomplete() {
    autocomplete.hidden = true;
    autocomplete.innerHTML = '';
    state.autocomplete.open = false;
  }

  function autocompleteContext(input, language) {
    const before = input.value.slice(0, input.selectionStart);
    if (language === 'html') {
      const openTag = before.match(/<([A-Za-z][\w-]*)(?:\s+[^<>]*)?$/);
      if (openTag && /\s/.test(openTag[0])) {
        const prefix = before.match(/[\w:-]+$/)?.[0] || '';
        return { prefix, values: HTML_ATTRIBUTES, suffix: '' };
      }
      const tagPrefix = before.match(/<\/?([\w-]*)$/)?.[1];
      if (tagPrefix !== undefined) return { prefix: tagPrefix, values: HTML_TAGS, suffix: '' };
      const prefix = before.match(/[\w-]+$/)?.[0] || '';
      return { prefix, values: HTML_TAGS, suffix: '' };
    }

    if (language === 'css') {
      const currentLine = before.slice(before.lastIndexOf('\n') + 1);
      const colon = currentLine.lastIndexOf(':');
      const brace = Math.max(before.lastIndexOf('{'), before.lastIndexOf('}'));
      if (colon >= 0 && before.lastIndexOf(':') > brace) {
        const prefix = before.match(/[\w().,%#-]+$/)?.[0] || '';
        return { prefix, values: CSS_VALUES, suffix: '' };
      }
      const prefix = before.match(/[\w-]+$/)?.[0] || '';
      return { prefix, values: CSS_PROPERTIES, suffix: '' };
    }

    const prefix = before.match(/[\w.$-]+$/)?.[0] || '';
    return { prefix, values: JS_COMPLETIONS, suffix: '' };
  }

  function showAutocomplete(input, language, container) {
    const context = autocompleteContext(input, language);
    const prefix = context.prefix;
    if (prefix.length < 2) { closeAutocomplete(); return; }
    const lower = prefix.toLowerCase();
    const items = context.values
      .filter((item) => item.toLowerCase().startsWith(lower) && item.toLowerCase() !== lower)
      .slice(0, 7)
      .map((label) => ({ label, insert: `${label}${context.suffix}` }));
    if (!items.length) { closeAutocomplete(); return; }
    state.autocomplete = { open: true, items, index: 0, input, language, container, prefix };
    autocomplete.innerHTML = items.map((item, index) => `<button class="autocomplete-item${index === 0 ? ' is-active' : ''}" type="button" data-index="${index}">${escapeHtml(item.label)}</button>`).join('');
    autocomplete.hidden = false;
  }

  function chooseAutocomplete(index = state.autocomplete.index) {
    if (!state.autocomplete.open) return false;
    const { input, language, container, items, prefix } = state.autocomplete;
    const item = items[index];
    if (!item) return false;
    input.setRangeText(item.insert, input.selectionStart - prefix.length, input.selectionStart, 'end');
    updateCode(language, input.value, container);
    closeAutocomplete();
    input.focus();
    return true;
  }

  function findBracketRanges(value, caret) {
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const reverse = { ')': '(', ']': '[', '}': '{' };
    let pos = caret > 0 && (pairs[value[caret - 1]] || reverse[value[caret - 1]]) ? caret - 1 : (pairs[value[caret]] || reverse[value[caret]]) ? caret : -1;
    if (pos < 0) return [];
    const char = value[pos];
    if (pairs[char]) {
      const close = pairs[char]; let depth = 0;
      for (let i = pos; i < value.length; i += 1) { if (value[i] === char) depth += 1; if (value[i] === close) depth -= 1; if (depth === 0) return [{ start: pos, end: pos+1 }, { start: i, end: i+1 }]; }
    } else {
      const open = reverse[char]; let depth = 0;
      for (let i = pos; i >= 0; i -= 1) { if (value[i] === char) depth += 1; if (value[i] === open) depth -= 1; if (depth === 0) return [{ start: i, end: i+1 }, { start: pos, end: pos+1 }]; }
    }
    return [];
  }

  function findTagRanges(value, caret) {
    const tags = [...value.matchAll(/<\/?([A-Za-z][\w-]*)\b[^>]*>/g)];
    const currentIndex = tags.findIndex((m) => caret >= m.index && caret <= m.index + m[0].length);
    if (currentIndex < 0) return [];
    const current = tags[currentIndex], name = current[1], closing = /^<\//.test(current[0]), selfClosing = /\/>$/.test(current[0]);
    if (selfClosing) return [];
    let depth = 0;
    if (!closing) {
      for (let i = currentIndex; i < tags.length; i += 1) { const t = tags[i]; if (t[1] !== name) continue; depth += /^<\//.test(t[0]) ? -1 : 1; if (depth === 0) return [{ start: current.index, end: current.index + current[0].length }, { start: t.index, end: t.index + t[0].length }]; }
    } else {
      for (let i = currentIndex; i >= 0; i -= 1) { const t = tags[i]; if (t[1] !== name) continue; depth += /^<\//.test(t[0]) ? 1 : -1; if (depth === 0) return [{ start: t.index, end: t.index + t[0].length }, { start: current.index, end: current.index + current[0].length }]; }
    }
    return [];
  }

  function updateMatching(container, language) {
    const input = getEditorParts(container).input;
    const caret = input.selectionStart;
    state.matchRanges[language] = language === 'html' ? (findTagRanges(input.value, caret).length ? findTagRanges(input.value, caret) : findBracketRanges(input.value, caret)) : findBracketRanges(input.value, caret);
    syncEditor(container, language);
  }

  let findIndex = 0;
  function setReplaceMode(open, focusReplace = false) {
    findBar.classList.toggle('is-replace', open);
    findReplaceToggle?.classList.toggle('is-active', open);
    findReplaceToggle?.setAttribute('aria-expanded', String(open));
    if (open && focusReplace) requestAnimationFrame(() => replaceInput.focus());
  }
  function openFind(replaceMode = false) {
    findBar.hidden = false;
    setReplaceMode(replaceMode, false);
    findInput.focus();
    findInput.select();
    findIndex = 0;
    updateFind();
  }
  function closeFind() {
    findBar.hidden = true;
    setReplaceMode(false, false);
    activeEditorContext().input.focus();
  }
  function getFindMatches() {
    const { input } = activeEditorContext(); const query = findInput.value; if (!query) return [];
    const matches = []; const hay = input.value.toLowerCase(), needle = query.toLowerCase(); let from = 0;
    while ((from = hay.indexOf(needle, from)) !== -1 && matches.length < 1000) { matches.push(from); from += Math.max(1, needle.length); }
    return matches;
  }
  function updateFind() {
    const matches = getFindMatches();
    findIndex = matches.length ? clamp(findIndex, 0, matches.length - 1) : 0;
    findCount.textContent = matches.length ? `${findIndex + 1} / ${matches.length}` : '0 / 0';
  }
  function selectFindMatch(index) {
    const { input } = activeEditorContext(); const matches = getFindMatches(); if (!matches.length) { updateFind(); return false; }
    findIndex = ((index % matches.length) + matches.length) % matches.length;
    const start = matches[findIndex];
    input.focus();
    input.setSelectionRange(start, start + findInput.value.length);
    findCount.textContent = `${findIndex + 1} / ${matches.length}`;
    return true;
  }
  function stepFind(direction) {
    const { input } = activeEditorContext(); const matches = getFindMatches(); if (!matches.length) { updateFind(); return; }
    const caret = input.selectionStart;
    let index;
    if (direction > 0) {
      index = matches.findIndex((position) => position > caret);
      if (index < 0) index = 0;
    } else {
      index = matches.length - 1;
      for (let i = matches.length - 1; i >= 0; i -= 1) { if (matches[i] < caret) { index = i; break; } }
    }
    selectFindMatch(index);
  }
  function replaceCurrentMatch() {
    const query = findInput.value;
    if (!query) return;
    const { container, input, language } = activeEditorContext();
    const selected = input.value.slice(input.selectionStart, input.selectionEnd);
    if (selected.toLowerCase() !== query.toLowerCase()) {
      if (!selectFindMatch(findIndex)) return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + replaceInput.value + input.value.slice(end);
    const caret = start + replaceInput.value.length;
    input.setSelectionRange(caret, caret);
    updateCode(language, input.value, container);
    updateFind();
    if (getFindMatches().length) selectFindMatch(Math.min(findIndex, getFindMatches().length - 1));
  }
  function replaceAllMatches() {
    const query = findInput.value;
    if (!query) return;
    const { container, input, language } = activeEditorContext();
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const next = input.value.replace(pattern, () => replaceInput.value);
    if (next === input.value) return;
    input.value = next;
    updateCode(language, next, container);
    input.focus();
    updateFind();
  }

  function projectDependencyRefs() {
    const refs = [];
    const add = (value) => { if (value) refs.push(String(value)); };
    const records = state.project?.mode === 'folder' ? [...state.project.files.values()] : [
      { language: 'html', text: state.code.html },
      { language: 'js', text: state.code.js }
    ];

    records.forEach((record) => {
      if (typeof record.text !== 'string') return;
      if (record.language === 'html') {
        try {
          const doc = new DOMParser().parseFromString(record.text, 'text/html');
          doc.querySelectorAll('script[src]').forEach((node) => add(node.getAttribute('src')));
          doc.querySelectorAll('link[href]').forEach((node) => {
            const rel = String(node.getAttribute('rel') || '').toLowerCase();
            if (/modulepreload|preload/.test(rel) && /script|module/i.test(node.getAttribute('as') || rel)) add(node.getAttribute('href'));
          });
          doc.querySelectorAll('script:not([src])').forEach((node) => {
            const text = node.textContent || '';
            for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) add(match[1]);
          });
        } catch {}
      }
      if (record.language === 'js') {
        for (const match of record.text.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) add(match[1]);
      }
    });
    return refs.join('\n');
  }

  function projectProvidedLibraries() {
    const refs = projectDependencyRefs();
    return new Set(CURATED_LIBRARIES.filter((library) => library.detect.test(refs)).map((library) => library.id));
  }

  function effectiveLibraries() {
    const provided = projectProvidedLibraries();
    return CURATED_LIBRARIES.filter((library) => state.libraries.has(library.id) && !provided.has(library.id));
  }

  function googleFontHref(name) {
    const family = encodeURIComponent(name).replace(/%20/g, '+');
    return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600&display=swap`;
  }

  function addonHeadHtml() {
    const parts = [];
    effectiveLibraries().forEach((library) => {
      if (library.scripts) library.scripts.forEach((src) => parts.push(`<script data-mf-addon="${library.id}" src="${src}" onerror="window.__mfLibraryError&&window.__mfLibraryError('${library.id}')"></script>`));
      if (library.module) parts.push(`<script data-mf-addon="${library.id}" type="module">window.__mfLibPromises=window.__mfLibPromises||[];window.__mfLibPromises.push(import('${library.module}').then(m=>{window.${library.global}=m;}).catch(e=>{window.__mfLibraryError&&window.__mfLibraryError('${library.id}');}));</script>`);
    });
    state.fonts.forEach((font) => parts.push(`<link data-mf-font="${font.replace(/"/g,'')}" rel="stylesheet" href="${googleFontHref(font)}" onerror="window.__mfLibraryError&&window.__mfLibraryError('font:${font.replace(/'/g,'')}')">`));
    return parts.join('\n');
  }

  function libraryStatus(library, provided) {
    if (provided.has(library.id)) return 'PROJECT';
    if (state.libraryFailures.has(library.id)) return 'OFFLINE';
    if (state.libraries.has(library.id)) return '✓';
    return '+';
  }

  function renderLibraryPanel() {
    if (!libraryList || !fontLibraryList) return;
    const provided = projectProvidedLibraries();
    libraryList.innerHTML = CURATED_LIBRARIES.map((library) => {
      const status = libraryStatus(library, provided);
      const locked = status === 'PROJECT';
      return `<button class="library-row${state.libraries.has(library.id) ? ' is-active' : ''}${locked ? ' is-project' : ''}" type="button" data-library-id="${library.id}" ${locked ? 'disabled' : ''}><span class="library-row-main"><strong>${library.name}</strong><small>${library.meta}</small></span><span class="library-row-status">${status}</span></button>`;
    }).join('');
    const query = (fontLibrarySearch?.value || '').trim().toLowerCase();
    const fonts = CURATED_FONTS.filter((name) => !query || name.toLowerCase().includes(query));
    fontLibraryList.innerHTML = fonts.map((font) => `<button class="font-library-row${state.fonts.has(font) ? ' is-active' : ''}" type="button" data-google-font="${font}"><span><strong>${font.toUpperCase()}</strong><small>font-family: &quot;${font}&quot;</small></span><span class="library-row-status">${state.fonts.has(font) ? '✓' : '+'}</span></button>`).join('') || '<p class="library-empty">NO MATCHES</p>';
  }

  function openLibraries() {
    closeToolsMenu();
    closeProjectMenu();
    if (!helpOverlay.hidden) closeHelp({ restoreFocus: false });
    renderLibraryPanel();
    libraryOverlay.hidden = false;
    requestAnimationFrame(() => { libraryOverlay.classList.add('is-open'); libraryClose.focus(); });
  }

  function closeLibraries({ restoreFocus = true } = {}) {
    if (!libraryOverlay || libraryOverlay.hidden) return;
    libraryOverlay.classList.remove('is-open');
    window.setTimeout(() => { if (!libraryOverlay.classList.contains('is-open')) libraryOverlay.hidden = true; }, 360);
    if (restoreFocus) toolsButton.focus();
  }

  function toggleLibrary(id) {
    const library = CURATED_LIBRARIES.find((item) => item.id === id);
    if (!library || projectProvidedLibraries().has(id)) return;
    if (state.libraries.has(id)) state.libraries.delete(id); else state.libraries.add(id);
    state.libraryFailures.delete(id);
    persistAddons();
    renderLibraryPanel();
    renderPreview();
  }

  function toggleGoogleFont(name) {
    if (!CURATED_FONTS.includes(name)) return;
    if (state.fonts.has(name)) state.fonts.delete(name); else state.fonts.add(name);
    state.libraryFailures.delete(`font:${name}`);
    persistAddons();
    renderLibraryPanel();
    renderPreview();
  }

  function closeToolsMenu() {
    if (!toolsMenu || toolsMenu.hidden) return;
    toolsMenu.classList.remove('is-open');
    toolsButton.setAttribute('aria-expanded', 'false');
    window.setTimeout(() => { if (!toolsMenu.classList.contains('is-open')) toolsMenu.hidden = true; }, 360);
  }

  function toggleToolsMenu() {
    const opening = toolsMenu.hidden || !toolsMenu.classList.contains('is-open');
    closeProjectMenu();
    if (!opening) { closeToolsMenu(); return; }
    toolsMenu.hidden = false;
    toolsButton.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => toolsMenu.classList.add('is-open'));
  }

  const COMMANDS = [
    ['Undo', commandShortcut('undo'), () => undoHistory()],
    ['Redo', commandShortcut('redo'), () => redoHistory()],
    ['Format current code', commandShortcut('format'), () => formatCurrent()],
    ['Libraries', '', () => openLibraries()],
    ['Find in code', commandShortcut('find'), () => openFind(false)],
    ['Find and replace', commandShortcut('replace'), () => openFind(true)],
    ['Toggle comment', commandShortcut('comment'), () => toggleComment()],
    ['Duplicate line', commandShortcut('duplicate'), () => duplicateLine()],
    ['Move line up', IS_MAC ? '⌥↑' : 'ALT↑', () => moveLine(-1)],
    ['Move line down', IS_MAC ? '⌥↓' : 'ALT↓', () => moveLine(1)],
    ['Show files', '', () => applyFilesOpen(true), () => !state.filesOpen],
    ['Hide files', '', () => applyFilesOpen(false), () => state.filesOpen],
    ...CURATED_LIBRARIES.map((library) => [`Toggle ${library.name}`, '', () => toggleLibrary(library.id), () => !projectProvidedLibraries().has(library.id), true]),
    ...CURATED_FONTS.map((font) => [`Toggle font ${font}`, '', () => toggleGoogleFont(font), null, true]),
    ['New project', '', () => startSimpleProject(STARTER_CODE)],
    ['View HTML', '', () => switchView('html')], ['View CSS', '', () => switchView('css')], ['View JS', '', () => switchView('js')], ['View all', '', () => switchView('all')],
    ['Preview desktop', '', () => { applyPreviewSize('desktop'); persistPrefs(); }, () => !isDetachedPreviewOpen()],
    ['Preview tablet', '', () => { applyPreviewSize('tablet'); persistPrefs(); }, () => !isDetachedPreviewOpen()],
    ['Preview mobile', '', () => { applyPreviewSize('mobile'); persistPrefs(); }, () => !isDetachedPreviewOpen()],
    ['Focus preview', '', () => setPreviewFocus(true), () => !state.previewFocus && !isDetachedPreviewOpen()],
    ['Exit preview focus', '', () => setPreviewFocus(false), () => state.previewFocus],
    ['Open preview in window', '', () => detachPreview(), () => !isDetachedPreviewOpen()],
    ['Return preview to editor', '', () => returnPreviewToEditor(), () => isDetachedPreviewOpen()],
    ['Recover preview', '', () => toggleRecoveryMenu(), () => !recoverPreviewButton.hidden],
    ['Recover: hide loader', '', () => runPreviewRecovery('loader'), () => !recoverPreviewButton.hidden, true],
    ['Recover: dismiss overlay', '', () => runPreviewRecovery('overlay'), () => !recoverPreviewButton.hidden, true],
    ['Recover: restore scroll', '', () => runPreviewRecovery('scroll'), () => !recoverPreviewButton.hidden, true],
    ['Recover: disable media', '', () => runPreviewRecovery('media'), () => !recoverPreviewButton.hidden, true],
    ['Recover: reload preview', '', () => runPreviewRecovery('reload'), () => !recoverPreviewButton.hidden, true],
    ['Refresh preview', '', () => renderPreview()],
    ['Export HTML', '', () => exportStandaloneHtml()],
    ['Open files', '', () => projectInput.click()],
    ['Open folder', '', () => openFolderPicker()],
    ['Save project', '', () => saveProject()],
    ['Recover previous project', '', () => recoverPreviousProject(), () => Boolean(recoverySnapshot())],
    ['Light theme', '', () => { applyTheme('light'); persistPrefs(); }, () => state.theme !== 'light'],
    ['Night theme', '', () => { applyTheme('dark'); persistPrefs(); }, () => state.theme !== 'dark'],
    ['Help', '', () => openHelp()]
  ];
  let commandIndex = 0;
  function filteredCommands() { const q = commandInput.value.trim().toLowerCase(); return COMMANDS.filter(([name, , , available, searchOnly]) => (!searchOnly || q) && (!available || available()) && (!q || name.toLowerCase().includes(q))); }
  function renderCommands() { const items = filteredCommands(); commandIndex = Math.min(commandIndex, Math.max(0, items.length - 1)); commandList.innerHTML = items.map(([name, shortcut], i) => `<button class="command-item${i === commandIndex ? ' is-active' : ''}" type="button" data-index="${i}" role="option"><span>${name.toUpperCase()}</span><span class="command-shortcut">${shortcut}</span></button>`).join(''); }
  function openCommands() { closeFind(); closeProjectMenu(); closeToolsMenu(); if (!libraryOverlay.hidden) closeLibraries({ restoreFocus: false }); if (!helpOverlay.hidden) closeHelp({ restoreFocus: false }); commandIndex = 0; commandInput.value = ''; renderCommands(); commandPalette.hidden = false; requestAnimationFrame(() => commandInput.focus()); }
  function closeCommands() { commandPalette.hidden = true; activeEditorContext().input.focus(); }
  function runCommand(index = commandIndex) { const command = filteredCommands()[index]; if (!command) return; closeCommands(); command[2](); }

  function bindEditor(container, languageResolver) {
    const parts = getEditorParts(container);
    parts.input.addEventListener('input', () => { const language = languageResolver(); updateCode(language, parts.input.value, container, { coalesce: true }); showAutocomplete(parts.input, language, container); });
    parts.input.addEventListener('click', () => {
      const language = languageResolver();
      updateMatching(container, language);
      if (language === 'html') highlightPreviewFromHtmlInput(parts.input);
    });
    parts.input.addEventListener('keyup', (event) => {
      const language = languageResolver();
      if (!['Enter','Escape'].includes(event.key)) updateMatching(container, language);
      if (language === 'html' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key)) highlightPreviewFromHtmlInput(parts.input);
    });
    parts.input.addEventListener('select', () => { if (languageResolver() === 'html') highlightPreviewFromHtmlInput(parts.input); });
    parts.input.addEventListener('scroll', () => syncScroll(parts, languageResolver()));
    parts.input.addEventListener('keydown', (event) => {
      const language = languageResolver();

      if (state.autocomplete.open) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const length = state.autocomplete.items.length; state.autocomplete.index = (state.autocomplete.index + (event.key === 'ArrowDown' ? 1 : -1) + length) % length; autocomplete.querySelectorAll('.autocomplete-item').forEach((item, i) => item.classList.toggle('is-active', i === state.autocomplete.index)); return; }
        if (event.key === 'Enter' && chooseAutocomplete()) { event.preventDefault(); return; }
        if (event.key === 'Escape') { event.preventDefault(); closeAutocomplete(); return; }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoHistory();
        else undoHistory();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redoHistory(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === '/') { event.preventDefault(); toggleComment(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateLine(); return; }
      if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); moveLine(-1); return; }
      if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); moveLine(1); return; }
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); formatCurrent(); return; }

      if (event.key === 'Tab') {
        event.preventDefault();
        if (emmetAtCaret(parts.input, language)) updateCode(language, parts.input.value, container);
        else { replaceSelection(parts.input, INDENT); updateCode(language, parts.input.value, container); }
        closeAutocomplete();
        return;
      }

      if (handleBackspacePair(event, parts.input, language, container)) return;
      if (handleEnter(event, parts.input, language, container)) return;
      if (handlePairing(event, parts.input, language, container)) return;

      if (CLOSERS.has(event.key) && parts.input.value[parts.input.selectionStart] === event.key) {
        event.preventDefault();
        parts.input.selectionStart += 1;
        parts.input.selectionEnd = parts.input.selectionStart;
      }
    });
  }

  function applyTheme(theme) {
    state.theme = theme;
    app.dataset.theme = theme;
    themeToggle.setAttribute('aria-label', theme === 'light' ? 'Switch to night mode' : 'Switch to light mode');
  }

  function applyFont(font) {
    state.font = font;
    app.dataset.codeFont = font;
    fontButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.font === font));
  }


  function applyPreviewSize(size) {
    state.previewSize = size;
    previewPane.dataset.previewSize = size;
    previewSizeButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.previewSize === size));
  }

  function setPreviewFocus(active) {
    state.previewFocus = active;
    workspace.classList.toggle('is-preview-focus', active);
    focusPreviewButton.classList.toggle('is-active', active);
    focusPreviewButton.textContent = active ? 'EXIT' : 'FOCUS';
    focusPreviewButton.setAttribute('aria-pressed', String(active));
  }

  function previewActionFeedback(button, label) {
    const original = button.textContent;
    button.textContent = label;
    button.classList.add('is-feedback');
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove('is-feedback');
    }, 900);
  }

  function setDetachedPreviewUi(active) {
    previewPane.classList.toggle('is-detached', active);
    detachPreviewButton.classList.toggle('is-active', active);
    detachPreviewButton.setAttribute('aria-pressed', String(active));
    detachPreviewButton.setAttribute('aria-label', active ? 'Return preview to editor' : 'Open live preview in a new window');
    detachedPreviewPlaceholder.hidden = !active;
  }

  function returnPreviewToEditor({ closeWindow = true } = {}) {
    if (closeWindow && isDetachedPreviewOpen()) { try { state.detachedWindow.close(); } catch {} }
    state.detachedWindow = null;
    window.clearInterval(state.detachedWatchTimer);
    state.detachedWatchTimer = null;
    setDetachedPreviewUi(false);
  }

  function detachPreview() {
    if (isDetachedPreviewOpen()) {
      state.detachedWindow.focus();
      return;
    }
    const win = window.open('', 'n7-code-live-preview', 'popup=yes,width=1180,height=820');
    if (!win) {
      previewActionFeedback(detachPreviewButton, 'BLOCKED');
      return;
    }
    state.detachedWindow = win;
    setDetachedPreviewUi(true);
    writeDetachedPreview();
    window.clearInterval(state.detachedWatchTimer);
    state.detachedWatchTimer = window.setInterval(() => {
      if (!isDetachedPreviewOpen()) returnPreviewToEditor({ closeWindow: false });
    }, 700);
  }

  function toggleDetachedPreview() {
    if (isDetachedPreviewOpen()) returnPreviewToEditor();
    else detachPreview();
  }

  function closeRecoveryMenu() {
    previewRecoveryMenu.classList.remove('is-open');
    recoverPreviewButton.classList.remove('is-active');
    recoverPreviewButton.setAttribute('aria-expanded', 'false');
    window.setTimeout(() => { if (!previewRecoveryMenu.classList.contains('is-open')) previewRecoveryMenu.hidden = true; }, 260);
  }

  function toggleRecoveryMenu() {
    if (recoverPreviewButton.hidden) return;
    const opening = !previewRecoveryMenu.classList.contains('is-open');
    if (!opening) { closeRecoveryMenu(); return; }
    previewRecoveryMenu.hidden = false;
    requestAnimationFrame(() => {
      previewRecoveryMenu.classList.add('is-open');
      recoverPreviewButton.classList.add('is-active');
      recoverPreviewButton.setAttribute('aria-expanded', 'true');
    });
  }

  function runPreviewRecovery(action) {
    closeRecoveryMenu();
    if (action === 'reload') { renderPreview(); return; }
    postToPreviewSurfaces({ source: 'mf-editor', type: 'recover', action, renderId: state.renderId });
  }

  function closeProjectMenu() {
    window.clearTimeout(state.menuTimer);
    projectMenu.classList.remove('is-open');
    projectButton.setAttribute('aria-expanded', 'false');
    state.menuTimer = window.setTimeout(() => { projectMenu.hidden = true; }, 430);
    disarmReset();
  }

  function openProjectMenu() {
    window.clearTimeout(state.menuTimer);
    if (recoverPreviousAction) recoverPreviousAction.hidden = !recoverySnapshot();
    projectMenu.hidden = false;
    projectButton.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => projectMenu.classList.add('is-open'));
  }

  function toggleProjectMenu() {
    if (projectButton.getAttribute('aria-expanded') === 'true') closeProjectMenu();
    else openProjectMenu();
  }

  function updateHelpCurrentState() {
    if (!helpStateFields.size) return;
    const set = (key, value) => { const node = helpStateFields.get(key); if (node) node.textContent = value; };
    const projectName = String(state.project?.name || 'UNTITLED').toUpperCase();
    set('project', state.project?.mode === 'folder' ? `FOLDER · ${projectName}` : `SIMPLE · ${projectName}`);
    set('preview', isDetachedPreviewOpen() ? 'DETACHED' : state.previewFocus ? 'FOCUS' : 'EMBEDDED');
    set('runtime', state.project?.mode === 'folder' && state.hostedRuntime.ready ? 'FULL PROJECT' : 'LOCAL COMPAT');
    set('files', state.filesOpen ? 'VISIBLE' : 'HIDDEN');
    const provided = projectProvidedLibraries();
    const injected = CURATED_LIBRARIES.filter((library) => state.libraries.has(library.id) && !provided.has(library.id)).map((library) => library.name.toUpperCase());
    const projectLibs = CURATED_LIBRARIES.filter((library) => provided.has(library.id)).map((library) => `${library.name.toUpperCase()} · PROJECT`);
    const libs = [...injected, ...projectLibs];
    set('libraries', libs.length ? libs.join(', ') : 'NONE');
    const fonts = [...state.fonts].map((font) => String(font).toUpperCase());
    set('fonts', fonts.length ? fonts.join(', ') : 'NONE');
  }

  function openHelp() {
    closeToolsMenu();
    if (!libraryOverlay.hidden) closeLibraries({ restoreFocus: false });
    if (!helpOverlay) return;
    // Help must always open, even if a nonessential current-state field ever regresses.
    try { updateHelpCurrentState(); } catch (error) { console.warn('N7-Code help state unavailable', error); }
    closeCommands();
    closeFind();
    closeProjectMenu();
    helpOverlay.hidden = false;
    helpButton.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => helpClose?.focus());
  }

  function closeHelp({ restoreFocus = true } = {}) {
    if (!helpOverlay || helpOverlay.hidden) return;
    helpOverlay.hidden = true;
    helpButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) helpButton.focus();
  }

  function projectFeedback(label) {
    const original = 'PROJECT';
    projectButton.textContent = label;
    projectButton.classList.add('is-feedback');
    window.setTimeout(() => {
      projectButton.textContent = original;
      projectButton.classList.remove('is-feedback');
    }, 1200);
  }

  function projectRuntimeBundle() {
    if (!state.project || state.project.mode === 'simple') return null;
    const entryPath = state.project.entryHtmlPath || [...state.project.files.values()].find((item) => item.language === 'html')?.path;
    const entry = entryPath ? state.project.files.get(entryPath) : null;
    if (!entry || typeof entry.text !== 'string') return { headHtml: '', html: '', htmlAttrs: '', bodyAttrs: '', doctype: '<!doctype html>', compatScript: '' };

    const doc = new DOMParser().parseFromString(entry.text, 'text/html');
    const doctype = (entry.text.match(/<!doctype[^>]*>/i) || ['<!doctype html>'])[0];
    const textDataUrl = (text, mime, sourcePath = '') => {
      const source = sourcePath && /javascript/.test(mime)
        ? `${String(text || '')}\n//# sourceURL=mf-project/${sourcePath}`
        : String(text || '');
      return `data:${mime};charset=utf-8,${encodeURIComponent(source)}`;
    };
    const escapeAttr = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const serializeAttrs = (element) => [...(element?.attributes || [])].map((attr) => `${attr.name}="${escapeAttr(attr.value)}"`).join(' ');
    const splitRef = (reference) => {
      const raw = String(reference || '');
      const hashAt = raw.indexOf('#');
      const queryAt = raw.indexOf('?');
      let cut = raw.length;
      if (hashAt >= 0) cut = Math.min(cut, hashAt);
      if (queryAt >= 0) cut = Math.min(cut, queryAt);
      return { clean: raw.slice(0, cut), suffix: raw.slice(cut) };
    };
    const mimeForPath = (path) => {
      const ext = fileExtension({ name: path });
      if (ext === 'css') return 'text/css';
      if (ext === 'js' || ext === 'mjs') return 'text/javascript';
      if (ext === 'html' || ext === 'htm') return 'text/html';
      if (ext === 'json') return 'application/json';
      if (ext === 'svg') return 'image/svg+xml';
      if (ext === 'txt') return 'text/plain';
      return 'application/octet-stream';
    };
    const rawRuntimeUrl = (path) => {
      const record = state.project.files.get(path);
      if (!record) return null;
      if (typeof record.text === 'string') return textDataUrl(record.text, mimeForPath(path), /(?:js|mjs)$/i.test(path) ? path : '');
      return projectAssetUrl(path);
    };
    const withSuffix = (url, ref) => {
      if (!url) return null;
      const { suffix } = splitRef(ref);
      // Fragment identifiers matter for SVG <use>; cache-busting queries do not
      // change an in-memory project file, so preserve fragments and ignore query.
      const hash = suffix.includes('#') ? `#${suffix.split('#').slice(1).join('#')}` : '';
      return `${url}${hash}`;
    };

    const cssTextCache = new Map();
    const compileCssText = (path, stack = new Set()) => {
      if (cssTextCache.has(path)) return cssTextCache.get(path);
      const record = state.project.files.get(path);
      if (!record || typeof record.text !== 'string') return '';
      if (stack.has(path)) return '';
      const nextStack = new Set(stack); nextStack.add(path);
      let css = String(record.text || '');
      css = css.replace(/@import\s+(?:url\(\s*)?(["']?)([^"'\)\s;]+)\1\s*\)?([^;]*);/gi, (match, quote, ref, tail) => {
        const dep = resolveProjectPath(path, ref);
        const depRecord = dep ? state.project.files.get(dep) : null;
        if (!depRecord || depRecord.language !== 'css') return match;
        const imported = compileCssText(dep, nextStack);
        const media = String(tail || '').trim();
        return media ? `@media ${media} {\n${imported}\n}` : imported;
      });
      css = css.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (match, quote, rawRef) => {
        const ref = String(rawRef || '').trim();
        if (!ref || /^(?:data:|blob:|https?:|#|\/\/)/i.test(ref)) return match;
        const resolved = resolveProjectPath(path, ref);
        const url = resolved ? projectAssetUrl(resolved) : null;
        return url ? `url("${withSuffix(url, ref)}")` : match;
      });
      cssTextCache.set(path, css);
      return css;
    };

    const cssCache = new Map();
    const compileCss = (path, stack = new Set()) => {
      if (cssCache.has(path)) return cssCache.get(path);
      const record = state.project.files.get(path);
      if (!record || typeof record.text !== 'string') return projectAssetUrl(path);
      const css = compileCssText(path, stack);
      const url = textDataUrl(css, 'text/css', path);
      cssCache.set(path, url);
      return url;
    };

    const moduleCache = new Map();
    const moduleCompiling = new Set();
    const compileModule = (path) => {
      if (moduleCache.has(path)) return moduleCache.get(path);
      const record = state.project.files.get(path);
      if (!record || typeof record.text !== 'string') return projectAssetUrl(path);
      if (moduleCompiling.has(path)) {
        // Cyclic ESM graphs cannot be represented perfectly with data URLs in a
        // file://-hosted editor. Keep the module loadable and let diagnostics
        // report any cycle-dependent import that genuinely needs a real origin.
        return textDataUrl(`${record.text}\n//# sourceURL=mf-project/${path}`, 'text/javascript', path);
      }
      moduleCompiling.add(path);
      let code = String(record.text || '');
      const rewriteSpecifier = (ref) => {
        const dep = resolveProjectPath(path, ref);
        const depRecord = dep ? state.project.files.get(dep) : null;
        if (!depRecord || typeof depRecord.text !== 'string' || !/(?:js|mjs)$/i.test(dep)) return ref;
        return compileModule(dep) || ref;
      };
      code = code.replace(/(\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?)(['"])([^'"]+)\2/g, (m, lead, q, ref) => `${lead}${q}${rewriteSpecifier(ref)}${q}`);
      code = code.replace(/(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g, (m, lead, q, ref, tail) => `${lead}${q}${rewriteSpecifier(ref)}${q}${tail}`);
      code = code.replace(/new\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g, (m, q, ref) => {
        const dep = resolveProjectPath(path, ref);
        const url = dep ? rawRuntimeUrl(dep) : null;
        return url ? `new URL(${JSON.stringify(withSuffix(url, ref))})` : m;
      });
      const url = textDataUrl(`${code}\n//# sourceURL=mf-project/${path}`, 'text/javascript', path);
      moduleCache.set(path, url);
      moduleCompiling.delete(path);
      return url;
    };

    // Preview must not inherit a project's CSP because N7-Code injects its own
    // diagnostics/inspection bridge and in-memory data/blob resources.
    doc.querySelectorAll('meta[http-equiv]').forEach((meta) => {
      if ((meta.getAttribute('http-equiv') || '').toLowerCase() === 'content-security-policy') meta.remove();
    });
    // Relative/local <base> values point at about:srcdoc in an embedded preview,
    // which is never the opened project directory. Resources are virtualized below.
    doc.querySelectorAll('base[href]').forEach((base) => {
      const href = base.getAttribute('href') || '';
      if (!/^(?:https?:)?\/\//i.test(href)) base.remove();
    });

    const missingLocalStyles = [];
    const appliedLocalStyles = new Set();
    // Local stylesheets are converted in-place. Keeping each sheet at its
    // original DOM position preserves the page's authored cascade/order, which
    // is critical on multi-page sites where page-specific sheets intentionally
    // override shared/global CSS.
    let localStyleRefs = 0;
    const isExternalRef = (ref) => /^(?:data:|blob:|https?:|\/\/)/i.test(String(ref || ''));
    const resolveLocalStyleRecord = (ref) => {
      let path = resolveProjectPath(entryPath, ref);
      let record = path ? state.project.files.get(path) : null;
      if ((!record || record.language !== 'css') && !isExternalRef(ref)) {
        let cleanRef = String(ref || '').split('#')[0].split('?')[0];
        try { cleanRef = decodeURIComponent(cleanRef); } catch {}
        const baseName = cleanRef.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
        const matches = baseName
          ? [...state.project.files.values()].filter((item) => item.language === 'css' && item.name.toLowerCase() === baseName)
          : [];
        if (matches.length === 1) { record = matches[0]; path = record.path; }
      }
      return { path, record };
    };
    const captureLocalStylesheet = (link) => {
      const ref = link.getAttribute('href');
      if (!ref) return false;
      const { path, record } = resolveLocalStyleRecord(ref);
      if (record?.language === 'css' && typeof record.text === 'string') {
        const style = doc.createElement('style');
        style.setAttribute('data-mf-project-style', path);
        style.setAttribute('data-mf-original-href', ref);
        if (link.media) style.setAttribute('media', link.media);
        if (link.getAttribute('title')) style.setAttribute('title', link.getAttribute('title'));
        if (link.hasAttribute('disabled')) style.setAttribute('disabled', '');
        style.textContent = compileCssText(path);
        appliedLocalStyles.add(path);
        link.replaceWith(style);
        return true;
      }
      if (!isExternalRef(ref)) { missingLocalStyles.push(ref); link.remove(); }
      return false;
    };
    [...doc.querySelectorAll('link[href]')].forEach((link) => {
      const rel = (link.getAttribute('rel') || '').toLowerCase();
      const as = (link.getAttribute('as') || '').toLowerCase();
      const onload = (link.getAttribute('onload') || '').toLowerCase();
      const styleBearing = rel.split(/\s+/).includes('stylesheet') || (rel.split(/\s+/).includes('preload') && as === 'style') || onload.includes("rel='stylesheet'") || onload.includes('rel="stylesheet"') || onload.includes('rel=stylesheet');
      if (!styleBearing) return;
      if (!isExternalRef(link.getAttribute('href'))) localStyleRefs += 1;
      captureLocalStylesheet(link);
    });
    let fallbackStylePath = null;
    if (!appliedLocalStyles.size) {
      const cssFiles = [...state.project.files.values()].filter((item) => item.language === 'css' && typeof item.text === 'string');
      const preferredNames = ['style.css','styles.css','main.css','app.css','index.css','global.css'];
      const preferred = cssFiles.filter((item) => preferredNames.includes(item.name.toLowerCase()));
      const fallback = preferred.length === 1 ? preferred[0] : cssFiles.length === 1 ? cssFiles[0] : null;
      if (fallback) {
        const style = doc.createElement('style');
        style.setAttribute('data-mf-project-style', fallback.path);
        style.setAttribute('data-mf-fallback-style', 'true');
        style.textContent = compileCssText(fallback.path);
        // A fallback has no authored position because no usable stylesheet link
        // was found. Append it to the end of head so it behaves like a normal
        // late stylesheet rather than unexpectedly overriding from the front.
        doc.head?.appendChild(style);
        appliedLocalStyles.add(fallback.path);
        fallbackStylePath = fallback.path;
      }
    }

    // Inline module scripts also resolve relative specifiers against the HTML
    // page that contains them. In srcdoc/data-url previews the browser cannot do
    // that on its own, so virtualize those specifiers before serialization.
    const rewriteInlineModule = (code, basePath) => {
      const rewriteSpecifier = (ref) => {
        const dep = resolveProjectPath(basePath, ref);
        const depRecord = dep ? state.project.files.get(dep) : null;
        if (!depRecord || typeof depRecord.text !== 'string' || !/(?:js|mjs)$/i.test(dep)) return ref;
        return compileModule(dep) || ref;
      };
      let out = String(code || '');
      out = out.replace(/(\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?)(['"])([^'"]+)\2/g, (m, lead, q, ref) => `${lead}${q}${rewriteSpecifier(ref)}${q}`);
      out = out.replace(/(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g, (m, lead, q, ref, tail) => `${lead}${q}${rewriteSpecifier(ref)}${q}${tail}`);
      out = out.replace(/new\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g, (m, q, ref) => {
        const dep = resolveProjectPath(basePath, ref);
        const url = dep ? rawRuntimeUrl(dep) : null;
        return url ? `new URL(${JSON.stringify(withSuffix(url, ref))})` : m;
      });
      return out;
    };
    [...doc.querySelectorAll('script[type="module"]:not([src])')].forEach((script) => {
      script.textContent = rewriteInlineModule(script.textContent || '', entryPath);
    });

    // Preserve local scripts in their exact DOM position and preserve defer / async /
    // nomodule / type. Module scripts get their relative imports virtualized too.
    [...doc.querySelectorAll('script[src]')].forEach((script) => {
      const src = script.getAttribute('src');
      const path = src ? resolveProjectPath(entryPath, src) : null;
      const record = path ? state.project.files.get(path) : null;
      if (record && typeof record.text === 'string' && /(?:js|mjs)$/i.test(path)) {
        script.removeAttribute('integrity');
        const isModule = (script.getAttribute('type') || '').trim().toLowerCase() === 'module' || /\.mjs$/i.test(path);
        let scriptUrl;
        if (isModule) {
          scriptUrl = compileModule(path);
        } else {
          // Classic scripts can still use dynamic import() and import.meta-like
          // asset helpers through generated code. Rewriting dynamic imports here
          // prevents them from resolving relative to a data: URL.
          let code = String(record.text || '');
          code = code.replace(/(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g, (m, lead, q, ref, tail) => {
            const dep = resolveProjectPath(path, ref);
            const depRecord = dep ? state.project.files.get(dep) : null;
            const mapped = depRecord && typeof depRecord.text === 'string' && /(?:js|mjs)$/i.test(dep) ? compileModule(dep) : null;
            return mapped ? `${lead}${q}${mapped}${q}${tail}` : m;
          });
          scriptUrl = textDataUrl(code, 'text/javascript', path);
        }
        script.setAttribute('src', scriptUrl);
        script.setAttribute('data-mf-original-src', src);
      }
    });

    // modulepreload / preload entries should point at the same in-memory files as
    // the scripts/styles they are warming up.
    [...doc.querySelectorAll('link[href]')].forEach((link) => {
      if (link.matches('link[rel~="stylesheet"]')) return;
      const rel = (link.getAttribute('rel') || '').toLowerCase();
      const as = (link.getAttribute('as') || '').toLowerCase();
      if (!/(?:modulepreload|preload|icon)/.test(rel)) return;
      const ref = link.getAttribute('href');
      const path = resolveProjectPath(entryPath, ref);
      const record = path ? state.project.files.get(path) : null;
      if (!record) return;
      let url = null;
      if (rel.includes('modulepreload') && typeof record.text === 'string') url = compileModule(path);
      else if (as === 'style' && record.language === 'css') url = compileCss(path);
      else url = rawRuntimeUrl(path);
      if (url) { link.removeAttribute('integrity'); link.setAttribute('href', withSuffix(url, ref)); }
    });

    const rewriteAsset = (element, attribute) => {
      const ref = element.getAttribute(attribute);
      if (!ref || /^(?:data:|blob:|https?:|#|\/\/)/i.test(ref)) return;
      const path = resolveProjectPath(entryPath, ref);
      const url = path ? rawRuntimeUrl(path) : null;
      if (url) element.setAttribute(attribute, withSuffix(url, ref));
    };
    doc.querySelectorAll('[src],[poster],[data]').forEach((element) => {
      if (element.tagName !== 'SCRIPT') rewriteAsset(element, 'src');
      rewriteAsset(element, 'poster');
      if (['OBJECT'].includes(element.tagName)) rewriteAsset(element, 'data');
    });
    doc.querySelectorAll('use[href],image[href]').forEach((element) => rewriteAsset(element, 'href'));
    doc.querySelectorAll('[srcset]').forEach((element) => {
      const value = element.getAttribute('srcset') || '';
      const rewritten = value.split(',').map((candidate) => {
        const bits = candidate.trim().split(/\s+/);
        const ref = bits.shift();
        if (!ref) return candidate;
        const path = resolveProjectPath(entryPath, ref);
        const url = path ? rawRuntimeUrl(path) : null;
        return [url ? withSuffix(url, ref) : ref, ...bits].join(' ');
      }).join(', ');
      element.setAttribute('srcset', rewritten);
    });

    const manifest = {};
    state.project.files.forEach((record, path) => {
      const url = record.language === 'css' && typeof record.text === 'string' ? compileCss(path) : rawRuntimeUrl(path);
      if (url) manifest[path] = url;
    });
    const manifestJson = JSON.stringify(manifest).replace(/</g, '\\u003c');
    const entryJson = JSON.stringify(entryPath);
    const compatScript = `<script data-mf-internal>\n(() => {\n  const files = ${manifestJson};\n  const entryPath = ${entryJson};\n  const missingLocalStyles = ${JSON.stringify(missingLocalStyles).replace(/</g, '\\u003c')};\n  if (missingLocalStyles.length) {\n    queueMicrotask(() => window.parent?.postMessage?.({ source:'mf-preview', type:'resource-error', renderId:${state.renderId}, message:'MISSING STYLESHEET · '+missingLocalStyles.join(', ') }, '*'));\n  }\n  const fallbackStylePath = ${JSON.stringify(fallbackStylePath)};\n  window.__mfStyleExpectation = { localRefs:${localStyleRefs}, applied:${appliedLocalStyles.size}, fallback:Boolean(fallbackStylePath) };\n  if (fallbackStylePath) queueMicrotask(() => window.parent?.postMessage?.({ source:'mf-preview', type:'resource-warning', renderId:${state.renderId}, message:'PREVIEW FALLBACK STYLE · '+fallbackStylePath }, '*'));\n  const normalize = (value) => { const out=[]; String(value||'').replace(/\\\\/g,'/').split('/').forEach(p=>{if(!p||p==='.')return;if(p==='..')out.pop();else out.push(p)}); return out.join('/'); };\n  const resolve = (raw) => {\n    const ref=String(raw||'').trim();\n    if(!ref || /^(?:[a-z]+:|#|\\/\\/)/i.test(ref)) return null;\n    const clean=ref.split('#')[0].split('?')[0];\n    const base=clean.startsWith('/')?'':(entryPath.includes('/')?entryPath.slice(0,entryPath.lastIndexOf('/')+1):'');\n    const path=normalize((clean.startsWith('/')?'':base)+clean.replace(/^\\//,''));\n    const url=files[path];\n    if(!url) return null;\n    const hash=ref.includes('#')?'#'+ref.split('#').slice(1).join('#'):'';\n    return url+hash;\n  };\n  window.__mfResolveProjectUrl = resolve;\n  const remapResourceNode=(node)=>{if(!(node instanceof Element)||node.hasAttribute('data-mf-internal'))return;const tag=node.tagName;const remap=(name)=>{const value=node.getAttribute(name);if(!value)return;const mapped=resolve(value);if(mapped&&mapped!==value)node.setAttribute(name,mapped);};if(tag==='LINK')remap('href');if(['SCRIPT','IMG','SOURCE','VIDEO','AUDIO','IFRAME'].includes(tag))remap('src');if(tag==='OBJECT')remap('data');if(tag==='USE'||tag==='IMAGE')remap('href');};\n  const resourceObserver=new MutationObserver((records)=>records.forEach((record)=>{if(record.type==='attributes')remapResourceNode(record.target);record.addedNodes?.forEach((node)=>{if(!(node instanceof Element))return;remapResourceNode(node);node.querySelectorAll?.('link[href],script[src],img[src],source[src],video[src],audio[src],iframe[src],object[data],use[href],image[href]').forEach(remapResourceNode);});}));\n  resourceObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href','src','data']});\n  const nativeFetch=window.fetch?.bind(window);\n  if(nativeFetch) window.fetch=(input,init)=>{\n    try {\n      if(typeof input==='string' || input instanceof URL){ const mapped=resolve(String(input)); if(mapped) return nativeFetch(mapped,init); }\n      else if(input instanceof Request){ const mapped=resolve(input.url); if(mapped) return nativeFetch(new Request(mapped,input),init); }\n    } catch {}\n    return nativeFetch(input,init);\n  };\n  const XHR=window.XMLHttpRequest;\n  if(XHR){ const open=XHR.prototype.open; XHR.prototype.open=function(method,url,...rest){ return open.call(this,method,resolve(url)||url,...rest); }; }\n  const NativeWorker=window.Worker;\n  if(NativeWorker){ window.Worker=function(url,options){ return new NativeWorker(resolve(url)||url,options); }; window.Worker.prototype=NativeWorker.prototype; }\n  const NativeSharedWorker=window.SharedWorker;\n  if(NativeSharedWorker){ window.SharedWorker=function(url,options){ return new NativeSharedWorker(resolve(url)||url,options); }; window.SharedWorker.prototype=NativeSharedWorker.prototype; }\n})();\n<\\/script>`;

    return {
      doctype,
      htmlAttrs: serializeAttrs(doc.documentElement),
      bodyAttrs: serializeAttrs(doc.body),
      headHtml: doc.head?.innerHTML || '',
      styleHtml: '',
      html: doc.body?.innerHTML || '',
      compatScript
    };
  }


  function exportStandaloneHtml() {
    const blob = new Blob([buildExportDocument()], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'index.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    previewActionFeedback(exportButton, 'EXPORTED');
  }

  function applyProjectCode(code) {
    if (!validCode(code) || sameCode(state.code, code)) return;
    recordHistory('project', false);
    breakHistoryCoalescing();
    state.code = { ...code };
    refreshVisibleEditors();
    populateAllEditors();
    persistDraftNow();
    renderPreview();
  }

  function fileExtension(file) {
    const name = file?.name || '';
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  }

  function extractStandaloneHtml(source) {
    const parser = new DOMParser();
    const document = parser.parseFromString(source, 'text/html');
    const styles = [...document.querySelectorAll('style')];
    const scripts = [...document.querySelectorAll('script:not([src])')];
    const css = styles.map((node) => node.textContent || '').join('\n\n').trim();
    const js = scripts.map((node) => node.textContent || '').join('\n\n').trim();
    styles.forEach((node) => node.remove());
    scripts.forEach((node) => node.remove());

    const html = (document.body?.innerHTML || '').trim();
    return { html, css, js };
  }

  function disarmReset() {
    window.clearTimeout(state.resetTimer);
    resetAction.classList.remove('is-armed');
    resetAction.textContent = 'RESET';
  }


  /* Real project model ----------------------------------------------------- */
  const EDITABLE_EXTENSIONS = new Set(['html', 'htm', 'css', 'js', 'mjs']);
  const ASSET_URLS = new Map();

  function projectLanguage(path) {
    const extension = fileExtension({ name: path });
    if (extension === 'html' || extension === 'htm') return 'html';
    if (extension === 'css') return 'css';
    if (extension === 'js' || extension === 'mjs') return 'js';
    return null;
  }

  function normalizeProjectPath(path) {
    const parts = String(path || '').replace(/\\/g, '/').split('/');
    const output = [];
    parts.forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') output.pop();
      else output.push(part);
    });
    return output.join('/');
  }

  function resolveProjectPath(fromPath, reference) {
    const raw = String(reference || '').trim();
    if (!raw || /^(?:[a-z]+:|#|\/\/)/i.test(raw)) return null;
    let clean = raw.split('#')[0].split('?')[0];
    if (!clean) return null;
    // Browsers decode URL-escaped path segments before filesystem lookup. Mirror
    // that behavior, but never let a malformed escape break preview compilation.
    try { clean = decodeURIComponent(clean); } catch {}
    const base = clean.startsWith('/')
      ? ''
      : (fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '');
    const candidate = normalizeProjectPath(base + clean.replace(/^\//, ''));
    if (!candidate) return null;
    // Exact match first. Then tolerate case differences the same way many local
    // macOS/Windows project folders do. This matters for CSS/assets authored on
    // case-insensitive filesystems and later previewed in our in-memory map.
    if (state.project?.files?.has(candidate)) return candidate;
    const lower = candidate.toLowerCase();
    const insensitive = state.project?.files
      ? [...state.project.files.keys()].find((path) => path.toLowerCase() === lower)
      : null;
    return insensitive || candidate;
  }

  function simpleProjectFromCode() {
    const files = new Map([
      ['index.html', { path: 'index.html', name: 'index.html', language: 'html', text: state.code.html, file: null, handle: null, dirty: false }],
      ['style.css', { path: 'style.css', name: 'style.css', language: 'css', text: state.code.css, file: null, handle: null, dirty: false }],
      ['script.js', { path: 'script.js', name: 'script.js', language: 'js', text: state.code.js, file: null, handle: null, dirty: false }]
    ]);
    return {
      mode: 'simple',
      name: 'PROJECT',
      files,
      activePath: state.view === 'css' ? 'style.css' : state.view === 'js' ? 'script.js' : 'index.html',
      entryHtmlPath: 'index.html',
      lastByLanguage: { html: 'index.html', css: 'style.css', js: 'script.js' },
      directoryHandle: null,
      detached: false
    };
  }

  function serializeCurrentProject() {
    if (!state.project || state.project.mode === 'simple') {
      return { mode: 'simple', name: 'PROJECT', code: { ...state.code }, addons: addonSnapshot() };
    }
    return {
      mode: 'folder',
      name: state.project.name,
      activePath: state.project.activePath,
      entryHtmlPath: state.project.entryHtmlPath,
      lastByLanguage: { ...state.project.lastByLanguage },
      collapsedFolders: [...state.collapsedFolders],
      addons: addonSnapshot(),
      files: [...state.project.files.values()].map((record) => ({
        path: record.path,
        language: record.language,
        text: typeof record.text === 'string' ? record.text : null,
        type: record.file?.type || '',
        editable: Boolean(record.language)
      }))
    };
  }

  function restoreProjectSnapshot(snapshot) {
    if (!snapshot || snapshot.mode === 'simple') {
      if (validCode(snapshot?.code)) state.code = { ...snapshot.code };
      state.project = simpleProjectFromCode();
      beginProjectSession(state.project, { clearPreview: false });
      applyAddonSnapshot(snapshot?.addons || null);
      return;
    }
    if (snapshot.mode !== 'folder' || !Array.isArray(snapshot.files)) {
      state.project = simpleProjectFromCode();
      beginProjectSession(state.project, { clearPreview: false });
      return;
    }
    const files = new Map();
    snapshot.files.forEach((item) => {
      const path = normalizeProjectPath(item.path);
      if (!path) return;
      files.set(path, {
        path,
        name: path.split('/').pop(),
        language: projectLanguage(path),
        text: typeof item.text === 'string' ? item.text : null,
        file: null,
        handle: null,
        dirty: false
      });
    });
    state.project = {
      mode: 'folder',
      name: snapshot.name || 'PROJECT',
      files,
      activePath: files.has(snapshot.activePath) ? snapshot.activePath : null,
      entryHtmlPath: files.has(snapshot.entryHtmlPath) ? snapshot.entryHtmlPath : null,
      lastByLanguage: snapshot.lastByLanguage || {},
      directoryHandle: null,
      detached: true,
      runtimeId: null
    };
    beginProjectSession(state.project, { clearPreview: false });
    state.collapsedFolders = restoreTreeStateForProject(state.project, snapshot.collapsedFolders);
    applyAddonSnapshot(snapshot.addons || state.addonStates[addonProjectKey(state.project)] || null);
    state.code = { html: '', css: '', js: '' };
    ['html','css','js'].forEach((language) => {
      const preferred = state.project.lastByLanguage[language];
      const record = (preferred && files.get(preferred)?.language === language) ? files.get(preferred) : [...files.values()].find((item) => item.language === language);
      if (record && typeof record.text === 'string') { state.code[language] = record.text; state.project.lastByLanguage[language] = record.path; }
    });
    const firstHtml = [...files.values()].find((item) => item.language === 'html');
    const firstEditable = [...files.values()].find((item) => item.language);
    if (!state.project.entryHtmlPath && firstHtml) state.project.entryHtmlPath = firstHtml.path;
    if (!state.project.activePath && firstEditable) state.project.activePath = firstEditable.path;
    if (state.project.activePath) syncActiveProjectFileToEditor(false);
  }

  function restoreLocalState() {
    const storedTreeStates = safeJsonParse(safeStorageGet(STORAGE.tree));
    if (storedTreeStates && typeof storedTreeStates === 'object' && !Array.isArray(storedTreeStates)) state.treeStates = storedTreeStates;
    const storedAddonStates = safeJsonParse(safeStorageGet(STORAGE.addons));
    if (storedAddonStates && typeof storedAddonStates === 'object' && !Array.isArray(storedAddonStates)) state.addonStates = storedAddonStates;

    const draft = safeJsonParse(safeStorageGet(STORAGE.draft));
    if (validCode(draft?.code)) state.code = { ...draft.code };
    if (draft?.project) restoreProjectSnapshot(draft.project);
    else { state.project = simpleProjectFromCode(); beginProjectSession(state.project, { clearPreview: false }); }
    restoreAddonsForProject(draft?.project?.addons || draft?.addons || null);

    const prefs = safeJsonParse(safeStorageGet(STORAGE.prefs));
    if (prefs) {
      if (['html', 'css', 'js', 'all'].includes(prefs.view)) state.view = prefs.view;
      if (['light', 'dark'].includes(prefs.theme)) state.theme = prefs.theme;
      if (['geist', 'jetbrains'].includes(prefs.font)) state.font = prefs.font;
      if (['desktop', 'tablet', 'mobile'].includes(prefs.previewSize)) state.previewSize = prefs.previewSize;
      if (typeof prefs.filesOpen === 'boolean') state.filesOpen = prefs.filesOpen;
      if (Number.isFinite(prefs.filesWidth)) state.filesWidth = clamp(prefs.filesWidth, 164, 480);
      if (Number.isFinite(prefs.editorWidth)) workspace.style.setProperty('--editor-width', `${prefs.editorWidth}px`);
    }

    const history = safeJsonParse(safeStorageGet(STORAGE.history));
    if (history) {
      const validEntries = (entries) => Array.isArray(entries) ? entries.filter(validCode).slice(-HISTORY_LIMIT).map((code) => ({ ...code })) : [];
      state.history.past = validEntries(history.past);
      state.history.future = validEntries(history.future);
    }
  }

  function persistDraftSoon() {
    window.clearTimeout(state.draftTimer);
    state.draftTimer = window.setTimeout(persistDraftNow, SAVE_DELAY);
  }

  function persistDraftNow() {
    window.clearTimeout(state.draftTimer);
    safeStorageSet(STORAGE.draft, JSON.stringify({ code: state.code, project: serializeCurrentProject() }));
  }

  function activeProjectRecord() {
    return state.project?.activePath ? state.project.files.get(state.project.activePath) || null : null;
  }


  function setSingleEditor(language) {
    setEditorValue(singleEditor, language, state.code[language]);
    const record = state.project?.mode === 'folder' ? activeProjectRecord() : null;
    footerLanguage.textContent = record?.language === language ? record.name.toUpperCase() : language.toUpperCase();
  }

  function syncActiveProjectFileToEditor(render = true) {
    if (!state.project || state.project.mode !== 'folder') return;
    const record = activeProjectRecord();
    if (!record?.language || typeof record.text !== 'string') return;
    state.project.lastByLanguage[record.language] = record.path;
    state.code[record.language] = record.text;
    state.view = record.language;
    if (render) applyView(record.language, true);
    else {
      setSingleEditor(record.language);
      footerLanguage.textContent = record.name.toUpperCase();
    }
  }

  function updateCode(language, value, container, options = {}) {
    if (value === state.code[language]) {
      syncEditor(container, language);
      return;
    }
    recordHistory(language, Boolean(options.coalesce));
    state.code[language] = value;
    if (state.project?.mode === 'folder') {
      const record = activeProjectRecord();
      if (record?.language === language) {
        record.text = value;
        record.dirty = true;
      }
    } else if (state.project?.mode === 'simple') {
      const path = language === 'html' ? 'index.html' : language === 'css' ? 'style.css' : 'script.js';
      const record = state.project.files.get(path);
      if (record) record.text = value;
    }
    if (language === 'js') state.errorLine.js = null;
    updateDiagnostics(language);
    syncEditor(container, language);
    persistDraftSoon();
    requestPreviewUpdate(language);
  }

  function applyHistorySnapshot(code) {
    state.code = { ...code };
    if (state.project?.mode === 'folder') {
      const record = activeProjectRecord();
      if (record?.language && typeof state.code[record.language] === 'string') {
        record.text = state.code[record.language];
        record.dirty = true;
      }
    } else if (state.project?.mode === 'simple') {
      ['html','css','js'].forEach((language) => {
        const path = language === 'html' ? 'index.html' : language === 'css' ? 'style.css' : 'script.js';
        const record = state.project.files.get(path);
        if (record) record.text = state.code[language];
      });
    }
    state.errorLine = { html: null, css: null, js: null };
    refreshVisibleEditors();
    populateAllEditors();
    persistDraftNow();
    renderPreview();
  }

  function clearProjectHistory() {
    state.history.past = [];
    state.history.future = [];
    breakHistoryCoalescing();
    persistHistoryNow();
  }

  function renderFileTree() {
    if (!state.project) { state.project = simpleProjectFromCode(); beginProjectSession(state.project, { clearPreview: false }); }
    fileTreeTitle.textContent = state.project.name.toUpperCase();
    fileTreeList.innerHTML = '';
    const files = [...state.project.files.values()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    const root = { folders: new Map(), files: [] };

    files.forEach((record) => {
      const parts = record.path.split('/');
      let node = root;
      parts.slice(0, -1).forEach((folder) => {
        if (!node.folders.has(folder)) node.folders.set(folder, { folders: new Map(), files: [] });
        node = node.folders.get(folder);
      });
      node.files.push(record);
    });

    const appendNode = (node, depth, prefix) => {
      [...node.folders.entries()].sort(([a],[b]) => a.localeCompare(b)).forEach(([name, child]) => {
        const path = prefix ? `${prefix}/${name}` : name;
        const collapsed = state.collapsedFolders.has(path);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `file-tree-row is-folder${collapsed ? ' is-collapsed' : ''}`;
        row.style.paddingLeft = `${9 + depth * 12}px`;
        row.dataset.folderPath = path;
        row.innerHTML = `<span class="file-tree-caret">›</span><span class="file-tree-name">${escapeHtml(name)}</span>`;
        fileTreeList.appendChild(row);
        if (!collapsed) appendNode(child, depth + 1, path);
      });

      node.files.sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true })).forEach((record) => {
        const editable = Boolean(record.language);
        const row = document.createElement(editable ? 'button' : 'div');
        if (editable) row.type = 'button';
        row.className = `file-tree-row${editable ? '' : ' is-muted'}${record.path === state.project.activePath ? ' is-active' : ''}`;
        row.style.paddingLeft = `${9 + depth * 12}px`;
        row.dataset.filePath = record.path;
        row.innerHTML = `<span class="file-tree-spacer"></span><span class="file-tree-name">${escapeHtml(record.name)}</span>`;
        fileTreeList.appendChild(row);
      });
    };

    appendNode(root, 0, '');
    const editableCount = files.filter((file) => file.language).length;
    fileTreeFooter.textContent = `${files.length} FILE${files.length === 1 ? '' : 'S'}${editableCount !== files.length ? ` · ${editableCount} EDITABLE` : ''}`;
  }

  function updateFileTreeActive() {
    if (!fileTreeList) return;
    fileTreeList.querySelectorAll('[data-file-path]').forEach((item) => item.classList.toggle('is-active', item.dataset.filePath === state.project?.activePath));
  }

  function applyFilesOpen(active) {
    state.filesOpen = Boolean(active);
    workspace.classList.toggle('has-files', state.filesOpen);
    filesButton.classList.toggle('is-active', state.filesOpen);
    filesButton.setAttribute('aria-pressed', String(state.filesOpen));
    filesButton.setAttribute('aria-label', state.filesOpen ? 'Hide project files' : 'Show project files');
    fileTree.setAttribute('aria-hidden', String(!state.filesOpen));
    workspace.style.setProperty('--tree-width', `${state.filesWidth}px`);
    renderFileTree();
  }

  function activateProjectFile(path, { animate = true } = {}) {
    const record = state.project?.files.get(path);
    if (!record?.language || typeof record.text !== 'string') return false;
    state.project.activePath = path;
    state.project.lastByLanguage[record.language] = path;
    if (record.language === 'html') {
      state.project.entryHtmlPath = path;
      // Entry pages own their own preview session. Switching HTML files inside the
      // same folder project must never reuse CSS/runtime state from the previous page.
      window.clearTimeout(state.previewTimer);
      state.cssUpdateId += 1;
      beginProjectSession(state.project, { clearPreview: false });
    }
    state.code[record.language] = record.text;
    clearProjectHistory();
    applyView(record.language, animate);
    footerLanguage.textContent = record.name.toUpperCase();
    renderFileTree();
    persistDraftNow();
    renderPreview();
    return true;
  }

  function switchView(nextView) {
    if (state.project?.mode === 'folder' && nextView !== 'all') {
      const preferred = state.project.lastByLanguage[nextView];
      const fallback = [...state.project.files.values()].find((item) => item.language === nextView)?.path;
      if (preferred || fallback) {
        activateProjectFile(preferred || fallback);
        persistPrefs();
      }
      return;
    }
    if (nextView === state.view) return;
    applyView(nextView, true);
    persistPrefs();
  }

  function projectAssetUrl(path) {
    const record = state.project?.files.get(path);
    if (!record?.file) return null;
    const previous = ASSET_URLS.get(path);
    if (previous) return previous;
    const url = URL.createObjectURL(record.file);
    ASSET_URLS.set(path, url);
    return url;
  }

  function rewriteCssAssetUrls(css, cssPath) {
    return String(css || '').replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (match, quote, ref) => {
      const resolved = resolveProjectPath(cssPath, ref);
      if (!resolved) return match;
      const url = projectAssetUrl(resolved);
      return url ? `url("${url}")` : match;
    });
  }

  function projectPreviewBundle() {
    if (!state.project || state.project.mode === 'simple') return { headHtml: '', ...state.code };
    const entryPath = state.project.entryHtmlPath || [...state.project.files.values()].find((item) => item.language === 'html')?.path;
    const entry = entryPath ? state.project.files.get(entryPath) : null;
    if (!entry || typeof entry.text !== 'string') return { html: '', css: '', js: '' };

    const doc = new DOMParser().parseFromString(entry.text, 'text/html');
    const cssParts = [];
    const jsParts = [];

    [...doc.querySelectorAll('style')].forEach((style) => { cssParts.push(style.textContent || ''); style.remove(); });
    [...doc.querySelectorAll('link[rel~="stylesheet"][href]')].forEach((link) => {
      const path = resolveProjectPath(entryPath, link.getAttribute('href'));
      const record = path ? state.project.files.get(path) : null;
      if (record?.language === 'css' && typeof record.text === 'string') {
        cssParts.push(rewriteCssAssetUrls(record.text, path));
        link.remove();
      }
    });
    [...doc.querySelectorAll('script')].forEach((script) => {
      const src = script.getAttribute('src');
      if (src) {
        const path = resolveProjectPath(entryPath, src);
        const record = path ? state.project.files.get(path) : null;
        if (record?.language === 'js' && typeof record.text === 'string') {
          jsParts.push(record.text);
          script.remove();
        }
      } else {
        jsParts.push(script.textContent || '');
        script.remove();
      }
    });

    const assetAttributes = ['src','poster'];
    doc.querySelectorAll('[src],[poster]').forEach((element) => {
      assetAttributes.forEach((attribute) => {
        const ref = element.getAttribute(attribute);
        if (!ref) return;
        const path = resolveProjectPath(entryPath, ref);
        const url = path ? projectAssetUrl(path) : null;
        if (url) element.setAttribute(attribute, url);
      });
    });

    return {
      headHtml: doc.head?.innerHTML || '',
      html: doc.body?.innerHTML || '',
      css: cssParts.join('\n\n'),
      js: jsParts.join('\n\n')
    };
  }

  function buildExportDocument() {
    const bundle = projectPreviewBundle();
    const safeCss = bundle.css.replace(/<\/style/gi, '<\\/style');
    const safeScript = bundle.js.replace(/<\/script/gi, '<\\/script');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${safeCss}
</style>
</head>
<body>
${bundle.html}
<script>
${safeScript}
<\/script>
</body>
</html>`;
  }

  function buildPreviewDocument(renderId) {
    if (state.project?.mode === 'folder') {
      const runtime = projectRuntimeBundle();
      const previewHtml = annotateHtmlForPreview(runtime?.html || '');
      const htmlAttrs = runtime?.htmlAttrs ? ` ${runtime.htmlAttrs}` : '';
      const bodyAttrs = runtime?.bodyAttrs ? ` ${runtime.bodyAttrs}` : '';
      return `${runtime?.doctype || '<!doctype html>'}
<html${htmlAttrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style data-mf-internal>html,body{min-height:100%;}</style>
${runtime?.styleHtml || ''}
${previewBridge(renderId)}
${runtime?.compatScript || ''}
${addonHeadHtml()}
${runtime?.headHtml || ''}
</head>
<body${bodyAttrs}>
${previewHtml}
<script data-mf-internal>window.__mfPrepareInspect();<\/script>
</body>
</html>`;
    }

    const bundle = projectPreviewBundle();
    const userScript = JSON.stringify(bundle.js).replace(/<\/script/gi, '<\\/script');
    const previewHtml = annotateHtmlForPreview(bundle.html);
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{min-height:100%;}html{background:transparent;}body{background:transparent;}</style>
${previewBridge(renderId)}
${addonHeadHtml()}
${bundle.headHtml || ''}
<style id="mf-user-style">${bundle.css}</style>
</head>
<body>
${previewHtml}
<script data-mf-internal>(async()=>{window.__mfPrepareInspect();await Promise.all(window.__mfLibPromises||[]);window.__mfRun(${userScript});})();<\/script>
</body>
</html>`;
  }

  function requestPreviewUpdate(language) {
    window.clearTimeout(state.previewTimer);
    setLiveState('UPDATING');
    state.previewTimer = window.setTimeout(() => {
      if (state.project?.mode === 'simple' && language === 'css') injectPreviewCss();
      else renderPreview();
    }, PREVIEW_DELAY);
  }

  function createProjectPayload() {
    if (!state.project || state.project.mode === 'simple') {
      return { format: PROJECT_FORMAT, version: PROJECT_VERSION, code: { ...state.code }, addons: addonSnapshot() };
    }
    return { format: PROJECT_FORMAT, version: 2, project: serializeCurrentProject() };
  }

  async function ensureFileHandleForPath(path) {
    if (!state.project?.directoryHandle) return null;
    const parts = normalizeProjectPath(path).split('/');
    const filename = parts.pop();
    let directory = state.project.directoryHandle;
    for (const folder of parts) directory = await directory.getDirectoryHandle(folder, { create: true });
    return directory.getFileHandle(filename, { create: true });
  }

  async function saveFolderProjectToDisk() {
    if (!state.project || state.project.mode !== 'folder') return false;
    if (!state.project.directoryHandle) return false;
    const dirty = [...state.project.files.values()].filter((record) => record.dirty);
    try {
      for (const record of dirty) {
        if (!record.handle) record.handle = await ensureFileHandleForPath(record.path);
        if (!record.handle) throw new Error('No file handle');
        const stream = await record.handle.createWritable();
        await stream.write(record.language ? (record.text || '') : record.file);
        await stream.close();
        record.dirty = false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function saveProject() {
    if (state.project?.mode === 'folder' && await saveFolderProjectToDisk()) {
      closeProjectMenu();
      projectFeedback('SAVED');
      showProjectSwitchToast('PROJECT SAVED TO FOLDER');
      persistDraftNow();
      return;
    }
    downloadProjectSnapshot();
    closeProjectMenu();
    projectFeedback('BACKUP');
    showProjectSwitchToast('N7-CODE BACKUP DOWNLOADED');
  }

  let switchToastTimer = null;
  function showProjectSwitchToast(message) {
    if (switchToastTimer) window.clearTimeout(switchToastTimer);
    switchToast.textContent = message;
    switchToast.hidden = false;
    requestAnimationFrame(() => switchToast.classList.add('is-visible'));
    switchToastTimer = window.setTimeout(() => {
      switchToast.classList.remove('is-visible');
      window.setTimeout(() => { switchToast.hidden = true; }, 520);
    }, 2600);
  }

  function downloadProjectSnapshot() {
    const blob = new Blob([JSON.stringify(createProjectPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(state.project?.name || 'project').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'project'}.n7-code`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    return true;
  }

  async function saveBeforeProjectSwitch() {
    persistDraftNow();
    if (state.project?.mode === 'folder' && state.project.directoryHandle) {
      const savedToFolder = await saveFolderProjectToDisk();
      if (savedToFolder) return { saved: true, destination: 'folder' };
    }
    const kept = saveRecoverySnapshot();
    return { saved: kept, destination: kept ? 'local' : 'failed' };
  }

  function projectSwitchMessage(previous) {
    if (previous?.destination === 'folder') return 'PREVIOUS PROJECT SAVED · NEW PROJECT OPENED';
    if (previous?.destination === 'local') return 'PREVIOUS CHANGES KEPT LOCALLY · NEW PROJECT OPENED';
    return 'COULDN’T SAVE PREVIOUS CHANGES · NEW PROJECT OPENED';
  }

  function startSimpleProject(code = STARTER_CODE, addons = null) {
    ASSET_URLS.forEach((url) => URL.revokeObjectURL(url));
    ASSET_URLS.clear();
    state.code = { ...code };
    state.project = simpleProjectFromCode();
    beginProjectSession(state.project);
    applyAddonSnapshot(addons);
    state.addonStates.simple = addonSnapshot();
    state.view = 'html';
    clearProjectHistory();
    refreshVisibleEditors();
    populateAllEditors();
    renderFileTree();
    persistDraftNow();
    renderPreview();
    applyView('html', true);
  }

  function recordsFromFiles(files, { rootName = '' } = {}) {
    const records = [];
    [...files].forEach((file) => {
      const relative = file.webkitRelativePath || file.__mfRelativePath || file.name;
      let path = normalizeProjectPath(relative);
      if (rootName && path.startsWith(`${rootName}/`)) path = path.slice(rootName.length + 1);
      const language = projectLanguage(path);
      records.push({ path, name: path.split('/').pop(), language, text: null, file, handle: file.__mfHandle || null, dirty: false });
    });
    return records;
  }

  async function hydrateTextRecords(records) {
    await Promise.all(records.map(async (record) => {
      if (record.language) record.text = await record.file.text();
    }));
    return records;
  }

  async function installFolderProject(name, records, directoryHandle = null) {
    ASSET_URLS.forEach((url) => URL.revokeObjectURL(url));
    ASSET_URLS.clear();
    await hydrateTextRecords(records);
    const files = new Map(records.filter((record) => record.path).map((record) => [record.path, record]));
    const firstHtml = [...files.values()].find((item) => item.language === 'html');
    const firstEditable = firstHtml || [...files.values()].find((item) => item.language);
    state.code = { html: '', css: '', js: '' };
    state.project = {
      mode: 'folder',
      name: name || 'PROJECT',
      files,
      activePath: firstEditable?.path || null,
      entryHtmlPath: firstHtml?.path || null,
      lastByLanguage: {},
      directoryHandle,
      detached: !directoryHandle,
      runtimeId: null
    };
    beginProjectSession(state.project);
    state.collapsedFolders = restoreTreeStateForProject(state.project);
    restoreAddonsForProject();
    persistTreeState();
    if (firstEditable) {
      state.project.lastByLanguage[firstEditable.language] = firstEditable.path;
      state.code[firstEditable.language] = firstEditable.text;
      state.view = firstEditable.language;
    }
    ['html','css','js'].forEach((language) => {
      const record = [...files.values()].find((item) => item.language === language);
      if (record) {
        state.project.lastByLanguage[language] ||= record.path;
        state.code[language] = record.text;
      }
    });
    clearProjectHistory();
    applyFilesOpen(true);
    renderFileTree();
    applyView(state.view, false);
    if (firstEditable) footerLanguage.textContent = firstEditable.name.toUpperCase();
    persistPrefs();
    persistDraftNow();
    renderPreview();
    projectFeedback('OPENED');
  }

  async function enumerateDirectoryHandle(handle, prefix = '') {
    const records = [];
    for await (const [name, child] of handle.entries()) {
      const path = normalizeProjectPath(prefix ? `${prefix}/${name}` : name);
      if (child.kind === 'directory') records.push(...await enumerateDirectoryHandle(child, path));
      else {
        const file = await child.getFile();
        file.__mfHandle = child;
        file.__mfRelativePath = path;
        records.push({ path, name, language: projectLanguage(path), text: null, file, handle: child, dirty: false });
      }
    }
    return records;
  }

  async function openFolderPicker() {
    closeProjectMenu();
    if (window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const records = await enumerateDirectoryHandle(handle);
        const previous = await saveBeforeProjectSwitch();
        await installFolderProject(handle.name, records, handle);
        showProjectSwitchToast(projectSwitchMessage(previous));
      } catch (error) {
        if (error?.name !== 'AbortError') projectFeedback('FAILED');
      }
      return;
    }
    projectFolderInput.click();
  }

  async function openFolderInput(files) {
    const selected = [...(files || [])];
    if (!selected.length) return;
    const firstPath = selected[0].webkitRelativePath || selected[0].name;
    const rootName = firstPath.includes('/') ? firstPath.split('/')[0] : 'PROJECT';
    const records = recordsFromFiles(selected, { rootName });
    const previous = await saveBeforeProjectSwitch();
    await installFolderProject(rootName, records, null);
    projectFolderInput.value = '';
    showProjectSwitchToast(projectSwitchMessage(previous));
  }

  function restoreProjectPayload(payload) {
    if (!isProjectFormat(payload?.format)) throw new Error('Invalid project');
    if (payload.version === PROJECT_VERSION && validCode(payload.code)) {
      startSimpleProject(payload.code, payload.addons || null);
      return;
    }
    if (payload.version === 2 && payload.project) {
      restoreProjectSnapshot(payload.project);
      applyFilesOpen(true);
      renderFileTree();
      applyView(state.view, false);
      persistDraftNow();
      renderPreview();
      return;
    }
    throw new Error('Invalid project');
  }

  async function recoverPreviousProject() {
    const stored = recoverySnapshot();
    if (!stored) { projectFeedback('NONE'); return; }
    const payload = stored.payload;
    const currentProtected = await saveBeforeProjectSwitch();
    restoreProjectPayload(payload);
    closeProjectMenu();
    projectFeedback('RECOVERED');
    showProjectSwitchToast(currentProtected.destination === 'folder' ? 'PREVIOUS PROJECT RECOVERED · CURRENT PROJECT SAVED' : currentProtected.destination === 'local' ? 'PREVIOUS PROJECT RECOVERED · CURRENT CHANGES KEPT LOCALLY' : 'PREVIOUS PROJECT RECOVERED');
  }

  async function openProjectFiles(files) {
    const selected = [...(files || [])];
    if (!selected.length) return;
    try {
      if (selected.length === 1 && ['n7-code', 'mfcode', 'json'].includes(fileExtension(selected[0]))) {
        const payload = JSON.parse(await selected[0].text());
        if (!isProjectFormat(payload?.format)) throw new Error('Invalid project');
        if (!((payload.version === PROJECT_VERSION && validCode(payload.code)) || (payload.version === 2 && payload.project))) throw new Error('Invalid project');
        const previous = await saveBeforeProjectSwitch();
        restoreProjectPayload(payload);
        projectFeedback('OPENED');
        showProjectSwitchToast(projectSwitchMessage(previous));
        return;
      }
      const records = recordsFromFiles(selected);
      const previous = await saveBeforeProjectSwitch();
      await installFolderProject(selected.length === 1 ? selected[0].name.replace(/\.[^.]+$/, '') : 'FILES', records, null);
      showProjectSwitchToast(projectSwitchMessage(previous));
    } catch {
      projectFeedback('INVALID');
    } finally {
      projectInput.value = '';
    }
  }

  function resetProject() {
    if (!resetAction.classList.contains('is-armed')) {
      resetAction.classList.add('is-armed');
      resetAction.textContent = 'RESET?';
      state.resetTimer = window.setTimeout(disarmReset, 2200);
      return;
    }
    disarmReset();
    closeProjectMenu();
    startSimpleProject(STARTER_CODE);
    projectFeedback('RESET');
  }

  function toggleFolder(path) {
    if (state.collapsedFolders.has(path)) state.collapsedFolders.delete(path);
    else state.collapsedFolders.add(path);
    persistTreeState();
    persistDraftSoon();
    renderFileTree();
  }

  function showProjectSwitch({ title, copy, confirmLabel = 'OPEN', action }) {
    state.pendingProjectSwitch = action;
    projectSwitchTitle.textContent = title;
    projectSwitchCopy.textContent = copy;
    const confirm = projectSwitchActions.find((button) => button.dataset.projectSwitchAction === 'confirm');
    confirm.textContent = confirmLabel;
    projectSwitchOverlay.hidden = false;
    requestAnimationFrame(() => confirm.focus());
  }

  function closeProjectSwitch() {
    projectSwitchOverlay.hidden = true;
    state.pendingProjectSwitch = null;
  }

  async function addDroppedFiles(files) {
    if (!state.project || state.project.mode !== 'folder') return;
    const records = await hydrateTextRecords(recordsFromFiles(files));
    records.forEach((record) => {
      let path = record.path;
      let counter = 2;
      while (state.project.files.has(path)) {
        const dot = record.name.lastIndexOf('.');
        const base = dot > 0 ? record.name.slice(0, dot) : record.name;
        const ext = dot > 0 ? record.name.slice(dot) : '';
        path = `${base}-${counter}${ext}`;
        counter += 1;
      }
      record.path = path;
      record.name = path.split('/').pop();
      record.dirty = true;
      state.project.files.set(path, record);
    });
    renderFileTree();
    persistDraftNow();
    projectFeedback('ADDED');
  }

  function readEntryFile(entry) {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
  }

  function readDirectoryEntries(reader) {
    return new Promise((resolve, reject) => {
      const all = [];
      const next = () => reader.readEntries((batch) => {
        if (!batch.length) resolve(all);
        else { all.push(...batch); next(); }
      }, reject);
      next();
    });
  }

  async function filesFromEntry(entry, prefix = '', isRoot = false) {
    if (entry.isFile) {
      const file = await readEntryFile(entry);
      file.__mfRelativePath = normalizeProjectPath(prefix ? `${prefix}/${entry.name}` : entry.name);
      return [file];
    }
    if (!entry.isDirectory) return [];
    const nextPrefix = isRoot ? prefix : normalizeProjectPath(prefix ? `${prefix}/${entry.name}` : entry.name);
    const children = await readDirectoryEntries(entry.createReader());
    const files = [];
    for (const child of children) files.push(...await filesFromEntry(child, nextPrefix, false));
    return files;
  }

  async function droppedDirectoryHandle(items) {
    for (const item of items) {
      if (typeof item.getAsFileSystemHandle !== 'function') continue;
      try {
        const handle = await item.getAsFileSystemHandle();
        if (handle?.kind === 'directory') return handle;
      } catch { /* fall through to legacy entry API */ }
    }
    return null;
  }

  async function handleDrop(event) {
    event.preventDefault();
    app.classList.remove('is-drop-target');
    const items = [...(event.dataTransfer?.items || [])];
    const modernFolderHandle = await droppedDirectoryHandle(items);
    const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
    const folderEntry = entries.find((entry) => entry.isDirectory);

    if (modernFolderHandle || folderEntry) {
      const folderName = modernFolderHandle?.name || folderEntry.name;
      let records = null;
      let directoryHandle = null;
      if (modernFolderHandle) {
        directoryHandle = modernFolderHandle;
        records = await enumerateDirectoryHandle(modernFolderHandle);
      } else {
        const files = await filesFromEntry(folderEntry, '', true);
        records = recordsFromFiles(files);
      }
      showProjectSwitch({
        title: `OPEN “${folderName.toUpperCase()}” AS PROJECT?`,
        copy: 'Your current project is protected automatically, then this folder becomes active.',
        confirmLabel: 'OPEN',
        action: async () => {
          const previous = await saveBeforeProjectSwitch();
          await installFolderProject(folderName, records, directoryHandle);
          showProjectSwitchToast(projectSwitchMessage(previous));
        }
      });
      return;
    }

    const droppedFiles = entries.length
      ? (await Promise.all(entries.filter((entry) => entry.isFile).map((entry) => readEntryFile(entry))))
      : [...(event.dataTransfer?.files || [])];
    if (!droppedFiles.length) return;

    if (state.project?.mode === 'folder') {
      showProjectSwitch({
        title: droppedFiles.length === 1 ? `ADD “${droppedFiles[0].name.toUpperCase()}”?` : `ADD ${droppedFiles.length} FILES?`,
        copy: 'These files will be added to the current project without replacing it.',
        confirmLabel: 'ADD',
        action: () => addDroppedFiles(droppedFiles)
      });
    } else {
      showProjectSwitch({
        title: droppedFiles.length === 1 ? `CREATE PROJECT FROM “${droppedFiles[0].name.toUpperCase()}”?` : `CREATE PROJECT FROM ${droppedFiles.length} FILES?`,
        copy: 'Your current project is protected automatically, then these files become a new project.',
        confirmLabel: 'OPEN',
        action: async () => {
          const previous = await saveBeforeProjectSwitch();
          const records = recordsFromFiles(droppedFiles);
          await installFolderProject(droppedFiles.length === 1 ? droppedFiles[0].name.replace(/\.[^.]+$/, '') : 'FILES', records, null);
          showProjectSwitchToast(projectSwitchMessage(previous));
        }
      });
    }
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));
  bindEditor(singleEditor, () => (state.view === 'all' ? 'html' : state.view));
  allSections.forEach((section) => bindEditor(section, () => section.dataset.language));

  filesButton.addEventListener('click', toggleFiles);
  fileTree.addEventListener('click', (event) => {
    const folder = event.target.closest('[data-folder-path]');
    if (folder) { toggleFolder(folder.dataset.folderPath); return; }
    const file = event.target.closest('[data-file-path]');
    if (file) activateProjectFile(file.dataset.filePath);
  });

  exportButton.addEventListener('click', exportStandaloneHtml);
  helpButton.addEventListener('click', openHelp);
  helpClose.addEventListener('click', () => closeHelp());
  helpOverlay.addEventListener('pointerdown', (event) => { if (event.target === helpOverlay) closeHelp(); });

  themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
    persistPrefs();
  });

  fontButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyFont(button.dataset.font);
      persistPrefs();
    });
  });


  previewSizeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyPreviewSize(button.dataset.previewSize);
      persistPrefs();
    });
  });

  refreshPreviewButton.addEventListener('click', () => {
    renderPreview();
    previewActionFeedback(refreshPreviewButton, 'DONE');
  });

  focusPreviewButton.addEventListener('click', () => {
    setPreviewFocus(!state.previewFocus);
  });
  detachPreviewButton.addEventListener('click', toggleDetachedPreview);
  detachedPreviewPlaceholder.addEventListener('click', () => returnPreviewToEditor());
  recoverPreviewButton.addEventListener('click', toggleRecoveryMenu);
  recoveryActions.forEach((button) => button.addEventListener('click', () => runPreviewRecovery(button.dataset.recoveryAction)));

  document.addEventListener('focusin', (event) => {
    if (event.target?.classList?.contains('code-input')) updateDiagnosticHint();
  });

  projectButton.addEventListener('click', toggleProjectMenu);
  projectActions.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.projectAction;
      if (action === 'new') { closeProjectMenu(); const previous = await saveBeforeProjectSwitch(); startSimpleProject(STARTER_CODE); projectFeedback('NEW'); showProjectSwitchToast(projectSwitchMessage(previous)); }
      if (action === 'open-files') { closeProjectMenu(); projectInput.click(); }
      if (action === 'open-folder') await openFolderPicker();
      if (action === 'save') await saveProject();
      if (action === 'recover-previous') await recoverPreviousProject();
      if (action === 'reset') resetProject();
    });
  });
  projectInput.addEventListener('change', () => openProjectFiles(projectInput.files));
  projectFolderInput.addEventListener('change', () => openFolderInput(projectFolderInput.files));
  projectSwitchActions.forEach((button) => button.addEventListener('click', async () => {
    if (button.dataset.projectSwitchAction === 'cancel') { closeProjectSwitch(); return; }
    const action = state.pendingProjectSwitch;
    closeProjectSwitch();
    if (action) await action();
  }));
  projectSwitchOverlay.addEventListener('pointerdown', (event) => { if (event.target === projectSwitchOverlay) closeProjectSwitch(); });
  ['dragenter','dragover'].forEach((type) => window.addEventListener(type, (event) => { event.preventDefault(); app.classList.add('is-drop-target'); }));
  window.addEventListener('dragleave', (event) => { if (!event.relatedTarget) app.classList.remove('is-drop-target'); });
  window.addEventListener('drop', handleDrop);
  document.addEventListener('pointerdown', (event) => {
    if (!projectMenu.hidden && !event.target.closest('.project-control')) closeProjectMenu();
    if (!toolsMenu.hidden && !event.target.closest('.tools-control')) closeToolsMenu();
    if (!previewRecoveryMenu.hidden && !event.target.closest('.preview-recovery-control')) closeRecoveryMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !commandPalette.hidden) { event.preventDefault(); closeCommands(); return; }
    if (event.key === 'Escape' && !projectSwitchOverlay.hidden) { event.preventDefault(); closeProjectSwitch(); return; }
    if (event.key === 'Escape' && !libraryOverlay.hidden) { event.preventDefault(); closeLibraries(); return; }
    if (event.key === 'Escape' && !helpOverlay.hidden) { event.preventDefault(); closeHelp(); return; }
    if (event.key === 'Escape' && !findBar.hidden) { event.preventDefault(); closeFind(); return; }
    if (event.key === 'Escape' && !previewRecoveryMenu.hidden) { event.preventDefault(); closeRecoveryMenu(); return; }
    if (event.key === 'Escape' && !toolsMenu.hidden) { event.preventDefault(); closeToolsMenu(); return; }
    if (event.key === 'Escape' && !projectMenu.hidden) { event.preventDefault(); closeProjectMenu(); }
  });

  toolsButton.addEventListener('click', toggleToolsMenu);
  toolsActions.forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.toolsAction;
    if (action === 'format') { closeToolsMenu(); formatCurrent(); }
    if (action === 'libraries') openLibraries();
  }));
  libraryClose.addEventListener('click', () => closeLibraries());
  libraryOverlay.addEventListener('pointerdown', (event) => { if (event.target === libraryOverlay) closeLibraries(); });
  libraryList.addEventListener('click', (event) => { const row = event.target.closest('[data-library-id]'); if (row) toggleLibrary(row.dataset.libraryId); });
  fontLibraryList.addEventListener('click', (event) => { const row = event.target.closest('[data-google-font]'); if (row) toggleGoogleFont(row.dataset.googleFont); });
  fontLibrarySearch.addEventListener('input', renderLibraryPanel);
  findInput.addEventListener('input', () => { findIndex = 0; updateFind(); });
  findInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); stepFind(event.shiftKey ? -1 : 1); } if (event.key === 'Escape') { event.preventDefault(); closeFind(); } });
  replaceInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); replaceCurrentMatch(); } if (event.key === 'Escape') { event.preventDefault(); closeFind(); } });
  findActions.forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.findAction;
    if (action === 'close') closeFind();
    else if (action === 'replace-mode') setReplaceMode(!findBar.classList.contains('is-replace'), !findBar.classList.contains('is-replace'));
    else stepFind(action === 'next' ? 1 : -1);
  }));
  replaceActions.forEach((button) => button.addEventListener('click', () => { if (button.dataset.replaceAction === 'all') replaceAllMatches(); else replaceCurrentMatch(); }));
  autocomplete.addEventListener('pointerdown', (event) => { const button = event.target.closest('.autocomplete-item'); if (!button) return; event.preventDefault(); chooseAutocomplete(Number(button.dataset.index)); });
  commandInput.addEventListener('input', () => { commandIndex = 0; renderCommands(); });
  commandInput.addEventListener('keydown', (event) => {
    const items = filteredCommands();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); commandIndex = (commandIndex + (event.key === 'ArrowDown' ? 1 : -1) + Math.max(1, items.length)) % Math.max(1, items.length); renderCommands(); }
    if (event.key === 'Enter') { event.preventDefault(); runCommand(); }
    if (event.key === 'Escape') { event.preventDefault(); closeCommands(); }
  });
  commandList.addEventListener('click', (event) => { const button = event.target.closest('.command-item'); if (button) runCommand(Number(button.dataset.index)); });
  commandPalette.addEventListener('pointerdown', (event) => { if (event.target === commandPalette) closeCommands(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !commandPalette.hidden) { event.preventDefault(); closeCommands(); return; }
    const primary = primaryModifier(event);
    if (primary && event.key.toLowerCase() === 'k') { event.preventDefault(); commandPalette.hidden ? openCommands() : closeCommands(); return; }
    if (primary && event.key.toLowerCase() === 'f' && !event.altKey && commandPalette.hidden) { event.preventDefault(); openFind(false); return; }
    if (((IS_MAC && primary && event.altKey && event.key.toLowerCase() === 'f') || (!IS_MAC && event.ctrlKey && event.key.toLowerCase() === 'h')) && commandPalette.hidden) { event.preventDefault(); openFind(true); return; }
  });

  window.addEventListener('message', (event) => {
    const fromEmbedded = event.source === preview.contentWindow;
    const fromDetached = isDetachedPreviewOpen() && event.source === state.detachedWindow;
    if ((!fromEmbedded && !fromDetached) || event.data?.source !== 'mf-preview') return;
    if (event.data.renderId !== state.renderId) return;
    if (event.data.projectToken && event.data.projectToken !== state.projectToken) return;
    if (event.data.type === 'bridge-ready' && !liveState.classList.contains('is-error')) {
      state.previewReady = true;
      setLiveState('LIVE');
    }
    if (event.data.type === 'library-error') {
      state.libraryFailures.add(String(event.data.message || 'library'));
      setLiveState('LIBRARY ERROR', true);
      if (!libraryOverlay.hidden) renderLibraryPanel();
    }
    if (event.data.type === 'resource-error') {
      setLiveState(String(event.data.message || 'RESOURCE ERROR'), true);
      recoverPreviewButton.hidden = false;
    }
    if (event.data.type === 'resource-warning' && !liveState.classList.contains('is-error')) {
      liveState.textContent = String(event.data.message || 'PREVIEW FALLBACK');
      window.setTimeout(() => { if (!liveState.classList.contains('is-error')) setLiveState('LIVE'); }, 1800);
    }
    if (event.data.type === 'error') {
      setLiveState('JS ERROR', true);
      recoverPreviewButton.hidden = false;
      state.recoveryActive = false;
      if (Number.isFinite(event.data.line)) state.errorLine.js = event.data.line;
      state.diagnostics.js = state.diagnostics.js.filter((item) => item.kind !== 'runtime');
      state.diagnostics.js.unshift({ severity: 'error', line: Number(event.data.line) || 1, message: event.data.message || 'JavaScript error.', kind: 'runtime' });
      updateDiagnosticHint();
      refreshVisibleEditors();
    }
    if (event.data.type === 'loader-bypassed') {
      state.recoveryActive = true;
      setLiveState('JS ERROR · RECOVERY ACTIVE', true);
    }
    if (event.data.type === 'recovery-applied') {
      if (event.data.applied) {
        state.recoveryActive = true;
        setLiveState('JS ERROR · RECOVERY ACTIVE', true);
      } else previewActionFeedback(recoverPreviewButton, 'NO MATCH');
    }
    if (event.data.type === 'loaded' && !liveState.classList.contains('is-error')) {
      state.previewReady = true;
      state.errorLine.js = null;
      updateDiagnostics('js');
      recoverPreviewButton.hidden = true;
      closeRecoveryMenu();
      state.recoveryActive = false;
      setLiveState('LIVE');
      refreshVisibleEditors();
    }
    if (event.data.type === 'css-applied' && event.data.cssUpdateId === state.cssUpdateId && !liveState.classList.contains('is-error')) {
      setLiveState('LIVE');
    }
    if (event.data.type === 'navigated' && state.project?.mode === 'folder') {
      const path = normalizeProjectPath(event.data.runtimePath || '');
      const record = state.project.files.get(path);
      if (record?.language === 'html' && typeof record.text === 'string') {
        state.project.entryHtmlPath = path;
        state.project.activePath = path;
        state.code.html = record.text;
        state.project.lastByLanguage.html = path;
        state.view = 'html';
        applyView('html', false);
        renderFileTree();
        persistDraftSoon();
      }
    }
    if (event.data.type === 'inspect') revealHtmlSource(event.data.sourceStart);
  });

  let treeDragStartX = 0;
  let treeDragStartWidth = 0;

  function beginTreeDrag(clientX) {
    if (!state.filesOpen || !fileTreeResizer) return;
    treeDragStartX = clientX;
    treeDragStartWidth = fileTree.getBoundingClientRect().width;
    fileTreeResizer.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function moveTreeDrag(clientX) {
    if (!fileTreeResizer?.classList.contains('is-dragging')) return;
    const workspaceWidth = workspace.getBoundingClientRect().width;
    const editorWidth = editorPane.getBoundingClientRect().width;
    const maxWidth = Math.max(214, Math.min(480, workspaceWidth - editorWidth - 340));
    state.filesWidth = clamp(treeDragStartWidth + clientX - treeDragStartX, 164, maxWidth);
    workspace.style.setProperty('--tree-width', `${state.filesWidth}px`);
  }

  function endTreeDrag() {
    if (!fileTreeResizer?.classList.contains('is-dragging')) return;
    fileTreeResizer.classList.remove('is-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    persistPrefs();
  }

  if (fileTreeResizer) {
    fileTreeResizer.addEventListener('pointerdown', (event) => {
      fileTreeResizer.setPointerCapture(event.pointerId);
      beginTreeDrag(event.clientX);
    });
    fileTreeResizer.addEventListener('pointermove', (event) => moveTreeDrag(event.clientX));
    fileTreeResizer.addEventListener('pointerup', endTreeDrag);
    fileTreeResizer.addEventListener('pointercancel', endTreeDrag);
    fileTreeResizer.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const delta = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 48 : 18);
      state.filesWidth = clamp(state.filesWidth + delta, 164, 480);
      workspace.style.setProperty('--tree-width', `${state.filesWidth}px`);
      persistPrefs();
    });
  }

  let dragStartX = 0;
  let dragStartWidth = 0;

  function beginDrag(clientX) {
    dragStartX = clientX;
    dragStartWidth = editorPane.getBoundingClientRect().width;
    divider.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function moveDrag(clientX) {
    if (!divider.classList.contains('is-dragging')) return;
    const workspaceWidth = workspace.getBoundingClientRect().width;
    const filesWidth = state.filesOpen ? fileTree.getBoundingClientRect().width : 0;
    const nextWidth = clamp(dragStartWidth + clientX - dragStartX, 320, workspaceWidth - filesWidth - 320);
    workspace.style.setProperty('--editor-width', `${nextWidth}px`);
  }

  function endDrag() {
    if (!divider.classList.contains('is-dragging')) return;
    divider.classList.remove('is-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    persistPrefs();
  }

  divider.addEventListener('pointerdown', (event) => {
    divider.setPointerCapture(event.pointerId);
    beginDrag(event.clientX);
  });
  divider.addEventListener('pointermove', (event) => moveDrag(event.clientX));
  divider.addEventListener('pointerup', endDrag);
  divider.addEventListener('pointercancel', endDrag);
  divider.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const workspaceWidth = workspace.getBoundingClientRect().width;
    const filesWidth = state.filesOpen ? fileTree.getBoundingClientRect().width : 0;
    const currentWidth = editorPane.getBoundingClientRect().width;
    const step = event.shiftKey ? 48 : 16;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const nextWidth = clamp(currentWidth + direction * step, 320, workspaceWidth - filesWidth - 320);
    workspace.style.setProperty('--editor-width', `${nextWidth}px`);
    persistPrefs();
  });

  window.addEventListener('resize', () => {
    const activeTab = tabs.find((tab) => tab.classList.contains('is-active'));
    updateIndicator(activeTab);
  });

  window.addEventListener('beforeunload', () => {
    persistDraftNow();
    persistHistoryNow();
    if (isDetachedPreviewOpen()) {
      try { state.detachedWindow.postMessage({ source: 'mf-editor', type: 'editor-disconnected', renderId: state.renderId }, '*'); } catch {}
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistDraftNow();
      persistHistoryNow();
      persistPrefs();
    }
  });

  restoreLocalState();
  renderFileTree();
  updateDiagnostics();
  applyTheme(state.theme);
  applyFont(state.font);
  applyPreviewSize(state.previewSize);
  applyFilesOpen(state.filesOpen);
  setPreviewFocus(false);
  applyView(state.view, false);
  populateAllEditors();
  renderPreview();
  void initHostedRuntime();
  applyPlatformShortcuts();
  requestAnimationFrame(() => updateIndicator(tabs.find((tab) => tab.dataset.view === state.view)));
})();
