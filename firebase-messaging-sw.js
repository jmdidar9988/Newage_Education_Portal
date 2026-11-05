// Firebase Cloud Messaging Service Worker for Newage Education Portal
// Handles background push notifications when user is offline or tab is inactive

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDVawQFjahyoHtE1aDzomcO9EsYmJ3c8fw",
    authDomain: "newage-web.firebaseapp.com",
    projectId: "newage-web",
    storageBucket: "newage-web.firebasestorage.app",
    messagingSenderId: "970795032563",
    appId: "1:970795032563:web:1fa36e6b6ea4c943ebbc86"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background notification:', payload);

    const title = payload.notification?.title || payload.data?.title || 'Newage Education Portal Alert';
    const options = {
        body: payload.notification?.body || payload.data?.body || 'You have an important update waiting in your portal.',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: payload.data?.tag || 'newage-notification',
        data: {
            url: payload.data?.url || '/index.html',
            timestamp: Date.now()
        },
        actions: [
            { action: 'open', title: 'Open Portal' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        vibrate: [200, 100, 200]
    };

    self.registration.showNotification(title, options);
});

// Handle notification click to navigate to the correct portal page
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const targetUrl = event.notification.data?.url || '/index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

