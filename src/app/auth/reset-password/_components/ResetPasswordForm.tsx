'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { USE_COGNITO_FROM_BROWSER } from '@/lib/auth/clientFlags';

/**
 * Password reset form.
 *
 * Supabase path: reachable only via /auth/callback, which exchanges the
 * recovery code for a real session before redirecting here. With no
 * session this page bounces the user back to /login.
 *
 * Cognito path: the user gets a 6-digit verification code by email
 * (not a magic link). They land on this page, type their email + code
 * + new password, and submit. There's no session to check.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(USE_COGNITO_FROM_BROWSER ? true : null);

  useEffect(() => {
    if (USE_COGNITO_FROM_BROWSER) return;
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
    if (USE_COGNITO_FROM_BROWSER) {
      if (!email.trim() || !code.trim()) {
        setError('이메일과 인증번호를 모두 입력해주세요.');
        return;
      }
    }
    setError('');
    setIsLoading(true);
    try {
      if (USE_COGNITO_FROM_BROWSER) {
        const res = await fetch('/api/auth/cognito/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            code: code.trim(),
            newPassword: password,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error === 'weak_password'
            ? '비밀번호는 8자 이상, 소문자와 숫자를 포함해야 합니다.'
            : '비밀번호 변경에 실패했습니다. 인증번호가 정확한지 확인해주세요.');
          return;
        }
        setSuccess(true);
        setTimeout(() => { window.location.href = '/login'; }, 1800);
        return;
      }
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
            {USE_COGNITO_FROM_BROWSER && (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  autoComplete="email"
                  required
                  className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-brand-ink placeholder:text-gray-400"
                />
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="인증번호 (이메일 확인)"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                  className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-brand-ink placeholder:text-gray-400 tracking-widest"
                />
              </>
            )}
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
