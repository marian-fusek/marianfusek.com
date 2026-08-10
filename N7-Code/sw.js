'use strict';

const RUNTIME_CACHE = 'n7-code-runtime-v3';
const RUNTIME_MARKER = '/__n7_project__/';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => (key.startsWith('mf-code-runtime-') || key.startsWith('n7-code-runtime-')) && key !== RUNTIME_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function runtimeRequestUrl(requestUrl) {
  const url = new URL(requestUrl);
  url.search = '';
  url.hash = '';
  return url;
}

async function runtimeResponse(request) {
  const url = runtimeRequestUrl(request.url);
  const cache = await caches.open(RUNTIME_CACHE);

  let response = await cache.match(url.href, { ignoreSearch: true });
  if (!response && url.pathname.endsWith('/')) {
    const indexUrl = new URL('index.html', url.href);
    response = await cache.match(indexUrl.href, { ignoreSearch: true });
  }

  if (response) return response.clone();

  return new Response('N7-Code runtime file not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes(RUNTIME_MARKER)) return;
  event.respondWith(runtimeResponse(event.request));
});
