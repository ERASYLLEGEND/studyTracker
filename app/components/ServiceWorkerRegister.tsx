'use client';

import { useEffect } from 'react';

// Путь к единому Service Worker приложения (FCM + офлайн-кэш)
const SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

/**
 * Клиентский компонент для регистрации Service Worker
 * Регистрируется только на клиенте, не блокирует Server-Side Rendering
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Регистрируем Service Worker после загрузки страницы
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register(SERVICE_WORKER_PATH)
          .then((registration) => {
            console.log('[SW] Service Worker registered successfully:', registration.scope);
          })
          .catch((error) => {
            console.error('[SW] Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  return null; // Компонент ничего не рендерит
}
