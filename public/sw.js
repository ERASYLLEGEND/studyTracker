// Service Worker для StudyTracker PWA
// Базовая версия с кэшированием статических ассетов и исключением Supabase API

const CACHE_NAME = 'study-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  // Next.js автоматически добавит свои ассеты в кэш
];

// Установка Service Worker и кэширование базовых ассетов
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Активируем новый SW сразу, не дожидаясь закрытия всех вкладок
  self.skipWaiting();
});

// Активация Service Worker и очистка старых кэшей
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем все кэши кроме текущего
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Занимаем контроль над всеми открытыми вкладками сразу
  return self.clients.claim();
});

// Перехват запросов (Network First с фолбэком в кэш)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Исключаем Supabase API из кэширования - данные всегда должны быть актуальными
  if (url.hostname.includes('supabase.co')) {
    console.log('[SW] Skipping Supabase API request:', url.pathname);
    return; // Пропускаем кэширование, идём напрямую к сети
  }
  
  // Для остальных запросов используем стратегию Network First
  event.respondWith(
    (async () => {
      try {
        // Сначала пробуем получить из сети
        const networkResponse = await fetch(event.request);
        
        // Если ответ успешный, кэшируем его
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        // Если сеть недоступна, пробуем достать из кэша
        console.log('[SW] Network failed, trying cache:', error);
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Если в кэше нет, возвращаем offline-страницу или ошибку
        throw new Error('No response found in cache');
      }
    })()
  );
});

// Обработка сообщений от клиента (опционально, для future enhancements)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Обработка кликов на уведомления
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Открываем приложение при клике на уведомление
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Если есть открытое окно приложения, фокусируемся на нем
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Если нет открытого окна, открываем новое
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
