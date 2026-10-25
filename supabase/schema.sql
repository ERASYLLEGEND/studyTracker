-- SQL скрипт для создания таблиц в Supabase
-- Выполните этот скрипт в SQL Editor в панели Supabase

-- Таблица tasks (Задачи)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица exams (СОР/СОЧ/Экзамены)
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT DEFAULT 'СОР' CHECK (type IN ('СОР', 'СОЧ', 'Экзамен'))
);

-- Таблица habits (Привычки)
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  streak INTEGER DEFAULT 0 CHECK (streak >= 0),
  completed_today BOOLEAN DEFAULT false
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(date ASC);
