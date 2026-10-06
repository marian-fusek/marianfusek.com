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
  assert.match(html, /styles\.css\?v=legal-privacy-9/);
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
  assert.match(html, /styles\.css\?v=legal-privacy-9/);
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

test('self-hosts General Sans instead of loading Fontshare in visitors’ browsers', async () => {
  const pages = await Promise.all([
    readSource('index.html'),
    readSource('privacy/index.html'),
    readSource('support/index.html'),
    readSource('terms/index.html')
  ]);
  const css = await readSource('styles.css');

  for (const page of pages) assert.doesNotMatch(page, /fontshare\.com/i);
  assert.doesNotMatch(css, /fontshare\.com/i);
  assert.match(css, /assets\/fonts\/general-sans-400\.woff2/);
  assert.match(css, /assets\/fonts\/general-sans-500\.woff2/);
  assert.match(css, /assets\/fonts\/general-sans-600\.woff2/);
  await Promise.all([
    fileExists('../assets/fonts/general-sans-400.woff2'),
    fileExists('../assets/fonts/general-sans-500.woff2'),
    fileExists('../assets/fonts/general-sans-600.woff2'),
    fileExists('../assets/fonts/NOTICE.txt')
  ].map(async exists => assert.equal(await exists, true)));
  assert.match(await readSource('assets/fonts/NOTICE.txt'), /ITF Free Font License/);
});

test('makes the live app’s calendar, document, and Lock Screen behaviour explicit', async () => {
  const privacy = await readSource('privacy/index.html');

  assert.match(privacy, /A‑Void requests Full Access to calendar events only when you choose Calendar Import\./);
  assert.match(privacy, /first asks you to choose the calendars it may search/i);
  assert.match(privacy, /does not read event data from a calendar until you select it/i);
  assert.match(privacy, /does not create a timeline until you choose and confirm an item/i);
  assert.match(privacy, /iOS Data Protection with the <strong>Complete<\/strong> protection level/i);
  assert.match(privacy, /Document Capture processes document images on your device and does not upload those images to A‑Void or the developer\./);
  assert.match(privacy, /Widgets and notifications may show timeline names, dates, countdowns or reminder messages on a Home Screen or Lock Screen/i);
  assert.match(privacy, /hide previews or sensitive content in iOS notification and Lock Screen settings/i);
});

test('states the support-email legal basis, retention period, data rights, and Czech complaint route', async () => {
  const [privacy, support] = await Promise.all([
    readSource('privacy/index.html'),
    readSource('support/index.html')
  ]);

  assert.match(privacy, /legitimate interest in responding to support requests/i);
  assert.match(privacy, /GDPR Article 6\(1\)\(f\)/);
  assert.match(privacy, /24 months after the last substantive contact/i);
  assert.match(privacy, /right to access, correct, erase, restrict or object to processing/i);
  assert.match(privacy, /Office for Personal Data Protection \(ÚOOÚ\)/);
  assert.match(privacy, /https:\/\/uoou\.gov\.cz/);
  assert.match(support, /24 months after the last substantive contact/i);
});

test('discloses technical website delivery without treating self-hosted fonts as a no-hosting-data claim', async () => {
  const privacy = await readSource('privacy/index.html');

  assert.match(privacy, /hosted through GitHub Pages and its delivery infrastructure/i);
  assert.match(privacy, /technical connection data, including your IP address, required to deliver and secure the site/i);
  assert.match(privacy, /does not embed third-party fonts, analytics, advertising or tracking scripts/i);
});

test('puts backup, export, reminder, and out-of-control access risk in the terms', async () => {
  const terms = await readSource('terms/index.html');

  assert.match(terms, /Automatic Backup is a convenience feature, not a guaranteed data-recovery service\./);
  assert.match(terms, /responsible for keeping backups appropriate to your needs and for protecting any JSON export or backup/i);
  assert.match(terms, /To the maximum extent permitted by applicable law/i);
  assert.match(terms, /not liable for data loss, missed reminders, missed deadlines, lost access to a device or account, or unauthorised access/i);
  assert.match(terms, /outside our reasonable control/i);
  assert.match(terms, /Nothing in these terms limits rights that cannot legally be limited/i);
});
