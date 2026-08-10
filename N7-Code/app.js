(() => {
  'use strict';

  const PREVIEW_DELAY = 200;
  const SAVE_DELAY = 280;
  const HISTORY_LIMIT = 80;
  const HISTORY_COALESCE_MS = 650;
  const HISTORY_STORAGE_BUDGET = 1500000;
  const INDENT = '  ';
  const PROJECT_FORMAT = 'mf-code-project';
  const PROJECT_VERSION = 1;
  const STORAGE = {
    draft: 'mf-code-draft-v1',
    prefs: 'mf-code-prefs-v1',
    history: 'mf-code-history-v1'
  };
  const LANGUAGE_MAP = { html: 'markup', css: 'css', js: 'javascript' };
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  const CLOSERS = new Set(Object.values(PAIRS));
  const STARTER_CODE = Object.freeze({
    html: '<h1>Hello.</h1>\n<p>Start making something.</p>',
    css: 'body {\n  font-family: sans-serif;\n}',
    js: 'console.log("Hello.");'
  });

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
  const liveState = document.querySelector('.live-state');
  const projectButton = document.querySelector('.project-button');
  const exportButton = document.querySelector('.export-button');
  const projectMenu = document.querySelector('.project-menu');
  const projectInput = document.querySelector('.project-file-input');
  const projectActions = [...document.querySelectorAll('[data-project-action]')];
  const resetAction = document.querySelector('[data-project-action="reset"]');
  const formatButton = document.querySelector('[data-power-action="format"]');
  const findBar = document.querySelector('[data-find-bar]');
  const findInput = document.querySelector('.find-input');
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

  const state = {
    view: 'html',
    theme: 'light',
    font: 'geist',
    previewSize: 'desktop',
    previewFocus: false,
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
    autocomplete: { open: false, items: [], index: 0, input: null, language: null, container: null }
  };

  if (window.Prism) app.classList.add('has-highlighting');

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* storage can be blocked on some local-file contexts */ }
  }

  function safeJsonParse(value) {
    try { return JSON.parse(value); } catch { return null; }
  }

  function validCode(value) {
    return value && ['html', 'css', 'js'].every((language) => typeof value[language] === 'string');
  }

  function restoreLocalState() {
    const draft = safeJsonParse(safeStorageGet(STORAGE.draft));
    if (validCode(draft?.code)) state.code = { ...draft.code };

    const prefs = safeJsonParse(safeStorageGet(STORAGE.prefs));
    if (prefs) {
      if (['html', 'css', 'js', 'all'].includes(prefs.view)) state.view = prefs.view;
      if (['light', 'dark'].includes(prefs.theme)) state.theme = prefs.theme;
      if (['geist', 'jetbrains'].includes(prefs.font)) state.font = prefs.font;
      if (['desktop', 'tablet', 'mobile'].includes(prefs.previewSize)) state.previewSize = prefs.previewSize;
      if (Number.isFinite(prefs.editorWidth)) workspace.style.setProperty('--editor-width', `${prefs.editorWidth}px`);
    }

    const history = safeJsonParse(safeStorageGet(STORAGE.history));
    if (history) {
      const validEntries = (entries) => Array.isArray(entries) ? entries.filter(validCode).slice(-HISTORY_LIMIT).map((code) => ({ ...code })) : [];
      state.history.past = validEntries(history.past);
      state.history.future = validEntries(history.future);
    }
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

  function applyHistorySnapshot(code) {
    state.code = { ...code };
    state.errorLine = { html: null, css: null, js: null };
    refreshVisibleEditors();
    populateAllEditors();
    persistDraftNow();
    renderPreview();
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

  function persistDraftSoon() {
    window.clearTimeout(state.draftTimer);
    state.draftTimer = window.setTimeout(() => {
      safeStorageSet(STORAGE.draft, JSON.stringify({ code: state.code }));
    }, SAVE_DELAY);
  }

  function persistDraftNow() {
    window.clearTimeout(state.draftTimer);
    safeStorageSet(STORAGE.draft, JSON.stringify({ code: state.code }));
  }

  function persistPrefs() {
    safeStorageSet(STORAGE.prefs, JSON.stringify({
      view: state.view,
      theme: state.theme,
      font: state.font,
      previewSize: state.previewSize,
      editorWidth: Math.round(editorPane.getBoundingClientRect().width)
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

  function lineNumbersFor(value, language) {
    const count = Math.max(1, value.split('\n').length);
    return Array.from({ length: count }, (_, index) => {
      const line = index + 1;
      const items = diagnosticsAtLine(language, line);
      const hasError = state.errorLine[language] === line || items.some((item) => item.severity === 'error');
      const hasWarning = !hasError && items.some((item) => item.severity === 'warning');
      const kind = hasError ? ' is-error' : (hasWarning ? ' is-warning' : '');
      const title = items[0]?.message ? ` title="${escapeHtml(items[0].message).replace(/&quot;/g, '&amp;quot;')}"` : '';
      return `<span class="line-no${kind}"${title}>${line}</span>`;
    }).join('');
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

  function highlightCode(value, language) {
    const prismLanguage = LANGUAGE_MAP[language];
    const grammar = window.Prism?.languages?.[prismLanguage];
    const html = grammar ? window.Prism.highlight(value, grammar, prismLanguage) : escapeHtml(value);
    return applyMatchRangesToHighlightedHtml(html, state.matchRanges[language]);
  }

  function syncScroll(parts) {
    parts.numbers.scrollTop = parts.input.scrollTop;
    parts.highlight.scrollTop = parts.input.scrollTop;
    parts.highlight.scrollLeft = parts.input.scrollLeft;
  }

  function syncEditor(container, language) {
    const parts = getEditorParts(container);
    parts.numbers.innerHTML = lineNumbersFor(parts.input.value, language);
    parts.code.innerHTML = `${highlightCode(parts.input.value, language)}\n`;
    syncScroll(parts);
  }

  function setEditorValue(container, language, value) {
    const parts = getEditorParts(container);
    parts.input.value = value;
    parts.input.dataset.language = language;
    parts.input.setAttribute('aria-label', `${language.toUpperCase()} code`);
    syncEditor(container, language);
  }

  function setSingleEditor(language) {
    setEditorValue(singleEditor, language, state.code[language]);
    footerLanguage.textContent = language.toUpperCase();
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

  function requestPreviewHighlight(sourceStart) {
    if (!state.previewReady || !preview.contentWindow) return;
    preview.contentWindow.postMessage({
      source: 'mf-editor',
      type: 'highlight',
      sourceStart: Number.isFinite(sourceStart) ? sourceStart : null,
      theme: state.theme,
      renderId: state.renderId
    }, '*');
  }

  function highlightPreviewFromHtmlInput(input) {
    requestPreviewHighlight(htmlSourceStartAtOffset(state.code.html, input.selectionStart));
  }

  function previewBridge(renderId) {
    return `<script>
(() => {
  const lineFrom = (error) => {
    const stack = String(error?.stack || '');
    const match = stack.match(/mf-user\.js:(\d+):/);
    return match ? Number(match[1]) : null;
  };
  const send = (type, message = '', line = null, extra = {}) => parent.postMessage({ source: 'mf-preview', type, message, line, renderId: ${renderId}, ...extra }, '*');
  const inspectMap = new WeakMap();
  const sourceMap = new Map();
  let highlightOverlay = null;
  let highlightedElement = null;
  let highlightTimer = null;

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
  window.__mfRun = (code) => { try { (0, eval)(code + '\\n//# sourceURL=mf-user.js'); } catch (error) { send('error', error.message || 'JavaScript error', lineFrom(error)); } };
  window.addEventListener('error', (event) => send('error', event.message || 'JavaScript error', lineFrom(event.error)));
  window.addEventListener('unhandledrejection', (event) => send('error', String(event.reason || 'Promise error'), lineFrom(event.reason)));
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.source !== 'mf-editor' || event.data.renderId !== ${renderId}) return;
    if (event.data.type === 'css-update') {
      const style = document.getElementById('mf-user-style');
      if (!style) return;
      style.textContent = String(event.data.css || '');
      positionHighlight();
      send('css-applied', '', null, { cssUpdateId: event.data.cssUpdateId });
    }
    if (event.data.type === 'highlight') highlightSource(event.data.sourceStart, event.data.theme);
  });
  window.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (event) => {
      let target = event.target;
      while (target && target !== document && !inspectMap.has(target)) target = target.parentElement;
      if (target && inspectMap.has(target)) send('inspect', '', null, { sourceStart: inspectMap.get(target) });
      const link = event.target?.closest?.('a[href]');
      if (link) event.preventDefault();
    }, true);
    send('loaded');
  });
})();
<\/script>`;
  }

  function buildPreviewDocument(renderId) {
    const userScript = JSON.stringify(state.code.js);
    const previewHtml = annotateHtmlForPreview(state.code.html);
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{min-height:100%;}html{background:transparent;}body{background:transparent;}</style>
<style id="mf-user-style">${state.code.css}</style>
${previewBridge(renderId)}
</head>
<body>
${previewHtml}
<script data-mf-internal>window.__mfPrepareInspect();window.__mfRun(${userScript});<\/script>
</body>
</html>`;
  }

  function renderPreview() {
    state.renderId += 1;
    state.previewReady = false;
    setLiveState('UPDATING');
    preview.srcdoc = buildPreviewDocument(state.renderId);
  }

  function injectPreviewCss() {
    if (!state.previewReady || !preview.contentWindow) {
      renderPreview();
      return;
    }
    state.cssUpdateId += 1;
    setLiveState('UPDATING');
    preview.contentWindow.postMessage({
      source: 'mf-editor',
      type: 'css-update',
      css: state.code.css,
      renderId: state.renderId,
      cssUpdateId: state.cssUpdateId
    }, '*');
  }

  function requestPreviewUpdate(language) {
    window.clearTimeout(state.previewTimer);
    setLiveState('UPDATING');
    state.previewTimer = window.setTimeout(() => {
      if (language === 'css') injectPreviewCss();
      else renderPreview();
    }, PREVIEW_DELAY);
  }

  function updateCode(language, value, container, options = {}) {
    if (value === state.code[language]) {
      syncEditor(container, language);
      return;
    }
    recordHistory(language, Boolean(options.coalesce));
    state.code[language] = value;
    if (language === 'js') state.errorLine.js = null;
    updateDiagnostics(language);
    syncEditor(container, language);
    persistDraftSoon();
    requestPreviewUpdate(language);
  }

  function applyView(view, animate = true) {
    state.view = view;
    const activeTab = tabs.find((tab) => tab.dataset.view === view);
    tabs.forEach((tab) => tab.classList.toggle('is-active', tab === activeTab));
    updateIndicator(activeTab);

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

  function switchView(nextView) {
    if (nextView === state.view) return;
    applyView(nextView, true);
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

  function openFind() { findBar.hidden = false; findInput.focus(); findInput.select(); updateFind(); }
  function closeFind() { findBar.hidden = true; activeEditorContext().input.focus(); }
  function getFindMatches() {
    const { input } = activeEditorContext(); const query = findInput.value; if (!query) return [];
    const matches = []; const hay = input.value.toLowerCase(), needle = query.toLowerCase(); let from = 0;
    while ((from = hay.indexOf(needle, from)) !== -1 && matches.length < 1000) { matches.push(from); from += Math.max(1, needle.length); }
    return matches;
  }
  function updateFind() { const matches = getFindMatches(); findCount.textContent = matches.length ? `1 / ${matches.length}` : '0 / 0'; }
  function stepFind(direction) {
    const { input } = activeEditorContext(); const matches = getFindMatches(); if (!matches.length) { updateFind(); return; }
    const caret = input.selectionStart; let index = direction > 0 ? matches.findIndex((m) => m > caret) : [...matches].reverse().findIndex((m) => m < caret);
    if (direction > 0) { if (index < 0) index = 0; }
    else { index = index < 0 ? matches.length - 1 : matches.length - 1 - index; }
    const start = matches[index]; input.focus(); input.setSelectionRange(start, start + findInput.value.length); findCount.textContent = `${index + 1} / ${matches.length}`;
  }

  const COMMANDS = [
    ['Undo', '⌘Z', () => undoHistory()],
    ['Redo', '⇧⌘Z', () => redoHistory()],
    ['Format current code', '⌥⇧F', () => formatCurrent()],
    ['Find in code', '⌘F', () => openFind()],
    ['Toggle comment', '⌘/', () => toggleComment()],
    ['Duplicate line', '⌘D', () => duplicateLine()],
    ['Move line up', '⌥↑', () => moveLine(-1)],
    ['Move line down', '⌥↓', () => moveLine(1)],
    ['View HTML', '', () => switchView('html')], ['View CSS', '', () => switchView('css')], ['View JS', '', () => switchView('js')], ['View all', '', () => switchView('all')],
    ['Preview desktop', '', () => { applyPreviewSize('desktop'); persistPrefs(); }], ['Preview tablet', '', () => { applyPreviewSize('tablet'); persistPrefs(); }], ['Preview mobile', '', () => { applyPreviewSize('mobile'); persistPrefs(); }],
    ['Focus preview', '', () => setPreviewFocus(true)], ['Refresh preview', '', () => renderPreview()], ['Export HTML', '', () => exportStandaloneHtml()], ['Open project', '', () => projectInput.click()], ['Save project', '', () => saveProject()]
  ];
  let commandIndex = 0;
  function filteredCommands() { const q = commandInput.value.trim().toLowerCase(); return COMMANDS.filter(([name]) => !q || name.toLowerCase().includes(q)); }
  function renderCommands() { const items = filteredCommands(); commandIndex = Math.min(commandIndex, Math.max(0, items.length - 1)); commandList.innerHTML = items.map(([name, shortcut], i) => `<button class="command-item${i === commandIndex ? ' is-active' : ''}" type="button" data-index="${i}" role="option"><span>${name.toUpperCase()}</span><span class="command-shortcut">${shortcut}</span></button>`).join(''); }
  function openCommands() { commandIndex = 0; commandInput.value = ''; renderCommands(); commandPalette.hidden = false; requestAnimationFrame(() => commandInput.focus()); }
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
    parts.input.addEventListener('scroll', () => syncScroll(parts));
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

  function closeProjectMenu() {
    window.clearTimeout(state.menuTimer);
    projectMenu.classList.remove('is-open');
    projectButton.setAttribute('aria-expanded', 'false');
    state.menuTimer = window.setTimeout(() => { projectMenu.hidden = true; }, 430);
    disarmReset();
  }

  function openProjectMenu() {
    window.clearTimeout(state.menuTimer);
    projectMenu.hidden = false;
    projectButton.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => projectMenu.classList.add('is-open'));
  }

  function toggleProjectMenu() {
    if (projectButton.getAttribute('aria-expanded') === 'true') closeProjectMenu();
    else openProjectMenu();
  }

  function openHelp() {
    if (!helpOverlay) return;
    closeCommands();
    closeFind();
    closeProjectMenu();
    helpOverlay.hidden = false;
    helpButton.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => helpClose.focus());
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

  function createProjectPayload() {
    return {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      code: { ...state.code }
    };
  }

  function saveProject() {
    const blob = new Blob([JSON.stringify(createProjectPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'project.mfcode';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    closeProjectMenu();
    projectFeedback('SAVED');
  }


  function buildExportDocument() {
    const safeCss = state.code.css.replace(/<\/style/gi, '<\\/style');
    const safeScript = state.code.js.replace(/<\/script/gi, '<\\/script');
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
${state.code.html}
<script>
${safeScript}
<\/script>
</body>
</html>`;
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

  async function openProjectFiles(files) {
    const selected = [...(files || [])];
    if (!selected.length) return;

    try {
      if (selected.length === 1 && ['mfcode', 'json'].includes(fileExtension(selected[0]))) {
        const payload = JSON.parse(await selected[0].text());
        if (payload?.format !== PROJECT_FORMAT || payload?.version !== PROJECT_VERSION || !validCode(payload.code)) {
          throw new Error('Invalid project');
        }
        applyProjectCode(payload.code);
        projectFeedback('OPENED');
        return;
      }

      const nextCode = { ...state.code };
      let imported = false;

      for (const file of selected) {
        const extension = fileExtension(file);
        const source = await file.text();

        if (extension === 'html' || extension === 'htm') {
          const extracted = extractStandaloneHtml(source);
          nextCode.html = extracted.html;
          if (extracted.css) nextCode.css = extracted.css;
          if (extracted.js) nextCode.js = extracted.js;
          imported = true;
        } else if (extension === 'css') {
          nextCode.css = source;
          imported = true;
        } else if (extension === 'js') {
          nextCode.js = source;
          imported = true;
        }
      }

      if (!imported) throw new Error('Unsupported file');
      applyProjectCode(nextCode);
      projectFeedback('OPENED');
    } catch {
      projectFeedback('INVALID');
    } finally {
      projectInput.value = '';
    }
  }

  function disarmReset() {
    window.clearTimeout(state.resetTimer);
    resetAction.classList.remove('is-armed');
    resetAction.textContent = 'RESET';
  }

  function resetProject() {
    if (!resetAction.classList.contains('is-armed')) {
      resetAction.classList.add('is-armed');
      resetAction.textContent = 'RESET?';
      state.resetTimer = window.setTimeout(disarmReset, 2200);
      return;
    }
    disarmReset();
    applyProjectCode(STARTER_CODE);
    closeProjectMenu();
    projectFeedback('RESET');
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));
  bindEditor(singleEditor, () => (state.view === 'all' ? 'html' : state.view));
  allSections.forEach((section) => bindEditor(section, () => section.dataset.language));

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

  document.addEventListener('focusin', (event) => {
    if (event.target?.classList?.contains('code-input')) updateDiagnosticHint();
  });

  projectButton.addEventListener('click', toggleProjectMenu);
  projectActions.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.projectAction;
      if (action === 'open') {
        closeProjectMenu();
        projectInput.click();
      }
      if (action === 'save') saveProject();
      if (action === 'reset') resetProject();
    });
  });
  projectInput.addEventListener('change', () => openProjectFiles(projectInput.files));
  document.addEventListener('pointerdown', (event) => {
    if (!projectMenu.hidden && !event.target.closest('.project-control')) closeProjectMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !helpOverlay.hidden) { event.preventDefault(); closeHelp(); return; }
    if (event.key === 'Escape' && !projectMenu.hidden) closeProjectMenu();
  });

  formatButton.addEventListener('click', formatCurrent);
  findInput.addEventListener('input', updateFind);
  findInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); stepFind(event.shiftKey ? -1 : 1); } if (event.key === 'Escape') closeFind(); });
  findActions.forEach((button) => button.addEventListener('click', () => { const action = button.dataset.findAction; if (action === 'close') closeFind(); else stepFind(action === 'next' ? 1 : -1); }));
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
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'k') { event.preventDefault(); commandPalette.hidden ? openCommands() : closeCommands(); return; }
    if (mod && event.key.toLowerCase() === 'f' && commandPalette.hidden) { event.preventDefault(); openFind(); return; }
  });

  window.addEventListener('message', (event) => {
    if (event.source !== preview.contentWindow || event.data?.source !== 'mf-preview') return;
    if (event.data.renderId !== state.renderId) return;
    if (event.data.type === 'error') {
      setLiveState('JS ERROR', true);
      if (Number.isFinite(event.data.line)) state.errorLine.js = event.data.line;
      state.diagnostics.js = state.diagnostics.js.filter((item) => item.kind !== 'runtime');
      state.diagnostics.js.unshift({ severity: 'error', line: Number(event.data.line) || 1, message: event.data.message || 'JavaScript error.', kind: 'runtime' });
      updateDiagnosticHint();
      refreshVisibleEditors();
    }
    if (event.data.type === 'loaded' && !liveState.classList.contains('is-error')) {
      state.previewReady = true;
      state.errorLine.js = null;
      updateDiagnostics('js');
      setLiveState('LIVE');
      refreshVisibleEditors();
    }
    if (event.data.type === 'css-applied' && event.data.cssUpdateId === state.cssUpdateId && !liveState.classList.contains('is-error')) {
      setLiveState('LIVE');
    }
    if (event.data.type === 'inspect') revealHtmlSource(event.data.sourceStart);
  });

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
    const nextWidth = clamp(dragStartWidth + clientX - dragStartX, 320, workspaceWidth - 320);
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
    const currentWidth = editorPane.getBoundingClientRect().width;
    const step = event.shiftKey ? 48 : 16;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const nextWidth = clamp(currentWidth + direction * step, 320, workspaceWidth - 320);
    workspace.style.setProperty('--editor-width', `${nextWidth}px`);
    persistPrefs();
  });

  window.addEventListener('resize', () => {
    const activeTab = tabs.find((tab) => tab.classList.contains('is-active'));
    updateIndicator(activeTab);
  });

  window.addEventListener('beforeunload', () => { persistDraftNow(); persistHistoryNow(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistDraftNow();
      persistHistoryNow();
      persistPrefs();
    }
  });

  restoreLocalState();
  updateDiagnostics();
  applyTheme(state.theme);
  applyFont(state.font);
  applyPreviewSize(state.previewSize);
  setPreviewFocus(false);
  applyView(state.view, false);
  populateAllEditors();
  renderPreview();
  requestAnimationFrame(() => updateIndicator(tabs.find((tab) => tab.dataset.view === state.view)));
})();
