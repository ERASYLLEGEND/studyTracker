'use client';

import { useEffect } from 'react';

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
          .register('/sw.js')
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
