-- Миграция для расширения функционала StudyTracker

-- Обновление таблицы tasks: добавляем due_at и status
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done'));

-- Обновление таблицы habits: добавляем days (массив дней недели)
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS days TEXT[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

-- Обновление политик RLS для новых колонок
-- Сначала удаляем старые политики если они существуют
DROP POLICY IF EXISTS "Enable read access for all users" ON tasks;
DROP POLICY IF EXISTS "Enable insert for all users" ON tasks;
DROP POLICY IF EXISTS "Enable update for all users" ON tasks;
DROP POLICY IF EXISTS "Enable delete for all users" ON tasks;

DROP POLICY IF EXISTS "Enable read access for all users" ON habits;
DROP POLICY IF EXISTS "Enable insert for all users" ON habits;
DROP POLICY IF EXISTS "Enable update for all users" ON habits;
DROP POLICY IF EXISTS "Enable delete for all users" ON habits;

-- Создаем новые политики
CREATE POLICY "Enable read access for all users" ON tasks FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON tasks FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON habits FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON habits FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON habits FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON habits FOR DELETE USING (true);
