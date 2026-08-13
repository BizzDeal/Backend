importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBp9WgJDnBHZfrV0wLn117cAFqu-SiOyFo',
  authDomain: 'bizzdeal.firebaseapp.com',
  projectId: 'bizzdeal',
  messagingSenderId: '733354093584',
  appId: '1:733354093584:web:7c509cd64322de17422e95',
  measurementId: 'G-5EFJPYW1HD',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );

  const notificationTitle = payload.notification.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/icon/favicon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
