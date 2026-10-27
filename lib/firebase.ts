import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging';

// Публичная конфигурация Firebase (значения задаются в .env.local)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// VAPID-ключ: Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates
const ENV_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
// Резервный ключ — на случай, если переменная окружения на хостинге не задана.
const FALLBACK_VAPID_KEY =
  'BL9q-5X-dn3zR-M64ddetb2f4ZMSaTzhbuaceAnWAjcNIIkar6UKnoOZ-n5PQhqmx-rt2QS_X9oQqu0IfFA8oto';
const VAPID_KEY = ENV_VAPID_KEY || FALLBACK_VAPID_KEY;

// Последняя причина сбоя получения токена: на iOS консоли разработчика нет,
// поэтому текст ошибки показывается пользователю в тосте.
let lastTokenError: string | null = null;

export const getFCMTokenError = (): string | null => lastTokenError;

const failToken = (reason: string, error?: unknown): null => {
  lastTokenError = reason;
  console.error(`[Firebase] Не удалось получить FCM-токен: ${reason}`, error ?? '');
  return null;
};

// Проверяем форму VAPID-ключа: 87 символов base64url, 65 байт, первый байт 0x04
// (несжатая точка P-256). Одна опечатка при копировании делает ключ невалидным,
// и getToken падает с невнятной ошибкой — лучше поймать это сразу.
const validateVapidKey = (key: string): string | null => {
  if (!key) return 'не задан (NEXT_PUBLIC_FIREBASE_VAPID_KEY отсутствует)';
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return 'содержит недопустимые символы';
  if (key.length !== 87) return `неверная длина: ${key.length} символов вместо 87`;
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
  if (raw.length !== 65 || raw.charCodeAt(0) !== 0x04) {
    return 'повреждён: это не несжатая точка P-256 (ключ скопирован с опечаткой)';
  }
  return null;
};

// Единственный Service Worker приложения (FCM + офлайн-кэш).
// Важно: два SW на одном scope перезаписывают друг друга, поэтому путь один.
const SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

let messagingInstance: Messaging | null = null;

// Инициализация Firebase (идемпотентно — повторный вызов вернёт существующее приложение)
export const initializeFirebase = (): FirebaseApp => {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
};

// Проверка поддержки Web Push браузером (на iOS — только в установленном PWA)
export const isMessagingSupported = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
};

// Экземпляр Messaging (создаётся только на клиенте)
export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;

  if (!(await isMessagingSupported())) {
    console.warn('[Firebase] Messaging не поддерживается в этом браузере');
    return null;
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging(initializeFirebase());
  }

  return messagingInstance;
};

// Определение платформы для аналитики/группировки токенов
const detectPlatform = (): string => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'web';
};

