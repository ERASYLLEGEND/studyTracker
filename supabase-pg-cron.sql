-- Серверные напоминания о привычках: pg_cron + pg_net.
--
-- Зачем: браузер не может сам показать уведомление, когда приложение закрыто
-- или экран заблокирован (особенно iOS PWA). Поэтому раз в минуту Supabase
-- вызывает /api/send-reminders, а он рассылает push через FCM.
--
-- Выполнить в Supabase → SQL Editor.

-- 1. Расширения (если ещё не включены).
--    На Supabase их также можно включить на странице Database → Extensions.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Удаляем прежнее задание с тем же именем, чтобы повторный запуск был безопасным.
select cron.unschedule(jobid)
from cron.job
where jobname = 'send-habit-reminders';

-- 3. Задание: каждую минуту дёргаем эндпоинт.
--    Время напоминаний сравнивается внутри эндпоинта в часовом поясе
--    Asia/Yekaterinburg, поэтому сам cron может работать в UTC.
select cron.schedule(
  'send-habit-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://study-tracker-qd3g.vercel.app/api/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-api-key', 'study_tracker_push_secret_2026_xyz987'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Проверка, что задание создано:
-- select jobid, jobname, schedule, active from cron.job;

-- Последние запуски (виден ли HTTP-ответ):
-- select status, return_message, start_time
-- from cron.job_run_details
-- order by start_time desc
-- limit 5;
