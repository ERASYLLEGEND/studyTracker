-- Миграция: подзадачи в задачах и время напоминания в привычках.
-- Выполнить в Supabase → SQL Editor.
--
-- Политики доступа здесь НЕ трогаем: после появления аккаунтов они живут
-- в supabase-auth.sql и ограничены владельцем строки (auth.uid() = user_id).
-- Старая версия этого файла пересоздавала политики «для всех» и тем самым
-- открывала данные заново — не возвращай их сюда.

-- 1. Подзадачи в tasks (JSONB для гибкости)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;

-- Пример структуры subtasks:
-- [
--   { "id": "uuid", "title": "Подзадача 1", "completed": false },
--   { "id": "uuid", "title": "Подзадача 2", "completed": true }
-- ]

-- 2. Время напоминания в habits
ALTER TABLE habits
ADD COLUMN IF NOT EXISTS reminder_time TEXT;

-- Пример формата: "18:00" или null, если напоминание не нужно
