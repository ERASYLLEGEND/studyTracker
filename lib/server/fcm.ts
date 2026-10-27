import { createSign } from 'node:crypto';

/**
 * Серверная отправка Web Push через FCM HTTP v1 API (без Admin SDK).
 *
 * Переменные окружения (только сервер):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushResult = {
  sent: number;
  failed: number;
  invalidTokens: string[];
  errors: string[];
};

// Ключ из Vercel UI часто вставляют вместе с обрамляющими кавычками —
// OpenSSL тогда падает с "1E08010C:DECODER routines::unsupported".
const getPrivateKey = (): string =>
  (process.env.FIREBASE_PRIVATE_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n');

const base64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

// Кэш OAuth-токена Google (живёт ~1 час)
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

// Получение access-токена Google по JWT сервисного аккаунта (RS256)
export async function getGoogleAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: process.env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;

  const signature = createSign('RSA-SHA256').update(unsignedToken).sign(getPrivateKey());
  const assertion = `${unsignedToken}.${signature.toString('base64url')}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// Отправка одного уведомления на список токенов устройств.
// Недействительные токены (устройство удалено/токен отозван) возвращаются
// отдельно, чтобы вызывающий код мог почистить fcm_tokens.
export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload
): Promise<PushResult> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Не настроен FIREBASE_PROJECT_ID');
  }

  const accessToken = await getGoogleAccessToken();
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const title = payload.title;
  const body = payload.body;
  const url = payload.url || '/';
  const tag = payload.tag || 'habit-reminder';

  const invalidTokens: string[] = [];
  const errors: string[] = [];

  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            // notification нужен, чтобы уведомление показывалось на iOS
            // даже при закрытом/заблокированном приложении.
            notification: { title, body },
            data: { title, body, url, tag },
            webpush: {
              notification: {
                title,
                body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag,
                requireInteraction: true,
              },
              fcm_options: { link: url },
            },
          },
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        // Токен устарел/отозван — помечаем на удаление
        if (response.status === 404 || details.includes('UNREGISTERED')) {
          invalidTokens.push(token);
        }
        throw new Error(`${response.status}: ${details}`);
      }

      return token;
    })
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      errors.push(result.reason?.message ?? String(result.reason));
    }
  });

  const sent = results.filter((result) => result.status === 'fulfilled').length;

  return { sent, failed: results.length - sent, invalidTokens, errors };
}
