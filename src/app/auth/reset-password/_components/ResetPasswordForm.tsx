'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Password reset form. Reachable only via /auth/callback, which exchanges
 * the recovery code for a real session before redirecting here. With no
 * session this page bounces the user back to /login because
 * `supabase.auth.updateUser({ password })` requires one.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?error=session-missing');
        return;
      }
      setHasSession(true);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || '비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
        return;
      }
      setSuccess(true);
      // Sign out so the user logs back in with the fresh password — proves
      // the change took effect and keeps the recovery session from
      // lingering past its purpose.
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.href = '/login';
      }, 1800);
    } catch (err) {
      console.error('[reset-password] updateUser threw:', err);
      setError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  if (hasSession === null) {
    return null; // brief loading; avoids flashing the form pre-session-check
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-10">
        <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-50">
          <Lock className="w-5 h-5 text-brand-ink" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink mb-2">
          비밀번호 재설정
        </h1>
        <p className="text-sm text-gray-500">새로운 비밀번호를 입력해주세요.</p>
      </div>

      {success ? (
        <div className="text-center py-8">
          <p className="text-green-600 text-sm font-bold">
            비밀번호가 변경되었습니다.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            로그인 페이지로 이동합니다...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="새 비밀번호 (8자 이상)"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-brand-ink placeholder:text-gray-400"
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="새 비밀번호 확인"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-brand-ink placeholder:text-gray-400"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-ink text-white py-4 font-bold tracking-widest text-[13px] hover:bg-black hover:shadow-lg transition-all mt-8 disabled:opacity-50"
          >
            {isLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      )}
    </div>
  );
}
