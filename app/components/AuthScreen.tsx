'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Activity, CheckCircle2, Loader2, X } from 'lucide-react';

type Mode = 'signin' | 'signup';

/**
 * Экран входа и регистрации (email + пароль) через Supabase Auth.
 * Показывается вместо приложения, пока нет активной сессии.
 */
export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        // Если в Supabase включено подтверждение email, сессия не создаётся сразу.
        if (!data.session) {
          setInfo('Аккаунт создан. Подтвердите email по ссылке из письма, затем войдите.');
          setMode('signin');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (message.includes('Invalid login credentials')) {
        setError('Неверный email или пароль');
      } else if (message.includes('Email not confirmed')) {
        setError('Email не подтверждён — проверьте письмо');
      } else if (message.includes('already registered')) {
        setError('Такая почта уже зарегистрирована — войдите');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setInfo(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <Activity size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">StudyTracker</h1>
          <p className="text-zinc-500 text-sm mt-1">Твой личный ассистент</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-zinc-100">
            {mode === 'signin' ? 'Вход' : 'Регистрация'}
          </h2>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm text-zinc-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm text-zinc-400">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-100">
              <X size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-800 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-100">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
          </button>

          <button
            type="button"
            onClick={switchMode}
            className="w-full text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {mode === 'signin'
              ? 'Нет аккаунта? Зарегистрироваться'
              : 'Уже есть аккаунт? Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
