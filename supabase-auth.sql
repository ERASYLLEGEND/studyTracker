-- Многопользовательский режим: у каждого аккаунта свои задачи, экзамены,
-- привычки и push-токены. Выполнить в Supabase → SQL Editor.
--
-- ВАЖНО: строки, созданные до этой миграции, имеют user_id = NULL и после
-- включения новых политик станут невидимыми. Как привязать их к своему
-- аккаунту — см. блок 6 в конце файла.

-- 1. Колонка владельца в пользовательских таблицах
alter table tasks  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table exams  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table habits add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_tasks_user  on tasks(user_id);
create index if not exists idx_exams_user  on exams(user_id);
create index if not exists idx_habits_user on habits(user_id);

-- 2. Убираем старые «открытые» политики (USING (true))
drop policy if exists "Enable read access for all users" on tasks;
drop policy if exists "Enable insert for all users" on tasks;
drop policy if exists "Enable update for all users" on tasks;
drop policy if exists "Enable delete for all users" on tasks;

drop policy if exists "Enable read access for all users" on exams;
drop policy if exists "Enable insert for all users" on exams;
drop policy if exists "Enable update for all users" on exams;
drop policy if exists "Enable delete for all users" on exams;

drop policy if exists "Enable read access for all users" on habits;
drop policy if exists "Enable insert for all users" on habits;
drop policy if exists "Enable update for all users" on habits;
drop policy if exists "Enable delete for all users" on habits;

-- 3. Новые политики: доступ только к своим строкам
create policy "tasks_select_own" on tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on tasks for delete using (auth.uid() = user_id);

create policy "exams_select_own" on exams for select using (auth.uid() = user_id);
create policy "exams_insert_own" on exams for insert with check (auth.uid() = user_id);
create policy "exams_update_own" on exams for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exams_delete_own" on exams for delete using (auth.uid() = user_id);

create policy "habits_select_own" on habits for select using (auth.uid() = user_id);
create policy "habits_insert_own" on habits for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on habits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete_own" on habits for delete using (auth.uid() = user_id);

-- 4. fcm_tokens: токен принадлежит пользователю.
--    Серверный эндпоинт рассылки ходит под service_role и RLS обходит.
alter table fcm_tokens add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "Users can view own FCM tokens" on public.fcm_tokens;
drop policy if exists "Users can insert own FCM tokens" on public.fcm_tokens;
drop policy if exists "Users can update own FCM tokens" on public.fcm_tokens;
drop policy if exists "Users can delete own FCM tokens" on public.fcm_tokens;

create policy "fcm_tokens_select_own" on public.fcm_tokens for select using (auth.uid() = user_id);
create policy "fcm_tokens_insert_own" on public.fcm_tokens for insert with check (auth.uid() = user_id);
create policy "fcm_tokens_update_own" on public.fcm_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fcm_tokens_delete_own" on public.fcm_tokens for delete using (auth.uid() = user_id);

-- 5. Токены старых устройств без владельца удаляем — они создадутся заново
--    при следующем входе с включёнными уведомлениями.
delete from public.fcm_tokens where user_id is null;

-- 6. (Необязательно) Привязать уже существующие данные к своему аккаунту.
--    1) Зарегистрируйся в приложении под своим email.
--    2) Подставь этот email ниже и выполни только эти строки:
--
-- update tasks  set user_id = (select id from auth.users where email = 'you@example.com') where user_id is null;
-- update exams  set user_id = (select id from auth.users where email = 'you@example.com') where user_id is null;
-- update habits set user_id = (select id from auth.users where email = 'you@example.com') where user_id is null;
