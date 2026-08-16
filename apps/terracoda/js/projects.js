'use strict';

  function projectFeedback(label) {
    const original = 'PROJECT';
    projectButton.textContent = label;
    projectButton.classList.add('is-feedback');
    window.setTimeout(() => {
      projectButton.textContent = original;
      projectButton.classList.remove('is-feedback');
    }, 1200);
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
<style data-n7-internal>html,body{min-height:100%;}</style>
${runtime?.styleHtml || ''}
${previewBridge(renderId)}
${runtime?.compatScript || ''}
${addonHeadHtml()}
${runtime?.headHtml || ''}
</head>
<body${bodyAttrs}>
${previewHtml}
<script data-n7-internal>window.__n7PrepareInspect();<\/script>
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
<script data-n7-internal>(async()=>{window.__n7PrepareInspect();await Promise.all(window.__n7LibPromises||[]);window.__n7Run(${userScript});})();<\/script>
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
      const relative = file.webkitRelativePath || file.__n7RelativePath || file.name;
      let path = normalizeProjectPath(relative);
      if (rootName && path.startsWith(`${rootName}/`)) path = path.slice(rootName.length + 1);
      const language = projectLanguage(path);
      records.push({ path, name: path.split('/').pop(), language, text: null, file, handle: file.__n7Handle || null, dirty: false });
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
        file.__n7Handle = child;
        file.__n7RelativePath = path;
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
