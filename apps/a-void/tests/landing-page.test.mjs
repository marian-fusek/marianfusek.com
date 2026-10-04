import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('uses one launch state for every App Store call to action', async () => {
  const [html, script] = await Promise.all([readSource('index.html'), readSource('script.js')]);

  assert.equal((html.match(/data-app-store/g) ?? []).length, 3);
  assert.match(html, /styles\.css\?v=prelaunch-copy-6/);
  assert.match(html, /script\.js\?v=prelaunch-copy-6/);
  assert.match(script, /const isAppStoreLive = Boolean\(CONFIG\.appStoreURL\);/);
  assert.match(script, /aria-disabled/);
  assert.match(html, /data-store-kicker>Coming soon/);
  assert.match(html, /data-store-label>on the App Store/);
});

test('states the product value and privacy promise without the old guilt copy', async () => {
  const html = await readSource('index.html');

  assert.match(html, /A personal expiry and renewal tracker for documents, subscriptions and dates that matter\./);
  assert.match(html, /No account\. No ads\. Your timelines stay on your device by default\./);
  assert.doesNotMatch(html, /Your future obligations remain your problem\./);
});

test('keeps small operational copy legible and keyboard focus visible', async () => {
  const css = await readSource('styles.css');

  assert.match(css, /a:focus-visible/);
  assert.match(css, /\.platform-note\{font-size:11px/);
  assert.doesNotMatch(css, /\.platform-note\{display:none\}/);
  assert.match(css, /\.lede\{[^}]*color:#c6c7cd/);
  assert.match(css, /\.platform-note\{[^}]*color:#b5b6bf/);
  assert.match(css, /\.widget\.white small\{color:#62646d\}/);
  assert.match(css, /\.store-button small\{[^}]*font-size:11px/);
  assert.match(css, /@media \(max-width:560px\)\{\.platform-note\{font-size:11px\}\}/);
});

test('uses a centered mobile orb layout', async () => {
  const css = await readSource('styles.css');

  assert.match(css, /\.hero\{min-height:720px;height:100svh;display:flex;align-items:center;justify-content:center\}/);
});

test('uses balanced desktop feature pairs without the decorative countdown ghost', async () => {
  const [html, css] = await Promise.all([readSource('index.html'), readSource('styles.css')]);

  assert.doesNotMatch(html, /countdown-ghost/);
  assert.match(css, /\.product-section\{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center\}/);
  assert.match(css, /\.give-section\{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center\}/);
  assert.match(css, /\.reminder-section\{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center\}/);
  assert.match(css, /\.plus-section\{display:grid;grid-template-columns:1fr 1fr;gap:64px\}/);
  assert.match(css, /\.phone-art\{[^}]*justify-items:end/);
  assert.match(css, /\.reminder-device\{display:flex;justify-content:flex-start\}/);
});

test('uses one calm headline scale and shared label rhythm', async () => {
  const [html, css] = await Promise.all([readSource('index.html'), readSource('styles.css')]);

  assert.match(css, /font-size:clamp\(40px,4\.4vw,64px\)/);
  assert.match(css, /\.product-copy \.eyebrow,[^}]*\.final-copy \.eyebrow\{margin:0 0 54px\}/);
  assert.match(html, /styles\.css\?v=prelaunch-copy-6/);
  assert.match(html, /script\.js\?v=prelaunch-copy-6/);
});

test('keeps every section label out of the body-copy type scale', async () => {
  const css = await readSource('styles.css');

  assert.match(css, /\.watch-heading p:not\(\.eyebrow\)\{[^}]*font-size:16px/);
  assert.match(css, /\.product-copy>p:not\(\.eyebrow\),\.give-copy>p:not\(\.eyebrow\),\.reminder-copy>p:not\(\.eyebrow\),\.widgets-copy>p:not\(\.eyebrow\),\.plus-head>p:not\(\.eyebrow\)\{[^}]*font-size:16px/);
});

test('keeps a deliberate gap between each feature headline and its body copy', async () => {
  const css = await readSource('styles.css');

  assert.match(css, /\.product-copy>p:not\(\.eyebrow\),\.give-copy>p:not\(\.eyebrow\),\.reminder-copy>p:not\(\.eyebrow\),\.widgets-copy>p:not\(\.eyebrow\),\.plus-head>p:not\(\.eyebrow\)\{[^}]*margin:24px 0 0/);
});
