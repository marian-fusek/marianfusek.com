import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appStoreURL = 'https://apps.apple.com/us/app/a-void/id6804468353';
const rootURL = new URL('../', import.meta.url);

test('the portfolio presents A-Void as live and links visitors to the App Store', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('index.html', rootURL), 'utf8'),
    readFile(new URL('script.js', rootURL), 'utf8')
  ]);

  assert.match(html, /A[‑-]Void\s*<span class="initiatives-live-badge">\[LIVE\]<\/span>/);
  assert.match(html, new RegExp(`<a href="${appStoreURL}" target="_blank" rel="noopener noreferrer">Live on the App Store ↗<\\/a>`));
  assert.match(script, new RegExp(`statusURL:'${appStoreURL}'`));
});
