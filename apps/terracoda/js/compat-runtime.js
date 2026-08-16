'use strict';

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
        style.setAttribute('data-n7-project-style', path);
        style.setAttribute('data-n7-original-href', ref);
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
        style.setAttribute('data-n7-project-style', fallback.path);
        style.setAttribute('data-n7-fallback-style', 'true');
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
        script.setAttribute('data-n7-original-src', src);
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
    const compatScript = `<script data-n7-internal>\n(() => {\n  const files = ${manifestJson};\n  const entryPath = ${entryJson};\n  const missingLocalStyles = ${JSON.stringify(missingLocalStyles).replace(/</g, '\\u003c')};\n  if (missingLocalStyles.length) {\n    queueMicrotask(() => window.parent?.postMessage?.({ source:'n7-preview', type:'resource-error', renderId:${state.renderId}, message:'MISSING STYLESHEET · '+missingLocalStyles.join(', ') }, '*'));\n  }\n  const fallbackStylePath = ${JSON.stringify(fallbackStylePath)};\n  window.__n7StyleExpectation = { localRefs:${localStyleRefs}, applied:${appliedLocalStyles.size}, fallback:Boolean(fallbackStylePath) };\n  if (fallbackStylePath) queueMicrotask(() => window.parent?.postMessage?.({ source:'n7-preview', type:'resource-warning', renderId:${state.renderId}, message:'PREVIEW FALLBACK STYLE · '+fallbackStylePath }, '*'));\n  const normalize = (value) => { const out=[]; String(value||'').replace(/\\\\/g,'/').split('/').forEach(p=>{if(!p||p==='.')return;if(p==='..')out.pop();else out.push(p)}); return out.join('/'); };\n  const resolve = (raw) => {\n    const ref=String(raw||'').trim();\n    if(!ref || /^(?:[a-z]+:|#|\\/\\/)/i.test(ref)) return null;\n    const clean=ref.split('#')[0].split('?')[0];\n    const base=clean.startsWith('/')?'':(entryPath.includes('/')?entryPath.slice(0,entryPath.lastIndexOf('/')+1):'');\n    const path=normalize((clean.startsWith('/')?'':base)+clean.replace(/^\\//,''));\n    const url=files[path];\n    if(!url) return null;\n    const hash=ref.includes('#')?'#'+ref.split('#').slice(1).join('#'):'';\n    return url+hash;\n  };\n  window.__n7ResolveProjectUrl = resolve;\n  const remapResourceNode=(node)=>{if(!(node instanceof Element)||node.hasAttribute('data-n7-internal'))return;const tag=node.tagName;const remap=(name)=>{const value=node.getAttribute(name);if(!value)return;const mapped=resolve(value);if(mapped&&mapped!==value)node.setAttribute(name,mapped);};if(tag==='LINK')remap('href');if(['SCRIPT','IMG','SOURCE','VIDEO','AUDIO','IFRAME'].includes(tag))remap('src');if(tag==='OBJECT')remap('data');if(tag==='USE'||tag==='IMAGE')remap('href');};\n  const resourceObserver=new MutationObserver((records)=>records.forEach((record)=>{if(record.type==='attributes')remapResourceNode(record.target);record.addedNodes?.forEach((node)=>{if(!(node instanceof Element))return;remapResourceNode(node);node.querySelectorAll?.('link[href],script[src],img[src],source[src],video[src],audio[src],iframe[src],object[data],use[href],image[href]').forEach(remapResourceNode);});}));\n  resourceObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href','src','data']});\n  const nativeFetch=window.fetch?.bind(window);\n  if(nativeFetch) window.fetch=(input,init)=>{\n    try {\n      if(typeof input==='string' || input instanceof URL){ const mapped=resolve(String(input)); if(mapped) return nativeFetch(mapped,init); }\n      else if(input instanceof Request){ const mapped=resolve(input.url); if(mapped) return nativeFetch(new Request(mapped,input),init); }\n    } catch {}\n    return nativeFetch(input,init);\n  };\n  const XHR=window.XMLHttpRequest;\n  if(XHR){ const open=XHR.prototype.open; XHR.prototype.open=function(method,url,...rest){ return open.call(this,method,resolve(url)||url,...rest); }; }\n  const NativeWorker=window.Worker;\n  if(NativeWorker){ window.Worker=function(url,options){ return new NativeWorker(resolve(url)||url,options); }; window.Worker.prototype=NativeWorker.prototype; }\n  const NativeSharedWorker=window.SharedWorker;\n  if(NativeSharedWorker){ window.SharedWorker=function(url,options){ return new NativeSharedWorker(resolve(url)||url,options); }; window.SharedWorker.prototype=NativeSharedWorker.prototype; }\n})();\n<\\/script>`;

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


