import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Réception d'une notification push ─────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'Pro Abattoir';
  const options = {
    body:    data.body  || 'Vous avez un nouveau message',
    icon:    '/pwa-192x192.png',
    badge:   '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag:     data.tag   || 'default',
    renotify: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic sur la notification ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Si une fenêtre est déjà ouverte → focus
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon → ouvrir l'app
      return clients.openWindow(targetUrl);
    })
  );
});
