import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../coaching2.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const behavior = await readFile(new URL('../coaching2-scroll.js', import.meta.url), 'utf8');
const story = html.match(/<section\b[^>]*id="coaching2-story"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
const primaryHtml = await readFile(new URL('../coaching.html', import.meta.url), 'utf8');
const primaryStory = primaryHtml.match(/<section\b[^>]*id="coaching2-story"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';

test('the experimental coaching2 page retains its accordion', () => {
  assert.equal((story.match(/class="coaching2-trigger"/g) ?? []).length, 3);
  assert.match(story, /id="coaching2-trigger-about"[^>]*aria-expanded="true"/);
});

test('the active chapter label sits closer to its headline', () => {
  assert.match(styles, /\.coaching2-item\.is-active \.coaching2-heading\s*\{[^}]*flex-basis:\s*clamp\(30px, 4svh, 48px\)/s);
  assert.match(styles, /\.coaching2-step-content\s*\{[^}]*padding:\s*clamp\(12px, 2vh, 24px\)/s);
});

test('each expanded chapter centers its label and content with equal outer space', () => {
  assert.match(styles, /\.coaching2-item\.is-active\s*\{[^}]*justify-content:\s*center/s);
  assert.match(styles, /\.coaching2-item\.is-active \.coaching2-panel\s*\{[^}]*flex:\s*0 1 auto/s);
  assert.match(styles, /\.coaching2-step-content\s*\{[^}]*padding:\s*clamp\(12px, 2vh, 24px\) 0;/s);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.coaching2-step-content\s*\{[^}]*padding:\s*12px 0;/s);
});

test('the story is one fullscreen accordion, with About coaching open by default', () => {
  assert.match(story, /class="coaching2-accordion"/);
  assert.equal((story.match(/class="coaching2-trigger"/g) ?? []).length, 3);
  assert.equal((story.match(/class="coaching2-panel"/g) ?? []).length, 3);
  assert.equal((story.match(/aria-expanded="true"/g) ?? []).length, 1);
  assert.match(story, /id="coaching2-trigger-about"[^>]*aria-expanded="true"[^>]*aria-controls="coaching2-content-about"/);
  assert.match(story, /id="coaching2-content-audience"[^>]*aria-hidden="true" inert/);
  assert.match(story, /id="coaching2-content-approach"[^>]*aria-hidden="true" inert/);
  assert.ok(story.indexOf('Most of us spend years') < story.indexOf('For people who make'));
  assert.ok(story.indexOf('For people who make') < story.indexOf('The real you begins'));
  assert.match(styles, /\.coaching2-stage\s*\{[^}]*position:\s*sticky[^}]*height:\s*100svh/s);
  assert.match(styles, /\.coaching2-item\.is-active\s*\{[^}]*flex-grow:\s*1/s);
});

