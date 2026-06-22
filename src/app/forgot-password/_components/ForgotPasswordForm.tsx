'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { USE_COGNITO_FROM_BROWSER } from '@/lib/auth/clientFlags';

/**
 * Korean-only form (matching the pre-lift behavior). The surrounding
 * Header / Footer pick up the visitor's detected language via the
 * server page.tsx; only the body copy here is fixed Korean.
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setIsLoading(true);
    try {
      if (USE_COGNITO_FROM_BROWSER) {
        // The /api/auth/cognito/forgot-password route already returns
        // ok=true even when the email is unknown — preserves the
        // account-enumeration guard without any extra branching here.
        await fetch('/api/auth/cognito/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        setSent(true);
        return;
      }
      const supabase = getSupabaseBrowser();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        '/auth/reset-password'
      )}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (resetError) {
        console.error('[forgot-password] resetPasswordForEmail failed:', resetError);
        setError('이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      // Always show the success state regardless of whether the email is
      // a real account — this prevents account-enumeration via the
      // success/error response timing.
      setSent(true);
    } catch (err) {
      console.error('[forgot-password] reset threw:', err);
      setError('이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-10">
        <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-50">
          <Mail className="w-5 h-5 text-brand-ink" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink mb-2">
          비밀번호 찾기
        </h1>
        <p className="text-sm text-gray-500">
          가입하신 이메일을 입력해주세요.<br />재설정 링크를 보내드립니다.
        </p>
      </div>

      {sent ? (
        <div className="text-center py-8 space-y-4">
          <p className="text-green-600 text-sm font-bold">
            메일이 발송되었습니다.
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            메일함을 확인해주세요. 메일이 보이지 않으면 스팸함도 확인해주세요.
            <br />링크는 1시간 동안 유효합니다.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black underline underline-offset-4 mt-4"
          >
            <ArrowLeft className="w-3 h-3" /> 로그인으로 돌아가기
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일 주소"
            autoComplete="email"
            required
            className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-brand-ink placeholder:text-gray-400"
          />

          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-ink text-white py-4 font-bold tracking-widest text-[13px] hover:bg-black hover:shadow-lg transition-all mt-8 disabled:opacity-50"
          >
            {isLoading ? '발송 중...' : '재설정 링크 발송'}
          </button>

          <div className="text-center text-sm">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-gray-500 hover:text-black transition-colors underline underline-offset-4"
            >
              <ArrowLeft className="w-3 h-3" /> 로그인으로 돌아가기
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
