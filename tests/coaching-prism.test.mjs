import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../coaching.html', import.meta.url), 'utf8');
const intro = 'Most of us spend years learning how to perform. Coaching is time spent learning what is actually true for you. I ask the questions you might rather avoid, until your own answer gets harder to ignore.';
const section = id => html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/section>`))?.[0] ?? '';

test('the coaching statement follows the hero and precedes who this is for', () => {
  const heroStart = html.indexOf('id="coaching-top"');
  const statementStart = html.indexOf('id="coaching-statement"');
  const audienceStart = html.indexOf('id="coaching-for"');

  assert.ok(heroStart >= 0 && statementStart > heroStart && audienceStart > statementStart);
});

test('the exact intro appears once in its own section and not in the hero', () => {
  const hero = section('coaching-top');
  const statement = section('coaching-statement');

  assert.ok(statement.includes(intro));
  assert.equal(html.split(intro).length - 1, 1);
  assert.ok(!hero.includes(intro));
});

test('one fullscreen prism stage is reserved for the hero title', () => {
  const copies = [...html.matchAll(/class="[^"]*\bcoaching-fluid-glass-copy\b[^"]*"/g)];

  assert.equal(copies.length, 2, 'both text blocks should remain available as source copy');
  assert.equal([...html.matchAll(/data-fluid-glass-stage/g)].length, 1, 'one shared prism layer should cover the hero');
  assert.equal([...html.matchAll(/data-fluid-glass-mount/g)].length, 1, 'one shared FluidGlass instance should span the page');
  assert.match(html, /id="coaching-page-title"[^>]*role="heading"/);
  assert.match(html, /class="coaching-fluid-glass-stage"[^>]*data-fluid-glass-stage[^>]*data-active="true"/);
});

test('the hero has regular secondary copy beneath the prism title', async () => {
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const hero = section('coaching-top');

  assert.match(hero, /<\/div>\s*<p class="coaching-page-intro">Designer first, executive later\. I coach from having done both\.<\/p>/);
  assert.doesNotMatch(hero.match(/<p class="coaching-page-intro">[\s\S]*?<\/p>/)?.[0] ?? '', /data-fluid-glass-copy/);
  assert.match(styles, /\.coaching-page-title\s*\{[^}]*height:\s*auto/s);
  assert.match(styles, /\.coaching-page-intro\s*\{[^}]*color:\s*var\(--body\)[^}]*font:/s);
  assert.match(styles, /\.coaching-page-intro\s*\{[^}]*max-width:\s*34ch/s);
});

test('the coaching prism does not cast the exaggerated shader shadow', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');

  assert.equal(entry.includes('shadow={0}'), true, 'the prism should not add a cast shadow to the page');
});

test('the coaching prism uses the component default rotation', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(entry, /spin=\{/);
});

test('the hero prism stops rendering when its scroll fade reaches zero', async () => {
  const [entry, component, script] = await Promise.all([
    readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/FluidGlass.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8')
  ]);

  assert.match(entry, /active=\{active\}/);
  assert.match(entry, /function useTextLayers\(copies, active\)/);
  assert.match(entry, /if \(!active\) return/);
  assert.match(component, /active = true/);
  assert.match(component, /if \(lost \|\| !settingsRef\.current\.active\) return/);
  assert.match(component, /wakeRef\.current = \(\) => \{\s*if \(!settingsRef\.current\.active\) return;/);
  assert.match(script, /coachingPrismStage\.dataset\.active=/);
});

test('page text remains in the DOM while the transparent canvas draws only the prism', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');
  const component = await readFile(new URL('../components/FluidGlass.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(entry, /renderFootprintOnly/);
  assert.match(styles, /\.coaching-fluid-glass-copy\s*\{[^}]*color:\s*var\(--ink\)/s);
  assert.match(component, /renderFootprintOnly = false/);
  assert.match(component, /gl\.enable\(gl\.SCISSOR_TEST\)/);
  assert.match(component, /gl\.scissor\(/);
  assert.match(component, /previousDrawBounds/);
  assert.match(component, /if \(!s\.renderFootprintOnly\)/);
});

test('one FluidGlass instance measures only the title for its text texture', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');

  assert.match(section('coaching-top'), /data-fluid-glass-copy="title"/);
  assert.doesNotMatch(section('coaching-statement'), /data-fluid-glass-copy/);
  assert.match(entry, /querySelectorAll\('\[data-fluid-glass-copy\]'\)/);
  assert.match(entry, /textLayers=\{textLayers\}/);
  assert.match(entry, /copy\.getBoundingClientRect\(\)/);
  assert.match(entry, /addEventListener\('scroll', schedule/);
  assert.match(entry, /querySelector\('\[data-fluid-glass-stage\]'\)/);
  assert.match(entry, /createRoot\(mountTarget\)/);
  assert.doesNotMatch(entry, /createRoot\(copy\)/);
});

test('the statement uses the coaching grid width instead of collapsing into one track', async () => {
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(styles, /\.coaching-page-statement\s*\{[^}]*grid-column:\s*4\s*\/\s*-1/s);
});

test('the canvas remeasures the title throughout its entrance animation', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');

  assert.match(entry, /copy\.querySelectorAll\('\.coaching-fluid-glass-line'\)/);
  assert.match(entry, /line\.getAnimations\(\)/);
  assert.match(entry, /animation\.playState\s*!==\s*'finished'/);
});

test('the prism converts a full 100 percent line clip to the full text height', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');

  assert.match(entry, /token\.endsWith\('%'\)\s*\?\s*value\s*\*\s*extent\s*:\s*value/);
});

test('each title line gets its own eased prism wipe instead of a stepped pop', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(entry, /coaching-fluid-glass-line/);
  assert.match(styles, /coaching-fluid-glass-line[^{]*\{[^}]*animation:[^;]*coaching-title-line-wipe[^;]*cubic-bezier/s);
  assert.doesNotMatch(styles, /coaching-title-lines-in[^;]*steps\(/);
});

test('the prism tracks child-line wipes and throttles expensive text texture refreshes', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');

  assert.match(entry, /querySelectorAll\('\.coaching-fluid-glass-line'\)/);
  assert.match(entry, /MIN_TEXT_LAYER_INTERVAL\s*=\s*1000\s*\/\s*30/);
});

test('the hero text texture uses measured title lines without obsolete word-range scanning', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');
  const component = await readFile(new URL('../components/FluidGlass.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(entry, /getRenderedTextWords|createTreeWalker|createRange\(/);
  assert.match(entry, /element\.getBoundingClientRect\(\)\.top/);
  assert.match(entry, /x:\s*copyRect\.left/);
  assert.match(entry, /text:\s*element\.textContent\.trim\(\)/);
  assert.match(component, /fontBoundingBoxAscent/);
  assert.match(component, /leading\s*\/\s*2\s*\+\s*ascent/);
});

test('the shared prism canvas stays transparent outside the prism footprint', async () => {
  const [component, entry] = await Promise.all([
    readFile(new URL('../components/FluidGlass.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8')
  ]);

  assert.match(component, /uniform float uFootprintOnly;/);
  assert.match(component, /if \(tr\.mode < 0\.5\) return uFootprintOnly > 0\.5 \? vec4\(0\.0\) : background;/);
  assert.match(component, /u\.uFootprintOnly, s\.renderFootprintOnly \? 1 : 0/);
  assert.match(entry, /background="#f7f5f2"/);
});

test('hero credentials remain anchored in the hero and the scroll cue advances to the statement', () => {
  const hero = section('coaching-top');

  assert.match(hero, /class="coaching-page-credentials"/);
  assert.match(hero, /href="#coaching-statement"/);
});

test('the coaching page mounts the official FluidGlass component instead of the custom port', async () => {
  const [component, entry, packageJson] = await Promise.all([
    readFile(new URL('../components/FluidGlass.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8')
  ]);

  assert.match(component, /import \{ useEffect, useRef, useState \} from 'react'/);
  assert.match(component, /import '\.\/FluidGlass\.css'/);
  assert.match(component, /export default FluidGlass/);
  assert.match(entry, /createRoot/);
  assert.match(entry, /shape="prism"/);
  assert.match(entry, /interaction="follow"/);
  assert.match(entry, /refraction=\{1\}/);
  assert.match(entry, /dispersion=\{0\.35\}/);
  assert.match(entry, /size=\{260\}/);
  assert.match(entry, /new ResizeObserver/);
  assert.match(entry, /DOMContentLoaded/);
  assert.match(entry, /intro=\{false\}/);
  assert.doesNotMatch(entry, /\bsrc=/);
  assert.match(packageJson, /"react"/);
  assert.match(packageJson, /"react-dom"/);
  assert.match(packageJson, /"build:coaching-fluid-glass"/);
});

test('the official text canvas respects explicit line breaks and does not split copy into characters', async () => {
  const component = await readFile(new URL('../components/FluidGlass.jsx', import.meta.url), 'utf8');

  assert.match(component, /const lines = layer\.text\.split\(\/\\r\?\\n\/\)/);
  assert.doesNotMatch(component, /const lines = layer\.text\.split\(''\)/);
});

test('the prism text texture matches the visible copy width and left/top alignment', async () => {
  const [component, entry] = await Promise.all([
    readFile(new URL('../components/FluidGlass.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8')
  ]);

  assert.match(entry, /textLayers=\{textLayers\}/);
  assert.match(entry, /fontSize,/);
  assert.match(entry, /lineHeight,/);
  assert.match(entry, /letterSpacing:/);
  assert.match(component, /ctx\.textAlign = 'left'/);
  assert.match(component, /layer\.x \* ratio/);
  assert.match(component, /layer\.y \* ratio/);
});

test('FluidGlass mounts without allocating disposable WebGL contexts', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(entry, /createRoot\(mountTarget\)/);
  assert.doesNotMatch(entry, /supportCanvas|WEBGL_lose_context/);
  assert.match(styles, /\.coaching-fluid-glass-stage\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
  assert.match(styles, /\.coaching-fluid-glass-stage \.fluid-glass\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/s);
});

test('the coaching statement reaches full opacity before its scroll reveal finishes', async () => {
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');

  assert.match(script, /item\.matches\('\.coaching-page-statement'\)\s*\?\s*1\s*:\s*progress/);
});

test('the coaching statement is never clipped by the shared section wipe', async () => {
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const statementWipe = script.match(/coachingSectionWipes\.forEach\(\(item,index\)=>\{([\s\S]*?)\n      \}\);/)?.[1] ?? '';

  assert.match(statementWipe, /item\.matches\('\.coaching-page-statement'\)\s*\?\s*'none'\s*:/);
});

test('the coaching statement section fills the viewport and separates what coaching is from what it is not', async () => {
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const statement = section('coaching-statement');

  assert.match(styles, /\.coaching-page-section--statement\s*\{[^}]*min-height:\s*100svh/s);
  assert.match(statement, /aria-labelledby="coaching-about-title"[\s\S]*?class="coaching-page-label coaching-wipe" data-coaching-order="2" id="coaching-about-title">About coaching<\/p>/);
  for (const copy of [
    'Partnership:</strong> A shared process to explore what matters and decide what comes next, with shared intent.',
    'Fresh perspective:</strong> Questions that challenge familiar thinking and reveal new options you hadn’t seen.',
    'Your own progress:</strong> Build on your strengths to move toward goals that matter to you in everyday life.',
    'Not mentoring:</strong> I won’t prescribe a path based on my experience; we work from yours, with you leading.',
    'Not consulting:</strong> I won’t hand you a ready-made fix; we clarify your next step together in each conversation.',
    'Not therapy:</strong> Coaching looks ahead and supports action; it isn’t mental-health treatment or formal diagnosis.'
  ]) assert.ok(statement.includes(copy), `expected definition copy: ${copy}`);
  assert.match(statement, /class="coaching-page-two-column coaching-definition-groups"/);
  assert.match(styles, /\.coaching-page-two-column\s*\{[^}]*column-gap:\s*clamp\(24px,\s*2\.5vw,\s*40px\)[^}]*max-width:\s*calc\(\(var\(--grid-column\)\s*\*\s*8\)[^}]*margin-top:\s*3vh/s);
  assert.match(styles, /\.coaching-definition-groups\s*\{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)[^}]*column-gap:\s*var\(--grid-gap\)[^}]*max-width:\s*calc\(\(var\(--grid-column\)\s*\*\s*7\)\s*\+\s*\(var\(--grid-gap\)\s*\*\s*6\)\)/s);
  assert.match(styles, /\.coaching-definition-group\s*\{[^}]*grid-column:\s*span 3/s);
  assert.match(styles, /\.coaching-definition-group:last-child\s*\{[^}]*grid-column:\s*5\s*\/\s*span 3/s);
  assert.ok(styles.indexOf('.coaching-definition-groups {') > styles.indexOf('.coaching-page-two-column {'), 'the narrower width override must follow the shared two-column rule');
  assert.match(styles, /\.coaching-page-principles\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /\.coaching-page-principle\s*\{[^}]*border-top:/s);
  assert.match(styles, /\.coaching-page-two-column,\s*\.coaching-packages-list\s*\{[^}]*grid-template-columns:\s*1fr[^}]*gap:\s*56px/s);
  assert.match(styles, /\.coaching-definition-group\s*\{[^}]*grid-column:\s*auto/s);
  assert.match(styles, /\.coaching-definition-group:last-child\s*\{[^}]*grid-column:\s*auto/s);
  assert.match(styles, /\.coaching-page-section--statement\s*\{[^}]*display:\s*block/s);
});

test('Coach on Call uses the same small section marker as the numbered packages', async () => {
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const onCall = html.match(/<div class="coaching-on-call-heading">([\s\S]*?)<\/div>/)?.[1] ?? '';

  assert.match(onCall, /<p class="coaching-package-number" aria-hidden="true">✻<\/p>[\s\S]*?<h3>COACH ON CALL<\/h3>/);
  assert.match(styles, /\.coaching-package-heading \.coaching-package-number,\s*\.coaching-on-call-heading \.coaching-package-number\s*\{[^}]*font-size:\s*var\(--type-3\)/s);
  assert.match(styles, /\.coaching-on-call-details\s*\{[^}]*padding-top:\s*36px/s);
  assert.match(styles, /\.coaching-on-call-details\s*\{[^}]*max-width:\s*34ch[^}]*padding-top:\s*0/s);
});

test('the fullscreen prism fades as the hero scrolls away', async () => {
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');

  assert.match(script, /coachingPrismStage=document\.querySelector\('\[data-fluid-glass-stage\]'\)/);
  assert.match(script, /coachingHeroSection\.getBoundingClientRect\(\)\.bottom/);
  assert.match(script, /coachingPrismStage\.style\.opacity=String\(1-fadeProgress\)/);
});

test('the coaching page loads the bundled React component without module-origin restrictions', async () => {
  const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /href="\.\/fluid-glass\.bundle\.css\?v=\d+"/);
  assert.match(html, /<script src="\.\/fluid-glass\.bundle\.js\?v=\d+"><\/script>/);
  assert.match(html, /data-fluid-glass-copy="title"/);
  assert.doesNotMatch(section('coaching-statement'), /data-fluid-glass-copy/);
  assert.match(html, /data-fluid-glass-stage/);
  assert.doesNotMatch(html, /data-prism-text/);
  assert.doesNotMatch(homepage, /FluidGlass|fluid-glass/);
});

test('the shipped FluidGlass bundle does not call an undefined global React', async () => {
  const bundle = await readFile(new URL('../fluid-glass.bundle.js', import.meta.url), 'utf8');

  assert.equal(/\bReact\.createElement\b/.test(bundle), false, 'bundle references the undefined global React.createElement');
});

test('the title canvas keeps the existing line-by-line vertical entrance', async () => {
  const entry = await readFile(new URL('../fluid-glass-entry.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(entry, /prepareTitleLines\(copy\)/);
  assert.match(styles, /coaching-fluid-glass-line[^{]*\{[^}]*animation:[^;]*coaching-title-line-wipe/s);
  assert.match(styles, /@keyframes coaching-title-line-wipe\s*\{[\s\S]*?clip-path:\s*inset\(0 0 100% 0\)[\s\S]*?clip-path:\s*inset\(0\)/);
  assert.doesNotMatch(styles, /steps\(var\(--fluid-glass-line-count/);
});

test('the old upside-down custom renderer is removed', async () => {
  const oldRendererExists = await readFile(new URL('../fluid-glass.js', import.meta.url), 'utf8').then(() => true, () => false);

  assert.equal(oldRendererExists, false);
});

test('the statement participates in existing coaching scroll reveals, with no prism below it', () => {
  const statement = section('coaching-statement');
  const audience = section('coaching-for');
  const laterContent = html.slice(html.indexOf('id="coaching-for"'));

  assert.match(statement, /class="coaching-page-statement coaching-wipe" data-coaching-order="2"/);
  assert.doesNotMatch(statement, /data-fluid-glass-copy/);
  assert.doesNotMatch(audience, /data-fluid-glass-copy/);
  assert.equal([...laterContent.matchAll(/data-fluid-glass-copy/g)].length, 0);
});

test('the hero intro remains ordinary copy and is not controlled by legacy title logic', async () => {
  const [styles, script] = await Promise.all([
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8')
  ]);

  assert.match(styles, /\.coaching-page-intro\s*\{/);
  assert.doesNotMatch(script, /\.coaching-page-intro/);
  assert.match(script, /\.coaching-page-credentials h2, \.coaching-page-credentials p/);
  assert.doesNotMatch(script, /\.coaching-page-title/);
});
