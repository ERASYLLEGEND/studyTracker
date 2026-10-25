-- Создание таблицы tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы exams
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT DEFAULT 'СОР' CHECK (type IN ('СОР', 'СОЧ', 'Экзамен')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы habits
CREATE TABLE IF NOT EXISTS habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  streak INTEGER DEFAULT 0,
  completed_today BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включение Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- Создание политик для публичного доступа (для демо-версии)
-- В реальном приложении нужно добавить аутентификацию
CREATE POLICY "Enable read access for all users" ON tasks FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON tasks FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON exams FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON exams FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON exams FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON exams FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON habits FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON habits FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON habits FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON habits FOR DELETE USING (true);
