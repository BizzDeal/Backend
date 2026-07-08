// Firebase Messaging Service Worker
// This runs in the background and receives push messages even when the tab/browser is closed.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBp9WgJDnBHZfrV0wLn117cAFqu-SiOyFo",
  authDomain: "bizzdeal.firebaseapp.com",
  projectId: "bizzdeal",
  storageBucket: "bizzdeal.firebasestorage.app",
  messagingSenderId: "733354093584",
  appId: "1:733354093584:web:7c509cd64322de17422e95"
});

const messaging = firebase.messaging();

// Handle background push messages (when the page is not in focus or browser is minimized)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'BizzDeal Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || 'You have a new notification',
    icon: '/BizzDeal.ico',
    badge: '/BizzDeal.ico',
    data: payload.data || {},
    requireInteraction: true,
    tag: payload.data?.notification_id || 'bizzdeal_push_' + Date.now()
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — opens the app
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
