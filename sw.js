// ════════════════════════════════════════════════════
// WealthPath — Service Worker v1.0
// Cache-first para assets estáticos, network-first para API
// ════════════════════════════════════════════════════

const CACHE_NAME = 'wealthpath-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/style.css',
  '/script.js',
  '/Wealth-path-biglogo.png',
  '/Wealth-path-logo.png',
  'https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800;900&family=Satoshi:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

// ── Instalação: faz cache dos assets estáticos ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('https://fonts')));
    }).catch(err => console.warn('SW install cache error:', err))
  );
  self.skipWaiting();
});

// ── Ativação: limpa caches antigos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: estratégia por tipo de request ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API requests: network-first (sem cache para dados dinâmicos)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Google Fonts: cache-first
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      }).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Assets estáticos: cache-first com fallback de rede
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback: index.html para navegação
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── Background Sync: sincroniza dados quando volta online ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-finance') {
    event.waitUntil(syncFinanceData());
  }
});

async function syncFinanceData() {
  // Placeholder para sincronização de dados offline
  console.log('[SW] Background sync executado');
}

// ── Push notifications (para alertas de vencimento) ──
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'WealthPath', {
      body: data.body || 'Você tem uma conta vencendo em breve!',
      icon: '/Wealth-path-logo.png',
      badge: '/Wealth-path-logo.png',
      tag: 'wealthpath-alert',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});