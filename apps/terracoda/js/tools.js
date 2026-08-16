'use strict';

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
      if (library.scripts) library.scripts.forEach((src) => parts.push(`<script data-n7-addon="${library.id}" src="${src}" onerror="window.__n7LibraryError&&window.__n7LibraryError('${library.id}')"></script>`));
      if (library.module) parts.push(`<script data-n7-addon="${library.id}" type="module">window.__n7LibPromises=window.__n7LibPromises||[];window.__n7LibPromises.push(import('${library.module}').then(m=>{window.${library.global}=m;}).catch(e=>{window.__n7LibraryError&&window.__n7LibraryError('${library.id}');}));</script>`);
    });
    state.fonts.forEach((font) => parts.push(`<link data-n7-font="${font.replace(/"/g,'')}" rel="stylesheet" href="${googleFontHref(font)}" onerror="window.__n7LibraryError&&window.__n7LibraryError('font:${font.replace(/'/g,'')}')">`));
    return parts.join('\n');
  }

  function libraryStatus(library, provided) {
    if (provided.has(library.id)) return 'IN PROJECT';
    if (state.libraryFailures.has(library.id)) return 'OFFLINE';
    if (state.libraries.has(library.id)) return '✓';
    return '+';
  }

  function renderLibraryPanel() {
    if (!libraryList || !fontLibraryList) return;
    const provided = projectProvidedLibraries();
    libraryList.innerHTML = CURATED_LIBRARIES.map((library) => {
      const status = libraryStatus(library, provided);
      const locked = status === 'IN PROJECT';
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
    postToPreviewSurfaces({ source: 'n7-editor', type: 'recover', action, renderId: state.renderId });
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
