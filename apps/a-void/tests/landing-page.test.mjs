import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const fileExists = file => access(new URL(file, import.meta.url)).then(() => true, () => false);

test('publishes a crawlable product identity for A-Void', async () => {
  const html = await readSource('index.html');

  assert.match(html, /<link rel="canonical" href="https:\/\/www\.marianfusek\.com\/apps\/a-void\/" \/>/);
  assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large" \/>/);
  assert.match(html, /<meta name="apple-itunes-app" content="app-id=6804468353/);
  assert.match(html, /"@type": "SoftwareApplication"/);
  assert.match(html, /"applicationCategory": "ProductivityApplication"/);
  assert.match(html, /"operatingSystem": "iOS"/);
  assert.match(html, /"price": "0"/);
  assert.match(html, /https:\/\/apps\.apple\.com\/us\/app\/a-void\/id6804468353/);
});

test('answers the key expiry tracker queries in visible page copy', async () => {
  const html = await readSource('index.html');

  assert.match(html, /A‑Void is an iPhone and iPad app for tracking expiry dates, renewals, subscriptions, documents and important dates\./);
  assert.match(html, /<h2 id="answers-title">What can A‑Void help you keep track of\?<\/h2>/);
  assert.match(html, /<h3>Can I track document expiry dates\?<\/h3>/);
  assert.match(html, /<h3>Can I track subscriptions and renewals\?<\/h3>/);
  assert.match(html, /<h3>Does A‑Void need an account\?<\/h3>/);
});

test('publishes a sitemap and lets crawlers discover it', async () => {
  assert.equal(await fileExists('../sitemap.xml'), true, 'A-Void sitemap should exist');
  assert.equal(await fileExists('../../../robots.txt'), true, 'site root robots file should exist');

  const [sitemap, robots] = await Promise.all([
    readSource('sitemap.xml'),
    readFile(new URL('../../../robots.txt', import.meta.url), 'utf8')
  ]);

  for (const url of [
    'https://www.marianfusek.com/apps/a-void/',
    'https://www.marianfusek.com/apps/a-void/privacy/',
    'https://www.marianfusek.com/apps/a-void/support/',
    'https://www.marianfusek.com/apps/a-void/terms/'
  ]) assert.match(sitemap, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.match(robots, /Sitemap: https:\/\/www\.marianfusek\.com\/apps\/a-void\/sitemap\.xml/);
});

test('uses one launch state for every App Store call to action', async () => {
  const [html, script] = await Promise.all([readSource('index.html'), readSource('script.js')]);

  assert.equal((html.match(/data-app-store/g) ?? []).length, 3);
  assert.match(script, /appStoreURL: "https:\/\/apps\.apple\.com\/us\/app\/a-void\/id6804468353"/);
  assert.match(html, /styles\.css\?v=live-search-8/);
  assert.match(html, /script\.js\?v=live-search-8/);
  assert.match(script, /const isAppStoreLive = Boolean\(CONFIG\.appStoreURL\);/);
  assert.match(script, /aria-disabled/);
  assert.match(html, /data-store-kicker>Download on the/);
  assert.match(html, /data-store-label>App Store/);
  assert.match(html, /A‑Void is now available on the App Store\./);
});

test('states the product value and privacy promise without the old guilt copy', async () => {
  const html = await readSource('index.html');

  assert.match(html, /A‑Void is an iPhone and iPad app for tracking expiry dates, renewals, subscriptions, documents and important dates\./);
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
  assert.match(html, /styles\.css\?v=live-search-8/);
  assert.match(html, /script\.js\?v=live-search-8/);
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
