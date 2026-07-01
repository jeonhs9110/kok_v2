'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Check, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { USE_COGNITO_FROM_BROWSER } from '@/lib/auth/clientFlags';
import { checkPasswordPolicy } from '@/lib/auth/passwordPolicy';
import { useI18n } from '@/lib/i18n/context';
import type { Lang } from '@/lib/i18n/types';

// Full i18n strings for the reset flow. Before this the entire form
// rendered in Korean regardless of the visitor's language — English
// customers arriving from a reset email couldn't read the labels, the
// checklist, or the error strings, and often filed support tickets
// asking "did I click the wrong link?".
const L: Record<Lang, {
  title: string; subtitle: string;
  emailPh: string; codePh: string; passwordPh: string; confirmPh: string;
  policyHeader: string;
  errPolicy: string; errMismatch: string; errMissingCodeOrEmail: string;
  errWeakPassword: string; errCode: string; errGeneric: string;
  successTitle: string; successRedirect: string;
  submit: string; submitting: string;
  mismatchInline: string;
}> = {
  kr: {
    title: '비밀번호 재설정',
    subtitle: '새로운 비밀번호를 입력해주세요.',
    emailPh: '이메일 주소',
    codePh: '인증번호 (이메일 확인)',
    passwordPh: '새 비밀번호',
    confirmPh: '새 비밀번호 확인',
    policyHeader: '비밀번호 조건',
    errPolicy: '비밀번호가 보안 조건을 만족하지 않습니다.',
    errMismatch: '비밀번호 확인이 일치하지 않습니다.',
    errMissingCodeOrEmail: '이메일과 인증번호를 모두 입력해주세요.',
    errWeakPassword: '비밀번호는 8자 이상, 소문자와 숫자를 포함해야 합니다.',
    errCode: '비밀번호 변경에 실패했습니다. 인증번호가 정확한지 확인해주세요.',
    errGeneric: '비밀번호 변경에 실패했습니다. 다시 시도해주세요.',
    successTitle: '비밀번호가 변경되었습니다.',
    successRedirect: '로그인 페이지로 이동합니다...',
    submit: '비밀번호 변경',
    submitting: '변경 중...',
    mismatchInline: '비밀번호가 일치하지 않습니다.',
  },
  en: {
    title: 'Reset password',
    subtitle: 'Enter your new password below.',
    emailPh: 'Email address',
    codePh: 'Verification code (from email)',
    passwordPh: 'New password',
    confirmPh: 'Confirm new password',
    policyHeader: 'Password requirements',
    errPolicy: 'Password does not meet the security requirements.',
    errMismatch: 'The confirmation does not match.',
    errMissingCodeOrEmail: 'Enter both your email and the verification code.',
    errWeakPassword: 'Password must be at least 8 characters and include a lowercase letter and a number.',
    errCode: "Reset failed. Please check that your code is correct.",
    errGeneric: 'Reset failed. Please try again.',
    successTitle: 'Password updated.',
    successRedirect: 'Redirecting to sign in...',
    submit: 'Reset password',
    submitting: 'Resetting...',
    mismatchInline: 'Passwords do not match.',
  },
};

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
  const { lang } = useI18n();
  const t = L[lang] ?? L['en'];
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
    const policy = checkPasswordPolicy(password);
    if (!policy.allValid) {
      setError(t.errPolicy);
      return;
    }
    if (password !== confirm) {
      setError(t.errMismatch);
      return;
    }
    if (USE_COGNITO_FROM_BROWSER) {
      if (!email.trim() || !code.trim()) {
        setError(t.errMissingCodeOrEmail);
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
          setError(body.error === 'weak_password' ? t.errWeakPassword : t.errCode);
          return;
        }
        setSuccess(true);
        setTimeout(() => { window.location.href = '/login'; }, 1800);
        return;
      }
      const supabase = getSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || t.errGeneric);
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
      setError(t.errGeneric);
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
          {t.title}
        </h1>
        <p className="text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {success ? (
        <div className="text-center py-8">
          <p className="text-green-600 text-sm font-bold">{t.successTitle}</p>
          <p className="text-xs text-gray-500 mt-2">{t.successRedirect}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {USE_COGNITO_FROM_BROWSER && (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
                  placeholder={t.emailPh}
                  aria-label={t.emailPh}
                  autoComplete="email"
                  required
                  className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-base sm:text-sm text-brand-ink placeholder:text-gray-400"
                />
                <input
                  type="text"
                  value={code}
                  onChange={e => { setCode(e.target.value); if (error) setError(''); }}
                  placeholder={t.codePh}
                  aria-label={t.codePh}
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  required
                  className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-base sm:text-sm text-brand-ink placeholder:text-gray-400 tracking-widest"
                />
              </>
            )}
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
              placeholder={t.passwordPh}
              aria-label={t.passwordPh}
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-base sm:text-sm text-brand-ink placeholder:text-gray-400"
            />
            <ResetPasswordChecklist value={password} lang={lang} header={t.policyHeader} />
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); if (error) setError(''); }}
              placeholder={t.confirmPh}
              aria-label={t.confirmPh}
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-base sm:text-sm text-brand-ink placeholder:text-gray-400"
            />
            {confirm.length > 0 && confirm !== password && (
              <p className="text-[11px] text-red-500">{t.mismatchInline}</p>
            )}
          </div>

          {error && (
            <p role="alert" aria-live="polite" className="text-red-500 text-xs font-bold text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-ink text-white py-4 font-bold tracking-widest text-[13px] hover:bg-black hover:shadow-lg transition-all mt-8 disabled:opacity-50"
          >
            {isLoading ? t.submitting : t.submit}
          </button>
        </form>
      )}
    </div>
  );
}

function ResetPasswordChecklist({ value, lang, header }: { value: string; lang: Lang; header: string }) {
  const result = useMemo(() => checkPasswordPolicy(value), [value]);
  if (value.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">{header}</p>
      <ul className="space-y-0.5">
        {result.checks.map(c => (
          <li key={c.key} className="flex items-center gap-1.5 text-[11px]">
            {c.ok ? <Check className="w-3 h-3 text-green-600" /> : <X className="w-3 h-3 text-gray-300" />}
            <span className={c.ok ? 'text-green-700' : 'text-gray-500'}>{lang === 'kr' ? c.label.kr : c.label.en}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
