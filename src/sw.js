import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Écouter les messages Push venant du serveur
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'Nouvelle notification';
  const options = {
    body: data.body || 'Vous avez un nouveau message',
    icon: '/pwa-192x192.png', // Assurez-vous que cette icône existe dans public/
    badge: '/pwa-192x192.png',
    data: data.url || '/'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Gérer le clic sur la notification (Ouvre l'app ou la page demandée)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre est déjà ouverte, on la focus
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      // Sinon on ouvre l'URL
      return clients.openWindow(event.notification.data);
    })
  );
});