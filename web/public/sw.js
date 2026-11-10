/* عامل الخدمة لتطبيق ميزان: استقبال إشعارات الدفع وفتح الصفحة المناسبة عند الضغط */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// فتح التطبيق يجلب دائماً أحدث نسخة من الصفحة (يتجاوز ذاكرة التخزين المؤقت)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate' && req.method === 'GET') {
    event.respondWith(fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).catch(() => fetch(req)));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'ميزان', body: event.data && event.data.text() }; }
  const title = data.title || 'ميزان';
  const options = {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || '#/notifications' },
  };
  const tasks = [self.registration.showNotification(title, options)];
  if (typeof data.badge === 'number' && self.navigator && 'setAppBadge' in self.navigator) {
    tasks.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks).catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data && event.notification.data.url || '#/notifications', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        if ('navigate' in c) return c.navigate(target);
        return;
      }
    }
    return self.clients.openWindow(target);
  })());
});
