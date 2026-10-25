'use client';

import { useEffect } from 'react';

/**
 * Подписка на FCM-сообщения, когда приложение открыто (foreground).
 *
 * Здесь намеренно НЕТ запроса разрешения и получения токена:
 * браузер (особенно iOS) требует инициировать это жестом пользователя,
 * поэтому подписка на push происходит в обработчике кнопки
 * «🔔 Включить уведомления» на странице привычек.
 */
export default function FirebaseInit() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    // Динамический импорт: Firebase Messaging нельзя грузить при SSR.
    import('@/lib/firebase').then(async ({ onForegroundMessage }) => {
      const unsub = await onForegroundMessage((payload) => {
        if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

        const title = payload.notification?.title || 'StudyTracker';
        const body = payload.notification?.body || '';
        const url = payload.data?.url || '/';

        // Показываем уведомление через Service Worker (работает и в iOS PWA)
        navigator.serviceWorker.ready
          .then((registration) =>
            registration.showNotification(title, {
              body,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: payload.data?.tag || 'foreground-message',
              data: { url },
            })
          )
          .catch((error) => console.error('[Firebase] Не удалось показать уведомление:', error));
      });

      if (cancelled) unsub();
      else unsubscribe = unsub;
    });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return null;
}
