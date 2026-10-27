import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToTokens } from '@/lib/server/fcm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/send-reminders
 *
 * Вызывается по расписанию (pg_cron в Supabase, раз в минуту): ищет привычки,
 * у которых напоминание наступило прямо сейчас, и отправляет push на все
 * сохранённые устройства. Только так уведомление доходит до заблокированного
 * iPhone — в браузере страница в этот момент заморожена.
 *
 * Защита: заголовок x-api-key = NOTIFICATION_API_KEY.
 */

// Время напоминаний хранится как локальное время пользователя ("HH:MM"),
// а сервер Vercel работает в UTC — поэтому сравниваем в этом часовом поясе.
const TIMEZONE = 'Asia/Yekaterinburg';

type Habit = {
  id: string;
  title: string;
  reminder_time: string | null;
  days: string[] | null;
  completed_today: boolean | null;
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.NOTIFICATION_API_KEY;
  if (apiKey && request.headers.get('x-api-key') !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Не настроены NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    );
  }

  // Текущее локальное время пользователя и день недели в том же формате,
  // что и в приложении: "19:31" и "mon".."sun"
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const currentTime = `${part('hour')}:${part('minute')}`;
  const weekday = part('weekday').toLowerCase();

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from('habits')
    .select('id, title, reminder_time, days, completed_today');

  if (error) {
    return NextResponse.json({ error: `Supabase: ${error.message}` }, { status: 500 });
  }

  const due = ((data ?? []) as Habit[]).filter(
    (habit) =>
      habit.reminder_time === currentTime &&
      !habit.completed_today &&
      (habit.days ?? []).includes(weekday)
  );

  if (due.length === 0) {
    return NextResponse.json({ time: currentTime, weekday, due: 0, sent: 0, failed: 0 });
  }

  const { data: tokenRows, error: tokenError } = await supabase.from('fcm_tokens').select('token');

  if (tokenError) {
    return NextResponse.json({ error: `Supabase: ${tokenError.message}` }, { status: 500 });
  }

  const tokens = (tokenRows ?? []).map((row: { token: string }) => row.token);

  if (tokens.length === 0) {
    return NextResponse.json({
      time: currentTime,
      weekday,
      due: due.length,
      sent: 0,
      failed: 0,
      message: 'Нет сохранённых токенов',
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const habit of due) {
    try {
      const result = await sendPushToTokens(tokens, {
        title: 'StudyTracker — напоминание',
        body: `Не забудьте выполнить привычку: ${habit.title}`,
        url: '/',
        // tag по id привычки: повторная отправка в ту же минуту схлопнется
        // в одно уведомление вместо дубликата.
        tag: `habit-${habit.id}`,
      });
      sent += result.sent;
      failed += result.failed;
      errors.push(...result.errors);
    } catch (error) {
      failed += tokens.length;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return NextResponse.json({
    time: currentTime,
    weekday,
    due: due.length,
    sent,
    failed,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
