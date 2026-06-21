'use client';

import { Lock } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { Lang } from '@/lib/i18n/types';

interface Labels {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  signin: string;
  verifying: string;
  register: string;
  error: string;
  forgot: string;
  errLinkExpired: string;
  errSessionMissing: string;
}

const L: Record<Lang, Labels> = {
  kr: {
    title: '로그인',
    subtitle: '콕콕가든 스토어에 로그인하세요.',
    email: '이메일 주소',
    password: '비밀번호',
    signin: '로그인',
    verifying: '확인 중...',
    register: '회원가입',
    error: '이메일 또는 비밀번호가 올바르지 않습니다.',
    forgot: '비밀번호를 잊으셨나요?',
    errLinkExpired: '링크가 만료되었습니다. 다시 요청해주세요.',
    errSessionMissing: '세션이 만료되었습니다. 다시 로그인해주세요.',
  },
  en: {
    title: 'Sign In',
    subtitle: 'Sign in to Kokkok Garden storefront.',
    email: 'Email Address',
    password: 'Password',
    signin: 'SIGN IN',
    verifying: 'VERIFYING...',
    register: 'Create an account',
    error: 'Invalid email or password.',
    forgot: 'Forgot your password?',
    errLinkExpired: 'The link has expired. Please request a new one.',
    errSessionMissing: 'Your session has expired. Please sign in again.',
  },
};

function translateError(raw: string | null, t: Labels): string {
  if (!raw) return '';
  if (raw === 'link-expired') return t.errLinkExpired;
  if (raw === 'session-missing') return t.errSessionMissing;
  return raw;
}

/**
 * Sanitize the `?next=` redirect target so a crafted link can't bounce
 * users off-site. Allow only same-origin absolute paths.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

function LoginFormInner({ lang }: { lang: Lang }) {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const callbackError = searchParams.get('error');
  const t = L[lang];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (callbackError) setError(translateError(callbackError, t));
  }, [callbackError, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const supabase = getSupabaseBrowser();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError || !data.user) {
        setError(t.error);
        return;
      }

      if (next) {
        window.location.href = next;
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      window.location.href = profile?.role === 'admin' ? '/admin' : `/${lang}`;
    } catch (err) {
      console.error('[login] signInWithPassword threw:', err);
      setError(t.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 w-full flex items-center justify-center px-4 py-16 animate-in fade-in duration-500">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-50">
            <Lock className="w-5 h-5 text-brand-ink" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink mb-2">{t.title}</h1>
          <p className="text-sm text-gray-500">{t.subtitle}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6" aria-describedby={error ? 'login-error' : undefined}>
          <div className="space-y-4">
            <label htmlFor="login-email" className="sr-only">{t.email}</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t.email}
              autoComplete="email"
              required
              aria-invalid={!!error}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-brand-ink placeholder:text-gray-400"
            />
            <label htmlFor="login-password" className="sr-only">{t.password}</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t.password}
              autoComplete="current-password"
              required
              aria-invalid={!!error}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-brand-ink placeholder:text-gray-400"
            />
          </div>

          {error && (
            <p id="login-error" role="alert" aria-live="polite" className="text-red-500 text-xs font-bold text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-ink text-white py-4 font-bold tracking-widest text-[13px] hover:bg-black hover:shadow-lg transition-all mt-8 disabled:opacity-50"
          >
            {isLoading ? t.verifying : t.signin}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-3 text-sm">
          <Link
            href="/forgot-password"
            className="text-gray-500 hover:text-black transition-colors underline underline-offset-4"
          >
            {t.forgot}
          </Link>
          <Link
            href="/register"
            className="text-gray-500 hover:text-black transition-colors font-medium underline underline-offset-4"
          >
            {t.register}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginForm({ lang }: { lang: Lang }) {
  // useSearchParams must be inside a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <LoginFormInner lang={lang} />
    </Suspense>
  );
}
