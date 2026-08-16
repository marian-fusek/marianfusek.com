'use strict';

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
