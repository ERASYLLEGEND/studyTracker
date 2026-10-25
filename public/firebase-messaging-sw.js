/* eslint-disable no-undef */
// Service Worker StudyTracker: фоновые push-уведомления (FCM) + офлайн-кэш.
//
// ВАЖНО: Service Worker не имеет доступа к переменным окружения Next.js,
// поэтому значения firebaseConfig нужно указать здесь вручную — они должны
// совпадать с NEXT_PUBLIC_FIREBASE_* из .env.local (это публичные ключи).

importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

const CACHE_NAME = 'study-tracker-v1';
const PRECACHE_URLS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// ---------------------------------------------------------------- Firebase ---
try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId) {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const data = payload.data || {};

      const title = notification.title || data.title || 'StudyTracker';
      const options = {
        body: notification.body || data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // tag совпадает с тегом на сервере: если FCM уже показал уведомление,
        // повторный показ схлопнется в одно, а не создаст дубликат.
        tag: data.tag || notification.tag || 'default',
        requireInteraction: true,
        data: { url: data.url || '/' },
      };

      return self.registration.showNotification(title, options);
    });
  } else {
    console.warn('[SW] firebaseConfig не заполнен — push-уведомления отключены');
  }
} catch (error) {
  console.error('[SW] Ошибка инициализации Firebase:', error);
}

// ------------------------------------------------------------- Кэширование ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => console.warn('[SW] Precache failed:', error))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Network First с фолбэком в кэш. Supabase не кэшируем — данные всегда свежие.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('Нет ответа в кэше');
      }
    })()
  );
});

// ------------------------------------------------------------- Уведомления ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    (event.notification.click_action || '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
