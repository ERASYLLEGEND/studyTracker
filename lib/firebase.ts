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
const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  'BL9q-5X-dn3zR-M64ddetb2f4ZMSaTzhbuaceAnWAjcNIIkar6UKnoOZ-n5PQhqmx-rt2QS_X9oQqu0IfFA8oto';

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

// Получение FCM-токена устройства.
// Вызывать только по действию пользователя (клик по кнопке) — на iOS
// запрос разрешения вне жеста игнорируется.
export const getFCMToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Firebase] Разрешение на уведомления не выдано');
        return null;
      }
    } else if (Notification.permission !== 'granted') {
      console.warn('[Firebase] Уведомления запрещены в настройках браузера');
      return null;
    }

    // Регистрируем (или переиспользуем) наш Service Worker и передаём его FCM,
    // чтобы тот не создавал второй SW на том же scope.
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (error) {
    console.error('[Firebase] Ошибка получения FCM-токена:', error);
    return null;
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

// Сохранение FCM-токена в таблицу fcm_tokens (Supabase)
export const saveFCMTokenToSupabase = async (token: string): Promise<boolean> => {
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
      console.error('[Firebase] Ошибка сохранения токена в Supabase:', error);
      return false;
    }

    console.log('[Firebase] FCM-токен сохранён в Supabase');
    return true;
  } catch (error) {
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
