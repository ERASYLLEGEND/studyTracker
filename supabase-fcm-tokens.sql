-- Создание таблицы для хранения FCM токенов устройств
-- Эта таблица хранит токены для отправки push-уведомлений через Firebase

-- Включение расширения для UUID (если ещё не включено)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Создание таблицы fcm_tokens
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent TEXT,
  platform TEXT, -- 'ios', 'android', 'web', 'desktop'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индекса для быстрого поиска по токену
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON public.fcm_tokens(token);

-- Создание индекса для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);

-- Создание индекса для быстрого поиска по user_id (для удаления токенов пользователя)
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id_platform ON public.fcm_tokens(user_id, platform);

-- Включение Row Level Security (RLS)
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Приложение не использует Supabase Auth (auth.uid() всегда NULL), поэтому
-- политики разрешают работу с токенами без user_id; сбрасываем старые версии,
-- чтобы скрипт можно было применять повторно.
DROP POLICY IF EXISTS "Users can view own FCM tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can insert own FCM tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can update own FCM tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can delete own FCM tokens" ON public.fcm_tokens;

-- Политика: пользователи могут видеть только свои токены
CREATE POLICY "Users can view own FCM tokens"
  ON public.fcm_tokens FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Политика: пользователи могут вставлять свои токены
CREATE POLICY "Users can insert own FCM tokens"
  ON public.fcm_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Политика: пользователи могут обновлять свои токены
CREATE POLICY "Users can update own FCM tokens"
  ON public.fcm_tokens FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Политика: пользователи могут удалять свои токены
CREATE POLICY "Users can delete own FCM tokens"
  ON public.fcm_tokens FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fcm_tokens_updated_at
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблице и колонкам
COMMENT ON TABLE public.fcm_tokens IS 'Хранит FCM токены устройств для push-уведомлений';
COMMENT ON COLUMN public.fcm_tokens.token IS 'FCM токен устройства';
COMMENT ON COLUMN public.fcm_tokens.user_id IS 'ID пользователя (если авторизован)';
COMMENT ON COLUMN public.fcm_tokens.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN public.fcm_tokens.platform IS 'Платформа устройства (ios, android, web, desktop)';