test('the accordion follows the coaching grid on desktop and fits mobile', () => {
  assert.match(styles, /\.coaching2-item\.is-active \.coaching2-trigger\s*\{[^}]*font-size:\s*var\(--type-3\)/s);
  assert.match(styles, /\.coaching2-item\.is-active \.coaching2-trigger\s*\{[^}]*transform:\s*translateX/s);
  assert.doesNotMatch(styles, /transition:[^;]*padding-left/);
  assert.match(styles, /\.coaching-page-section\.coaching2-sequence\s*\{[^}]*padding:\s*0/s);
  assert.match(styles, /\.coaching2-step-content\s*\{[^}]*grid-template-columns:\s*repeat\(12,/s);
  assert.match(styles, /\.coaching2-step-content > \*\s*\{[^}]*grid-column:\s*4\s*\/\s*-1/s);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.coaching2-trigger\s*\{[^}]*font-size:\s*clamp\(30px,/s);
  assert.match(styles, /\.coaching2-panel\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /\.coaching2-sequence:not\(\.is-pinned\) \.coaching2-stage\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible/s);
});

test('leaving via navigation does not snap back to the accordion', () => {
  assert.match(behavior, /y > top \+ travel && \(current < last \|\| running\) && previousY <= top \+ travel/);
});

test('fast scroll opens each panel once, then releases after the third', async () => {
  const listeners = new Map();
  const classes = initial => {
    const values = new Set(initial);
    return {
      contains: key => values.has(key),
      add: key => values.add(key),
      remove: key => values.delete(key),
      toggle: (key, on) => on ? values.add(key) : values.delete(key)
    };
  };
  const triggers = Array.from({ length: 3 }, () => ({
    attrs: new Map(),
    setAttribute(key, value) { this.attrs.set(key, value); },
    addEventListener() {}
  }));
  const panels = Array.from({ length: 3 }, (_, i) => ({
    scrollTop: 0, scrollHeight: i === 0 ? 1500 : 500, clientHeight: 500, attrs: new Map(),
    setAttribute(key, value) { this.attrs.set(key, value); },
    toggleAttribute() {}
  }));
  const contents = Array.from({ length: 3 }, () => ({
    scrollHeight: 500,
    animate: () => ({ finished: Promise.resolve(), cancel() {} })
  }));
  const items = Array.from({ length: 3 }, (_, i) => ({
    classList: classes(i === 0 ? ['is-active'] : []),
    querySelector: selector => selector === '.coaching2-trigger' ? triggers[i]
      : selector === '.coaching2-panel' ? panels[i]
      : selector === '.coaching2-heading' ? { getBoundingClientRect: () => ({ height: i === 0 ? 40 : 100 }) }
      : contents[i]
  }));
  const stage = { getBoundingClientRect: () => ({ height: 1000 }), querySelector: () => ({}) };
  const section = { classList: classes(), offsetHeight: 3300,
    getBoundingClientRect: () => ({ top: -window.scrollY }),
    querySelector: () => stage,
    querySelectorAll: () => items
  };
  let now = 0;
  const destinations = [];
  const window = {
    scrollY: 100, innerHeight: 1000,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener: (name, fn) => listeners.set(name, fn),
    siteScrollTo(y) { destinations.push(y); this.scrollY = y; }
  };
  const packages = { getBoundingClientRect: () => ({ top: 3300 - window.scrollY }) };
  const storyLink = { addEventListener(_name, fn) { this.click = fn; } };
  const document = { querySelector: selector => selector === '#coaching-packages' ? packages : section,
    querySelectorAll: () => [storyLink], addEventListener() {}, hidden: false };
  runInNewContext(behavior, { window, document, getComputedStyle: () => ({ paddingTop: '80px', paddingBottom: '80px', getPropertyValue: () => '' }),
    requestAnimationFrame: () => 1, performance: { now: () => now } });
  const wheel = deltaY => {
    let prevented = false;
    listeners.get('wheel')({ deltaY, ctrlKey: false,
      preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
    return prevented;
  };
  const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
  assert.equal(triggers[0].attrs.get('aria-expanded'), 'true');
  assert.equal(wheel(200), true);
  assert.equal(panels[0].scrollTop, 200, 'overflowing content scrolls even when the pointer is outside its panel');
  assert.equal(triggers[0].attrs.get('aria-expanded'), 'true');
  panels[0].scrollTop = 1000;
  assert.equal(wheel(2400), true);
  assert.equal(wheel(2400), true);
  await flush();
  assert.equal(destinations.length, 1);
  assert.equal(triggers[1].attrs.get('aria-expanded'), 'true');
  now = 500;
  assert.equal(wheel(2400), true);
  assert.equal(wheel(2400), true);
  await flush();
  assert.equal(destinations.length, 2);
  assert.equal(triggers[2].attrs.get('aria-expanded'), 'true');
  now = 1000;
  assert.equal(wheel(2400), true);
  assert.equal(destinations.at(-1), 3300);
  window.scrollY = 100 + 2300 * 0.9;
  assert.equal(wheel(-2400), true);
  await flush();
  assert.equal(triggers[1].attrs.get('aria-expanded'), 'true');
  window.scrollY = 3300;
  assert.equal(typeof storyLink.click, 'function');
  storyLink.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(triggers[0].attrs.get('aria-expanded'), 'true');
  assert.ok(destinations.at(-1) < 20);
});

test('the desktop accordion stays fullscreen when its longest chapter needs to scroll', () => {
  const listeners = new Map();
  const classes = new Set();
  const items = Array.from({ length: 3 }, (_, i) => {
    const trigger = { setAttribute() {}, addEventListener() {} };
    const panel = { setAttribute() {}, toggleAttribute() {} };
    const content = { scrollHeight: [300, 320, 589][i] };
    return {
      classList: { toggle() {} },
      querySelector: selector => selector === '.coaching2-trigger' ? trigger
        : selector === '.coaching2-panel' ? panel
        : selector === '.coaching2-heading' ? { getBoundingClientRect: () => ({ height: i === 0 ? 40 : 65 }) }
        : content
    };
  });
  const stage = { getBoundingClientRect: () => ({ height: 600 }), querySelector: () => ({}) };
  const section = {
    classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
    offsetHeight: 1800,
    getBoundingClientRect: () => ({ top: 0 }),
    querySelector: () => stage,
    querySelectorAll: () => items
  };
  const compact = { matches: true, addEventListener(name, fn) { this.change = fn; } };
  const reduced = { matches: false, addEventListener() {} };
  const window = {
    scrollY: 0, innerHeight: 700,
    matchMedia: query => query.includes('max-width') ? compact : reduced,
    addEventListener: (name, fn) => listeners.set(name, fn)
  };
  const document = { querySelector: selector => selector === '#coaching-packages' ? null : section,
    querySelectorAll: () => [], addEventListener() {} };
  runInNewContext(behavior, { window, document, getComputedStyle: () => ({ paddingTop: '80px', paddingBottom: '80px', getPropertyValue: () => '' }),
    requestAnimationFrame: () => 1, performance: { now: () => 0 } });
  assert.equal(classes.has('is-pinned'), false);
  compact.matches = false;
  compact.change();
  assert.equal(classes.has('is-pinned'), true, 'long content should scroll inside the fullscreen stage');
  window.innerHeight = 1000;
  listeners.get('resize')();
  assert.equal(classes.has('is-pinned'), true);
});

test('the fullscreen stage owns its boundary without a duplicate section rule', () => {
  assert.match(styles, /\.coaching-page-section\.coaching2-sequence\s*\{[^}]*border-top:\s*0/s);
  assert.match(styles, /\.coaching2-accordion\s*\{[^}]*padding:\s*var\(--coaching2-outer-pad\) 0/s);
});

test('the experimental accordion remains at coaching2.html', async () => {
  const original = await readFile(new URL('../coaching.html', import.meta.url), 'utf8');
  assert.match(html, /<body class="coaching-page coaching2-page">/);
  assert.match(html, /href="\.\/style\.css\?v=820"/);
  assert.match(html, /src="\.\/coaching2-scroll\.js\?v=16"/);
  assert.match(original, /id="coaching2-story"/);
  assert.match(original, /rel="canonical" href="https:\/\/marianfusek\.com\/coaching\.html"/);
});
