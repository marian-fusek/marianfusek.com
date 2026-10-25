import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../coaching.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const story = html.match(/<section\b[^>]*id="coaching2-story"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';

test('the canonical coaching story has three accessible, readable panels in order', () => {
  assert.equal((story.match(/<article class="coaching-stack-card/g) ?? []).length, 3);
  assert.match(story, /About coaching[\s\S]*Who this is for[\s\S]*How I work/);
  assert.match(story, /id="coaching2-step-about"[^>]*aria-labelledby="coaching2-title-about"/);
  assert.match(story, /id="coaching2-step-audience"[^>]*aria-labelledby="coaching2-title-audience"/);
  assert.match(story, /id="coaching2-step-approach"[^>]*aria-labelledby="coaching2-title-approach"/);
  assert.doesNotMatch(story, /inert|aria-hidden|coaching2-trigger|coaching2-panel/);
});

test('each desktop panel overlaps by native sticky scrolling without clipping content', () => {
  assert.match(css, /\.coaching-stack-card\s*\{[^}]*position:\s*sticky;[^}]*top:\s*calc\(-1 \* var\(--card-overflow, 0px\)\);[^}]*min-height:\s*100svh;/s);
  assert.match(css, /\.coaching-stack-card\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.coaching-stack-card\s*\{[^}]*margin-bottom:\s*70svh;/s);
  assert.match(css, /\.coaching-stack-card:nth-child\(2\)\s*\{[^}]*z-index:\s*2;/s);
  assert.match(css, /\.coaching-stack-card:nth-child\(3\)\s*\{[^}]*z-index:\s*3;/s);
  assert.match(css, /\.coaching-stack-card:last-child\s*\{[^}]*margin-bottom:\s*0;/s);
  assert.doesNotMatch(html, /coaching2-scroll\.js/);
});

test('panels taller than the viewport reveal their bottom without an inner scroll area', async () => {
  const behavior = await readFile(new URL('../coaching-stack.js', import.meta.url), 'utf8');
  assert.match(html, /src="\.\/coaching-stack\.js\?v=\d+"/);
  assert.match(css, /top:\s*calc\(-1 \* var\(--card-overflow, 0px\)\)/);
  assert.match(behavior, /getBoundingClientRect\(\)\.height/);
  assert.match(behavior, /window\.innerHeight/);
  assert.match(behavior, /ResizeObserver/);
});

test('mobile panels return to normal document flow', () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.coaching-stack-card\s*\{[^}]*position:\s*relative;/s);
  assert.match(html, /href="#coaching2-story" data-coaching-nav/);
});