// getToken() требует УЖЕ активированный Service Worker: navigator.serviceWorker
// .register() резолвится, когда воркер ещё в состоянии installing, и Firebase
// падает с "[11] Subscribing for push requires an active service worker".
// Поэтому дожидаемся state === 'activated' (или active у регистрации).
const waitForActiveServiceWorker = async (
  registration: ServiceWorkerRegistration,
  timeoutMs = 20000
): Promise<ServiceWorkerRegistration> => {
  if (registration.active) return registration;

  const worker = registration.installing || registration.waiting;
  if (!worker) {
    // Воркер установлен, но ещё не активирован — ждём готовности регистрации.
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Service Worker не активировался за 20 секунд')),
          timeoutMs
        )
      ),
    ]);
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', onStateChange);
    };
    const onStateChange = () => {
      if (registration.active) {
        cleanup();
        resolve();
      } else if (worker.state === 'redundant') {
        cleanup();
        reject(new Error('установка Service Worker не удалась (redundant)'));
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Service Worker завис в состоянии «${worker.state}»`));
    }, timeoutMs);

    worker.addEventListener('statechange', onStateChange);
    // Воркер мог активироваться между register() и подпиской на событие.
    onStateChange();
  });

  return registration;
};

// Получение FCM-токена устройства.
// Вызывать только по действию пользователя (клик по кнопке) — на iOS
// запрос разрешения вне жеста игнорируется.
export const getFCMToken = async (): Promise<string | null> => {
  lastTokenError = null;

  if (typeof window === 'undefined') return failToken('код выполняется на сервере (SSR)');
  if (!('Notification' in window)) return failToken('браузер не поддерживает Notification API');
  if (!('serviceWorker' in navigator)) return failToken('браузер не поддерживает Service Worker');
  if (!('PushManager' in window)) return failToken('браузер не поддерживает Push API');

  // Пустой firebaseConfig — самая частая причина на хостинге: переменные
  // NEXT_PUBLIC_FIREBASE_* вшиваются в бандл только на этапе сборки.
  const emptyConfigKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (emptyConfigKeys.length) {
    return failToken(`не заданы переменные Firebase: ${emptyConfigKeys.join(', ')}`);
  }

  const vapidProblem = validateVapidKey(VAPID_KEY);
  if (vapidProblem) return failToken(`VAPID-ключ ${vapidProblem}`);
  console.info(
    `[Firebase] VAPID-ключ взят из ${
      ENV_VAPID_KEY ? 'NEXT_PUBLIC_FIREBASE_VAPID_KEY' : 'встроенного резерва'
    }`
  );

  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return failToken(
        'Firebase Messaging не поддерживается этим браузером (на iOS нужно установить приложение на экран «Домой»)'
      );
    }

    if (Notification.permission === 'denied') {
      return failToken('разрешение на уведомления отклонено в настройках устройства');
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return failToken(`разрешение не выдано (permission=${permission})`);
      }
    }

    // Регистрируем (или переиспользуем) наш Service Worker и передаём его FCM,
    // чтобы тот не создавал второй SW на том же scope. Ждём активации —
    // иначе getToken падает с "requires an active service worker".
    const registered = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
    const registration = await waitForActiveServiceWorker(registered);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return failToken('FCM вернул пустой токен');
    return token;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    const message = error instanceof Error ? error.message : String(error);
    return failToken(`getToken упал${code ? ` [${code}]` : ''}: ${message}`, error);
  }
};

// Слушатель сообщений, когда приложение открыто (foreground).
// Возвращает функцию отписки.
export const onForegroundMessage = async (
  callback: (payload: MessagePayload) => void
): Promise<() => void> => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};

// Последняя причина сбоя сохранения токена (показывается в тосте — на iOS нет консоли).
let lastSaveError: string | null = null;

export const getFCMSaveError = (): string | null => lastSaveError;

// Сохранение FCM-токена в таблицу fcm_tokens (Supabase)
export const saveFCMTokenToSupabase = async (token: string): Promise<boolean> => {
  lastSaveError = null;
  try {
    const { supabase } = await import('./supabaseClient');

    const { error } = await supabase.from('fcm_tokens').upsert(
      {
        token,
        user_id: localStorage.getItem('user_id') || null,
        user_agent: navigator.userAgent,
        platform: detectPlatform(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) {
      lastSaveError = `${error.code ?? 'ошибка'}: ${error.message}`;
      console.error('[Firebase] Ошибка сохранения токена в Supabase:', error);
      return false;
    }

    console.log('[Firebase] FCM-токен сохранён в Supabase');
    return true;
  } catch (error) {
    lastSaveError = error instanceof Error ? error.message : String(error);
    console.error('[Firebase] Ошибка сохранения FCM-токена:', error);
    return false;
  }
};

// Удаление FCM-токена из Supabase (например, при выходе из аккаунта)
export const deleteFCMTokenFromSupabase = async (token: string): Promise<boolean> => {
  try {
    const { supabase } = await import('./supabaseClient');

    const { error } = await supabase.from('fcm_tokens').delete().eq('token', token);

    if (error) {
      console.error('[Firebase] Ошибка удаления токена из Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Firebase] Ошибка удаления FCM-токена:', error);
    return false;
  }
};
