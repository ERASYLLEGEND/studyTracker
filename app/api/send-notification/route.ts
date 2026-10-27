import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToTokens } from '@/lib/server/fcm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/send-notification
 *
 * Отправляет Web Push-уведомление через FCM HTTP v1 API.
 * Токены берутся из таблицы fcm_tokens (Supabase) либо из тела запроса.
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

  let result;
  try {
    result = await sendPushToTokens(tokens, { title, body, url, tag });
  } catch (error) {
    return NextResponse.json(
      { error: `Не удалось получить доступ к FCM: ${(error as Error).message}` },
      { status: 500 }
    );
  }

  // Удаляем недействительные токены, чтобы не копить мусор
  if (supabase && result.invalidTokens.length > 0) {
    await supabase.from('fcm_tokens').delete().in('token', result.invalidTokens);
  }

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    total: tokens.length,
    removed: result.invalidTokens.length,
    ...(result.errors.length > 0 ? { errors: result.errors } : {}),
  });
}
