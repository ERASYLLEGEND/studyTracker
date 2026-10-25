# StudyTracker

Учебный дневник и трекер для отслеживания задач, экзаменов (СОР/СОЧ), привычек и таймер Pomodoro.

## Технологии

- Next.js 15 (App Router)
- React 19
- TypeScript
- Supabase (база данных)
- Tailwind CSS
- Lucide React (иконки)

## Установка и настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в **Project Settings** -> **API**
3. Скопируйте:
   - `Project URL` — это будет `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` — это будет `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Настройка переменных окружения

Откройте файл `.env.local` и замените плейсхолдеры на реальные значения:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Создание таблиц в Supabase

Откройте **SQL Editor** в панели Supabase и выполните скрипт из файла `supabase/schema.sql`:

```sql
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
```

### 5. Настройка RLS (Row Level Security) — опционально

Если вы хотите добавить безопасность на уровне строк:

```sql
-- Включить RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- Разрешить всем доступ (для демонстрации)
CREATE POLICY "Allow all access" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON habits FOR ALL USING (true) WITH CHECK (true);
```

### 6. Запуск проекта

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Функциональность

- **Задачи**: создание, отметка выполненных, удаление, приоритеты
- **СОР/СОЧ/Экзамены**: отслеживание дат и типов контрольных
- **Pomodoro таймер**: 25 минут работы, 5 минут перерыва
- **Привычки**: трекинг привычек с подсчетом серии (streak)

## Сборка для продакшена

```bash
npm run build
npm start
```
