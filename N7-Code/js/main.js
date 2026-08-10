'use strict';

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
      file.__n7RelativePath = normalizeProjectPath(prefix ? `${prefix}/${entry.name}` : entry.name);
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
    if ((!fromEmbedded && !fromDetached) || event.data?.source !== 'n7-preview') return;
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
      try { state.detachedWindow.postMessage({ source: 'n7-editor', type: 'editor-disconnected', renderId: state.renderId }, '*'); } catch {}
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistDraftNow();
      persistHistoryNow();
      persistPrefs();
    }
  });

  migrateLegacyStorage();
  migrateLegacyStorage();
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
