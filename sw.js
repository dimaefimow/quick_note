// ==================== SERVICE WORKER ====================
// Обеспечивает полную работу приложения без интернета: кеширует app shell
// (HTML, CSS, JS, Chart.js, иконки, манифест) и отдаёт его из кеша.
// Данные пользователя (траты, бюджет) хранятся в localStorage и от сети
// не зависят.

const CACHE_VERSION = 'finance-app-v4';
const CACHE_NAME = CACHE_VERSION;

// Если сеть не ответила за это время — отдаём версию из кеша
// (спасает при «подвисшем» интернете, когда телефон считает, что он онлайн).
const NETWORK_TIMEOUT_MS = 3000;

// Всё, что нужно для работы приложения без сети
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './chart.umd.min.js',
  './manifest.json',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Safari (в том числе iOS) не отдаёт из Service Worker ответы с перенаправлением
// (response.redirected) на навигацию: страница просто не откроется. Если хостинг
// перенаправляет, например, / на /index.html, пересобираем ответ «начисто».
async function cleanResponse(response) {
  if (!response || !response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// Кеширует весь app shell. Каждый файл кешируется по отдельности: один
// недоступный файл не мешает закешировать остальные. cache: 'reload'
// гарантирует свежую копию с сервера, а не из HTTP-кеша браузера.
// Возвращает список файлов, которые не удалось закешировать.
async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const failed = [];

  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (!response || !response.ok) throw new Error('HTTP ' + (response && response.status));
        await cache.put(url, await cleanResponse(response));
      } catch (err) {
        failed.push(url);
        console.warn('[SW] Не удалось закешировать', url, err);
      }
    })
  );

  return failed;
}

// ==================== УСТАНОВКА ====================
self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

// ==================== АКТИВАЦИЯ (очистка старых кешей) ====================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ==================== СООБЩЕНИЯ СО СТРАНИЦЫ ====================
// Тумблер «Оффлайн режим» просит явно загрузить все файлы в кеш и
// ждёт подтверждения — так пользователь точно знает, что приложение
// готово к работе без сети.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'CACHE_ALL') return;

  // Основной канал ответа — порт из MessageChannel (надёжно на iOS);
  // запасной — event.source
  const port = event.ports && event.ports[0];
  const source = event.source;
  const reply = (payload) => {
    if (port) port.postMessage(payload);
    else if (source) source.postMessage(payload);
  };

  event.waitUntil(
    cacheAppShell()
      .then((failed) => reply({ type: 'CACHE_ALL_DONE', success: failed.length === 0, failed }))
      .catch((err) => reply({ type: 'CACHE_ALL_DONE', success: false, failed: APP_SHELL, error: String(err) }))
  );
});

// ==================== СТРАТЕГИЯ ЗАПРОСОВ ====================
// Навигация и файлы app shell — «сеть сначала, при ошибке или таймауте — кеш»:
// онлайн пользователь получает свежую версию, оффлайн приложение работает.
// Остальное (например, шрифты) — «кеш сначала, потом сеть».

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // сторонние запросы не трогаем

  const isNavigation = request.mode === 'navigate';
  const isAppShellFile = APP_SHELL.some((path) => {
    const normalized = path.replace('./', '');
    if (normalized === '') return url.pathname.endsWith('/');
    return url.pathname.endsWith('/' + normalized) || url.pathname === '/' + normalized;
  });

  if (isNavigation || isAppShellFile) {
    event.respondWith(networkFirst(request, isNavigation));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(CACHE_NAME);
  try {
    let networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (networkResponse && networkResponse.redirected) {
      networkResponse = await cleanResponse(networkResponse);
    }
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // ignoreSearch: страница может открываться с query-параметрами
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    if (isNavigation) {
      const indexCached = (await cache.match('./index.html')) || (await cache.match('./'));
      if (indexCached) return indexCached;
    }

    return new Response(
      '<h1>Оффлайн</h1><p>Нет соединения с сетью, и приложение ещё не сохранено. ' +
      'Откройте его один раз с интернетом и включите «Оффлайн режим» в меню.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}
