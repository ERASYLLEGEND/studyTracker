import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSign } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/send-notification
 *
 * Отправляет Web Push-уведомление через FCM HTTP v1 API.
 * Токены берутся из таблицы fcm_tokens (Supabase).
 *
 * Тело запроса:
 *   { "title": "Чтение 20 минут", "body": "Не забудьте выполнить привычку", "url": "/" }
 *   либо с явным списком токенов: { "title": "...", "tokens": ["..."] }
 *
 * Требуемые переменные окружения (server-side, без NEXT_PUBLIC_):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY   — сервисный аккаунт Firebase
 *   SUPABASE_SERVICE_ROLE_KEY                                          — доступ к fcm_tokens в обход RLS
 *   NOTIFICATION_API_KEY (опционально)                                 — защита эндпоинта
 */

type SendRequestBody = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  tokens?: string[];
};

// Кэш OAuth-токена Google (живёт ~1 час)
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

const base64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const getPrivateKey = (): string =>
  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

// Получение access-токена Google по JWT сервисного аккаунта (RS256)
async function getGoogleAccessToken(): Promise<string> {
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

export async function POST(request: NextRequest) {
  // Опциональная защита эндпоинта
  const apiKey = process.env.NOTIFICATION_API_KEY;
  if (apiKey && request.headers.get('x-api-key') !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return NextResponse.json(
      { error: 'Не настроены FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY' },
      { status: 500 }
    );
  }

  let payload: SendRequestBody;
  try {
    payload = (await request.json()) as SendRequestBody;
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON в теле запроса' }, { status: 400 });
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim() || 'Не забудьте выполнить привычку';
  const url = payload.url?.trim() || '/';
  const tag = payload.tag?.trim() || 'habit-reminder';

  if (!title) {
    return NextResponse.json({ error: 'Поле "title" обязательно' }, { status: 400 });
  }

  // Список токенов: либо из запроса, либо из таблицы fcm_tokens
  let tokens = payload.tokens?.filter(Boolean) ?? [];
  let supabase: ReturnType<typeof createClient> | null = null;

  if (tokens.length === 0) {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Не настроены NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase.from('fcm_tokens').select('token');

    if (error) {
      return NextResponse.json({ error: `Supabase: ${error.message}` }, { status: 500 });
    }

    tokens = (data ?? []).map((row: { token: string }) => row.token);
  }

  if (tokens.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, message: 'Нет сохранённых токенов' });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (error) {
    return NextResponse.json(
      { error: `Не удалось получить доступ к FCM: ${(error as Error).message}` },
      { status: 500 }
    );
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const invalidTokens: string[] = [];

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

  const sent = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - sent;

  // Удаляем недействительные токены, чтобы не копить мусор
  if (supabase && invalidTokens.length > 0) {
    await supabase.from('fcm_tokens').delete().in('token', invalidTokens);
  }

  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason?.message ?? String(result.reason));

  return NextResponse.json({
    sent,
    failed,
    total: tokens.length,
    removed: invalidTokens.length,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
