-- Миграция для добавления подзадач и напоминаний

-- 1. Добавляем подзадачи в таблицу tasks (используем JSONB для гибкости)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;

-- Пример структуры subtasks:
-- [
--   { "id": "uuid", "title": "Подзадача 1", "completed": false },
--   { "id": "uuid", "title": "Подзадача 2", "completed": true }
-- ]

-- 2. Добавляем время напоминания в таблицу habits
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS reminder_time TEXT;

-- Пример формата: "18:00" или null если напоминание не нужно

-- Обновляем RLS политики для новых колонок
DROP POLICY IF EXISTS "Enable read access for all users" ON tasks;
DROP POLICY IF EXISTS "Enable insert for all users" ON tasks;
DROP POLICY IF EXISTS "Enable update for all users" ON tasks;
DROP POLICY IF EXISTS "Enable delete for all users" ON tasks;

CREATE POLICY "Enable read access for all users" ON tasks FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON tasks FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON habits;
DROP POLICY IF EXISTS "Enable insert for all users" ON habits;
DROP POLICY IF EXISTS "Enable update for all users" ON habits;
DROP POLICY IF EXISTS "Enable delete for all users" ON habits;

CREATE POLICY "Enable read access for all users" ON habits FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON habits FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON habits FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON habits FOR DELETE USING (true);
