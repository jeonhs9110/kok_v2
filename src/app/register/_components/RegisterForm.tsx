'use client';

import { UserPlus, Check, X } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { USE_COGNITO_FROM_BROWSER } from '@/lib/auth/clientFlags';
import { checkPasswordPolicy } from '@/lib/auth/passwordPolicy';
import { safeUrl } from '@/lib/url/safeUrl';
import CountryPicker from '@/components/CountryPicker';
import { DEFAULT_COUNTRY, findCountry, findCountryByDial } from '@/lib/geo/countries';
import type { Lang } from '@/lib/i18n/types';

const supabase = getSupabaseBrowser();

interface RegField {
  key: string;
  label_kr: string;
  label_en: string;
  type: string;
  required: boolean;
  enabled: boolean;
  options_kr?: string[];
  options_en?: string[];
}

interface AuthProviderInfo {
  provider: string;
  is_enabled: boolean;
}

interface RegConfig {
  fields: RegField[];
  require_marketing_consent: boolean;
  require_privacy_consent: boolean;
  terms_url: string;
  privacy_url: string;
}

const L: Record<Lang, {
  title: string; subtitle: string; register: string; creating: string;
  login: string; failMsg: string; emailExistsMsg: string; weakPasswordMsg: string;
  successTitle: string; successMsg: string; backToLogin: string;
  privacyConsent: string; marketingConsent: string; required: string; optional: string;
  orSocialLogin: string; agreeAll: string;
  passwordConfirmLabel: string; passwordConfirmPlaceholder: string;
  passwordsDontMatch: string; passwordPolicyHeader: string;
  expiredCodeMsg: string; alreadyConfirmedMsg: string; limitExceededMsg: string;
  startShopping: string;
}> = {
  kr: {
    title: '회원가입', subtitle: '콕콕가든 계정을 만드세요.',
    register: '회원가입', creating: '생성 중...',
    login: '이미 계정이 있으신가요? 로그인', failMsg: '회원가입에 실패했습니다.',
    emailExistsMsg: '이미 가입된 이메일입니다. 로그인하시거나 비밀번호 찾기를 이용하세요.',
    weakPasswordMsg: '비밀번호가 보안 조건을 만족하지 않습니다.',
    successTitle: '가입 완료', successMsg: '계정이 생성되었습니다. 이제 로그인할 수 있습니다.',
    backToLogin: '로그인하기',
    privacyConsent: '(필수) 개인정보 처리방침에 동의합니다.',
    marketingConsent: '(선택) 마케팅 정보 수신에 동의합니다.',
    required: '필수', optional: '선택',
    orSocialLogin: '또는 소셜 계정으로 가입',
    agreeAll: '전체 동의',
    passwordConfirmLabel: '비밀번호 확인',
    passwordConfirmPlaceholder: '비밀번호를 한 번 더 입력하세요',
    passwordsDontMatch: '비밀번호가 일치하지 않습니다.',
    passwordPolicyHeader: '비밀번호 조건',
    expiredCodeMsg: '인증번호가 만료되었습니다. 아래 "인증번호 재전송" 버튼을 눌러 새 인증번호를 받아주세요.',
    alreadyConfirmedMsg: '이미 인증된 계정입니다. 로그인 페이지에서 로그인해주세요.',
    limitExceededMsg: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    startShopping: '쇼핑 시작하기',
  },
  en: {
    title: 'Create Account', subtitle: 'Register for Kokkok Garden.',
    register: 'REGISTER', creating: 'CREATING...',
    login: 'Already have an account? Sign in', failMsg: 'Registration failed. Please try again.',
    emailExistsMsg: 'This email is already registered. Please sign in or reset your password.',
    weakPasswordMsg: 'Password does not meet the security requirements.',
    successTitle: 'Account Created', successMsg: 'Your account has been created. You can now log in.',
    backToLogin: 'GO TO LOGIN',
    privacyConsent: '(Required) I agree to the Privacy Policy.',
    marketingConsent: '(Optional) I agree to receive marketing communications.',
    required: 'Required', optional: 'Optional',
    orSocialLogin: 'or sign up with',
    agreeAll: 'Agree to all',
    passwordConfirmLabel: 'Confirm Password',
    passwordConfirmPlaceholder: 'Re-enter your password',
    passwordsDontMatch: 'Passwords do not match.',
    passwordPolicyHeader: 'Password requirements',
    expiredCodeMsg: 'The verification code has expired. Use the "Resend verification code" button below to request a new one.',
    alreadyConfirmedMsg: 'This account is already verified. Please sign in on the login page.',
    limitExceededMsg: 'Too many attempts. Please wait a few minutes and try again.',
    startShopping: 'START SHOPPING',
  },
};

const SOCIAL_BUTTONS: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  google: { label: 'Google', bg: 'bg-white border border-gray-300 hover:bg-gray-50', text: 'text-gray-700', icon: 'G' },
  kakao: { label: 'Kakao', bg: 'bg-[#FEE500] hover:bg-[#FDD800]', text: 'text-[#391B1B]', icon: 'K' },
  naver: { label: 'Naver', bg: 'bg-[#03C75A] hover:bg-[#02b350]', text: 'text-white', icon: 'N' },
  apple: { label: 'Apple', bg: 'bg-black hover:bg-gray-900', text: 'text-white', icon: '' },
};

export default function RegisterForm({ lang }: { lang: Lang }) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [config, setConfig] = useState<RegConfig | null>(null);
  const [socialProviders, setSocialProviders] = useState<AuthProviderInfo[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  // Cognito flow has a code-entry step between sign-up and success.
  // 'form' → 'code' → 'success'. Supabase flow skips 'code'.
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [confirmCode, setConfirmCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState('');

  const t = L[lang];

  // 2026-06-29: replaced direct Supabase reads with /api/auth/register-config
  // which dispatches via USE_RDS server-side. Pre-fix this loaded
  // registration_config + auth_providers_config DIRECTLY from Supabase,
  // so every operator change to required fields / social providers
  // since the 2026-06-27 cutover was invisible to the storefront register
  // form. Customers got the frozen 2026-06-27 field list.
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth/register-config', { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as {
            registration?: {
              fields?: RegField[];
              require_marketing_consent?: boolean | null;
              require_privacy_consent?: boolean | null;
              terms_url?: string | null;
              privacy_url?: string | null;
            };
            providers?: AuthProviderInfo[];
          };
          if (json.registration) {
            setConfig({
              fields: json.registration.fields ?? [],
              require_marketing_consent: json.registration.require_marketing_consent ?? true,
              require_privacy_consent: json.registration.require_privacy_consent ?? true,
              terms_url: json.registration.terms_url || '/terms',
              privacy_url: json.registration.privacy_url || '/privacy',
            });
          }
          if (json.providers) setSocialProviders(json.providers);
        }
      } catch { /* keep defaults */ }
      setConfigLoading(false);
    }
    load();
  }, []);

  const enabledFields = config?.fields.filter(f => f.enabled) ?? [
    { key: 'email', label_kr: '이메일', label_en: 'Email', type: 'email', required: true, enabled: true },
    { key: 'password', label_kr: '비밀번호', label_en: 'Password', type: 'password', required: true, enabled: true },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    for (const f of enabledFields) {
      if (f.required && !formData[f.key]?.trim()) {
        setError(`${lang === 'kr' ? f.label_kr : f.label_en} ${lang === 'kr' ? '을(를) 입력해주세요.' : 'is required.'}`);
        setIsLoading(false);
        return;
      }
    }

    // Strength + confirm match — mirrors infrastructure/cognito.tf's
    // password_policy so the client can fail fast instead of waiting on
    // Cognito's generic "InvalidPasswordException".
    const policy = checkPasswordPolicy(formData.password ?? '');
    if (!policy.allValid) {
      setError(t.weakPasswordMsg);
      setIsLoading(false);
      return;
    }
    if ((formData.password ?? '') !== (formData.password_confirm ?? '')) {
      setError(t.passwordsDontMatch);
      setIsLoading(false);
      return;
    }

    if (config?.require_privacy_consent && !privacyChecked) {
      setError(lang === 'kr' ? '개인정보 처리방침에 동의해주세요.' : 'Please agree to the Privacy Policy.');
      setIsLoading(false);
      return;
    }

    try {
      if (USE_COGNITO_FROM_BROWSER) {
        // Step 1: Cognito SignUp. The route emails a 6-digit code; we
        // advance the form to the 'code' step and keep the form fields
        // in state so they can be sent in step 4 (complete-registration).
        const res = await fetch('/api/auth/cognito/sign-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email?.trim(),
            // Round 25: STOP trimming password. Cognito accepts
            // leading/trailing spaces as valid password characters,
            // and R20 already fixed this on LoginForm — but the
            // sign-up path still trimmed. Effect: any customer who
            // pastes a manager-generated password ending in a space
            // was signed up with the trimmed variant, then on a
            // future sign-in LoginForm sent the untrimmed value and
            // Cognito rejected → permanent lockout. Mirror the R20
            // fix here.
            password: formData.password,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // Map the server's typed failure code to a friendly message.
          // Round 25 refactored the server side to return specific
          // codes (`username_exists` / `weak_password` /
          // `invalid_email` / `limit_exceeded`) — before this the
          // server collapsed everything to `sign_up_failed` and the
          // client's regex tests below were dead. Now the returning-
          // customer path (`username_exists`) actually surfaces the
          // "already registered, please sign in" message.
          const code = String(body.error ?? '');
          switch (code) {
            case 'weak_password': setError(t.weakPasswordMsg); break;
            case 'username_exists': setError(t.emailExistsMsg); break;
            case 'limit_exceeded': setError(t.limitExceededMsg); break;
            default: setError(t.failMsg); break;
          }
          return;
        }
        setStep('code');
        return;
      }
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=/`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email?.trim(),
        // Same no-trim rationale as the Cognito branch above.
        password: formData.password,
        options: { emailRedirectTo },
      });
      if (authError) { setError(authError.message); setIsLoading(false); return; }

      if (authData.user) {
        const profile: Record<string, unknown> = {
          id: authData.user.id,
          email: formData.email?.trim(),
          name: formData.name?.trim() || null,
          phone: formData.phone?.trim() || null,
          gender: formData.gender || null,
          birthday: formData.birthday || null,
          country: formData.country?.trim() || null,
          skin_type: formData.skin_type || null,
          marketing_consent: marketingChecked,
          privacy_consent: privacyChecked,
          auth_provider: 'email',
        };

        const standardKeys = ['email', 'password', 'password_confirm', 'name', 'phone', 'gender', 'birthday', 'age_range', 'country', 'skin_type'];
        const customFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(formData)) {
          if (!standardKeys.includes(k) && v) customFields[k] = v;
        }
        if (Object.keys(customFields).length > 0) profile.custom_fields = customFields;

        await supabase.from('customer_profiles').upsert(profile);
      }

      setSuccess(true);
    } catch {
      setError(t.failMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmCode.trim()) {
      setError(lang === 'kr' ? '인증번호를 입력해주세요.' : 'Enter the verification code.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      // Step 2: Confirm sign-up with the emailed code.
      const confirmRes = await fetch('/api/auth/cognito/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email?.trim(),
          code: confirmCode.trim(),
        }),
      });
      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        const code = String(body.error ?? '');
        // Round 25: distinguish the specific Cognito failures so the
        // customer knows what to do next. Expired-code was previously
        // indistinguishable from typo-code and stranded every
        // customer whose email sat unopened for >24h.
        switch (code) {
          case 'expired_code':
            setError(t.expiredCodeMsg);
            break;
          case 'already_confirmed':
            setError(t.alreadyConfirmedMsg);
            break;
          case 'limit_exceeded':
            setError(t.limitExceededMsg);
            break;
          case 'invalid_code':
          default:
            setError(lang === 'kr' ? '인증번호가 올바르지 않습니다.' : 'Invalid verification code.');
            break;
        }
        return;
      }
      // Step 3: Auto-sign-in so the cognito_id_token cookie is set and
      // step 4's route can read the sub claim.
      const signInRes = await fetch('/api/auth/cognito/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email?.trim(),
          // Round 25: no-trim, same rationale as sign-up above.
          password: formData.password,
        }),
      });
      if (!signInRes.ok) {
        // Edge case: confirmation succeeded but auto-login failed — the
        // user can still sign in manually. Show success without the
        // profile having been written.
        setSuccess(true);
        return;
      }
      // Step 4: Persist the customer_profiles row. Surface a failure
      // explicitly — without this check, a 500 here leaves the user with a
      // valid Cognito identity but no profile row, which silently breaks
      // every downstream "fetch my profile" call.
      const standardKeys = ['email', 'password', 'password_confirm', 'name', 'phone', 'gender', 'birthday', 'age_range', 'country', 'skin_type'];
      const customFields: Record<string, string> = {};
      for (const [k, v] of Object.entries(formData)) {
        if (!standardKeys.includes(k) && v) customFields[k] = v;
      }
      const completeRes = await fetch('/api/auth/cognito/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name?.trim() || null,
          phone: formData.phone?.trim() || null,
          gender: formData.gender || null,
          birthday: formData.birthday || null,
          country: formData.country?.trim() || null,
          skin_type: formData.skin_type || null,
          marketing_consent: marketingChecked,
          privacy_consent: privacyChecked,
          custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined,
        }),
      });
      if (!completeRes.ok) {
        const completeBody = await completeRes.json().catch(() => ({}));
        // Round 25: 409 already_registered means the customer_profiles
        // row was already written on a prior attempt (network hiccup +
        // retry sequence). From the customer's perspective they are
        // done — showing an error would tell them to re-fill their
        // profile from My Page, which would overwrite the row they
        // already have. Treat 409 as success.
        if (completeRes.status === 409 && completeBody.error === 'already_registered') {
          setSuccess(true);
          return;
        }
        // R20 kept the "Account created but profile save failed" copy
        // for real 5xx failures so the customer knows to complete
        // their profile from My Page later.
        setError(lang === 'kr'
          ? '계정은 생성됐지만 프로필 저장에 실패했습니다. 로그인 후 마이페이지에서 정보를 다시 입력해주세요.'
          : 'Account created but profile save failed. Please complete your profile from My Page after signing in.');
        return;
      }
      setSuccess(true);
    } catch {
      setError(t.failMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setResendNotice('');
    // Guard against empty / malformed email BEFORE the network round-
    // trip. Cognito would reject it anyway, but the operator gets a
    // faster + more helpful signal, and the /api/auth/cognito/
    // resend-code rate limit doesn't get burned on a call the client
    // could have prevented. Same shape as the sign-up path's own
    // pre-flight validation.
    const trimmedEmail = formData.email?.trim() ?? '';
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(lang === 'kr' ? '이메일 주소를 먼저 입력해주세요.' : 'Enter your email address first.');
      return;
    }
    try {
      const res = await fetch('/api/auth/cognito/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      if (!res.ok) {
        setError(lang === 'kr' ? '인증번호 재전송에 실패했습니다.' : 'Failed to resend the code.');
        return;
      }
      setResendNotice(lang === 'kr' ? '새 인증번호를 이메일로 보냈습니다.' : 'A new verification code has been sent.');
      setResendCooldown(30);
      const tick = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(tick); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError(lang === 'kr' ? '인증번호 재전송에 실패했습니다.' : 'Failed to resend the code.');
    }
  };

  const handleSocialLogin = async (provider: string) => {
    if (USE_COGNITO_FROM_BROWSER) {
      // Post-Supabase-cutoff (2026-06-29): Cognito does not have social
      // OAuth wired up yet. Show a friendly error instead of firing the
      // dead Supabase OAuth call, which would either silently no-op
      // (placeholder client) or trip a network error.
      setError(lang === 'kr' ? '소셜 로그인은 준비 중입니다.' : 'Social login is not available yet.');
      return;
    }
    try {
      await supabase.auth.signInWithOAuth({
        provider: provider as 'google' | 'kakao' | 'apple',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
    } catch {
      setError(`${provider} login failed.`);
    }
  };

  const handleAgreeAll = () => {
    const allChecked = privacyChecked && marketingChecked;
    setPrivacyChecked(!allChecked);
    setMarketingChecked(!allChecked);
  };

  if (success) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 font-extrabold text-2xl">✓</div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink mb-4">{t.successTitle}</h1>
        <p className="text-sm text-gray-500 mb-8">{t.successMsg}</p>
        {/* Round 25: send the customer to the storefront, not /login.
            The auto-sign-in in handleConfirm already set the auth
            cookies (cognito_id_token + kokkok_auth mirror), so the
            customer is authenticated. Prior link dumped them on
            /login and forced them to re-type credentials — visible
            double-friction at the highest-drop-off moment of the
            signup funnel. */}
        <Link
          href={`/${lang}`}
          className="px-8 py-3 bg-brand-ink text-white tracking-widest text-xs font-bold w-full block"
        >
          {t.startShopping}
        </Link>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-5 bg-gray-50">
            <UserPlus className="w-5 h-5 text-brand-ink" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink mb-2">
            {lang === 'kr' ? '이메일 인증' : 'Verify Email'}
          </h1>
          <p className="text-sm text-gray-500">
            {lang === 'kr'
              ? `${formData.email?.trim()} 로 발송된 6자리 인증번호를 입력하세요.`
              : `Enter the 6-digit code sent to ${formData.email?.trim()}.`}
          </p>
        </div>
        <form onSubmit={handleConfirm} className="space-y-6">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={confirmCode}
            // Strip everything that isn't a digit + cap at 6 so
            // iOS smart-paste of "인증번호: 123456" from the email
            // resolves to just "123456" instead of failing at the
            // server with a generic "Invalid verification code."
            onChange={e => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={lang === 'kr' ? '인증번호' : 'Verification code'}
            autoComplete="one-time-code"
            required
            className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-base sm:text-sm text-brand-ink placeholder:text-gray-400 tracking-widest text-center"
          />
          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
          {resendNotice && <p className="text-green-600 text-xs font-semibold text-center">{resendNotice}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-ink text-white py-3.5 font-bold tracking-widest text-[13px] rounded-lg hover:bg-black hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isLoading
              ? (lang === 'kr' ? '인증 중...' : 'VERIFYING...')
              : (lang === 'kr' ? '인증 완료' : 'CONFIRM')}
          </button>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendCooldown > 0}
            className="w-full text-xs text-gray-500 hover:text-black transition-colors underline underline-offset-4 disabled:no-underline disabled:opacity-50"
          >
            {resendCooldown > 0
              ? (lang === 'kr' ? `${resendCooldown}초 후 재전송 가능` : `Resend in ${resendCooldown}s`)
              : (lang === 'kr' ? '인증번호 다시 받기' : 'Resend verification code')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-5 bg-gray-50">
          <UserPlus className="w-5 h-5 text-brand-ink" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink mb-2">{t.title}</h1>
        <p className="text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {/* Round 25: hide social login buttons entirely in Cognito
          mode (i.e., prod). handleSocialLogin returns a hard
          "coming soon" error in this branch — displaying the
          buttons is a misleading UX (전자상거래법 unavailable-
          service advertisement) and loses the KR customer's
          highest-value acquisition path (Kakao) to confused clicks.
          When the operator wires Cognito Hosted UI IdPs later,
          drop the USE_COGNITO_FROM_BROWSER guard. */}
      {socialProviders.length > 0 && !USE_COGNITO_FROM_BROWSER && (
        <>
          <div className="space-y-2.5 mb-6">
            {socialProviders.map(sp => {
              const btn = SOCIAL_BUTTONS[sp.provider];
              if (!btn) return null;
              return (
                <button
                  key={sp.provider}
                  onClick={() => handleSocialLogin(sp.provider)}
                  className={`w-full flex items-center justify-center gap-3 py-3 rounded-lg font-semibold text-sm transition-all ${btn.bg} ${btn.text}`}
                >
                  <span className="w-5 h-5 flex items-center justify-center font-bold text-sm">{btn.icon}</span>
                  {btn.label}{lang === 'kr' ? '로 가입' : ''}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">{t.orSocialLogin}</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {configLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          enabledFields.map(f => {
            const label = lang === 'kr' ? f.label_kr : f.label_en;
            const options = lang === 'kr' ? f.options_kr : f.options_en;

            // Phone: international dial-code picker + national number.
            // Stored format in formData.phone: "+82 10-1234-5678".
            // First chunk after `+` parses back to the picker's dial code.
            if (f.key === 'phone' && f.type === 'tel') {
              const raw = formData.phone || '';
              const match = raw.match(/^\+(\d{1,4})\s*(.*)$/);
              const dialCode = match?.[1] ?? DEFAULT_COUNTRY.dialCode;
              const national = match?.[2] ?? raw;
              const selectedCountry = findCountryByDial(dialCode) ?? DEFAULT_COUNTRY;
              return (
                <div key={f.key}>
                  <label className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mb-1">
                    {label}
                    {f.required ? <span className="text-red-400">*</span> : <span className="text-gray-300">({t.optional})</span>}
                  </label>
                  <div className="flex gap-2">
                    <CountryPicker
                      mode="dial"
                      lang={lang}
                      value={selectedCountry.code}
                      onChange={c => {
                        setFormData(p => ({ ...p, phone: `+${c.dialCode} ${national}` }));
                      }}
                      ariaLabel={lang === 'kr' ? '국가 번호' : 'Country code'}
                      className="w-32 flex-shrink-0"
                    />
                    <input
                      type="tel"
                      value={national}
                      onChange={e => {
                        // Strip everything except digits, space, and dash so a paste of
                        // "+82-10-1234" doesn't double the dial prefix.
                        const cleaned = e.target.value.replace(/[^\d\s-]/g, '');
                        setFormData(p => ({ ...p, phone: `+${selectedCountry.dialCode} ${cleaned}` }));
                      }}
                      required={f.required}
                      placeholder={lang === 'kr' ? '10-1234-5678' : '10-1234-5678'}
                      autoComplete="tel-national"
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-3 text-base sm:text-sm text-brand-ink placeholder:text-gray-400 outline-none focus:border-black transition"
                    />
                  </div>
                </div>
              );
            }

            // Country: full ISO-3166 picker. Stored value is the
            // lowercase alpha-2 code; display layers look it up via
            // findCountry() and render the localized name.
            if (f.key === 'country' && f.type === 'text') {
              const current = findCountry(formData.country) ?? DEFAULT_COUNTRY;
              return (
                <div key={f.key}>
                  <label className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mb-1">
                    {label}
                    {f.required ? <span className="text-red-400">*</span> : <span className="text-gray-300">({t.optional})</span>}
                  </label>
                  <CountryPicker
                    mode="country"
                    lang={lang}
                    value={current.code}
                    onChange={c => setFormData(p => ({ ...p, country: c.code }))}
                  />
                </div>
              );
            }

            if (f.type === 'select' && options) {
              // Personal-info selects (skin type especially) get an
              // explicit "Prefer not to say" option appended unless the
              // admin already added it. Avoids forcing users to lie or
              // skip a required field.
              const sensitiveSelectKeys = ['skin_type', 'gender'];
              const isSensitive = sensitiveSelectKeys.includes(f.key);
              const optOutLabel = lang === 'kr' ? '잘 모름 / 답하지 않음' : 'Prefer not to say';
              const hasOptOutAlready = options.some(o => /모름|모르|prefer|not to say|unknown/i.test(o));
              const renderedOptions = isSensitive && !hasOptOutAlready ? [...options, optOutLabel] : options;
              return (
                <div key={f.key}>
                  <label className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mb-1">
                    {label}
                    {f.required ? <span className="text-red-400">*</span> : <span className="text-gray-300">({t.optional})</span>}
                  </label>
                  <select
                    value={formData[f.key] || ''}
                    onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    required={f.required}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-3 text-base sm:text-sm text-brand-ink outline-none focus:border-black transition"
                  >
                    <option value="">{lang === 'kr' ? '선택해주세요' : 'Select...'}</option>
                    {renderedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              );
            }

            const isPassword = f.type === 'password' && f.key === 'password';

            // htmlFor + id pair the label to the input so screen
            // readers announce the label when the input is focused —
            // without this, the visual label is just orphan text and
            // the input was effectively unlabeled (WCAG 1.3.1).
            const inputId = `register-field-${f.key}`;
            return (
              <div key={f.key}>
                <label htmlFor={inputId} className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mb-1">
                  {label}
                  {f.required ? <span className="text-red-400">*</span> : <span className="text-gray-300">({t.optional})</span>}
                </label>
                <input
                  id={inputId}
                  type={f.type}
                  value={formData[f.key] || ''}
                  onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  placeholder={label}
                  // Hint mobile keyboards / password managers about each
                  // field so iOS Safari + Chrome can offer the right
                  // saved value (email autofill, address country, etc.).
                  // Without this iOS shows the generic suggestions bar
                  // and the registration form takes ~3x longer to
                  // complete on a phone.
                  autoComplete={
                    isPassword ? 'new-password'
                    : f.type === 'email' ? 'email'
                    : f.key === 'name' ? 'name'
                    : f.key === 'phone' ? 'tel'
                    : f.key === 'country' ? 'country-name'
                    : f.key === 'birthday' ? 'bday'
                    : undefined
                  }
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-3 text-base sm:text-sm text-brand-ink placeholder:text-gray-400 outline-none focus:border-black transition"
                />
                {isPassword && (
                  <>
                    <PasswordChecklist value={formData.password ?? ''} lang={lang} header={t.passwordPolicyHeader} />
                    <label className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mt-3 mb-1">
                      {t.passwordConfirmLabel}<span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.password_confirm ?? ''}
                      onChange={e => setFormData(p => ({ ...p, password_confirm: e.target.value }))}
                      required
                      placeholder={t.passwordConfirmPlaceholder}
                      autoComplete="new-password"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-3 text-base sm:text-sm text-brand-ink placeholder:text-gray-400 outline-none focus:border-black transition"
                    />
                    {(formData.password_confirm?.length ?? 0) > 0
                      && formData.password_confirm !== formData.password && (
                      <p className="text-[11px] text-red-500 mt-1">{t.passwordsDontMatch}</p>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            {/* Round 24 a11y: moved handler from the wrapping <label>
                onClick to the input's onChange + removed readOnly so
                keyboard users pressing Space on the focused checkbox
                actually toggle the state. The prior anti-pattern
                (readOnly input + label onClick) fires nothing on
                keyboard activation. WCAG 2.1.1 Keyboard (A). */}
            <input
              type="checkbox"
              checked={privacyChecked && marketingChecked}
              onChange={handleAgreeAll}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm font-semibold text-gray-800">{t.agreeAll}</span>
          </label>
          <div className="ml-6 space-y-2">
            {config?.require_privacy_consent !== false && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={privacyChecked} onChange={() => setPrivacyChecked(!privacyChecked)} className="w-4 h-4 rounded border-gray-300 mt-0.5" />
                <span className="text-xs text-gray-600">
                  {t.privacyConsent}{' '}
                  <Link href={safeUrl(config?.privacy_url || '/privacy')} className="text-blue-500 underline" target="_blank">보기</Link>
                </span>
              </label>
            )}
            {config?.require_marketing_consent !== false && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={marketingChecked} onChange={() => setMarketingChecked(!marketingChecked)} className="w-4 h-4 rounded border-gray-300 mt-0.5" />
                <span className="text-xs text-gray-600">{t.marketingConsent}</span>
              </label>
            )}
          </div>
        </div>

        {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand-ink text-white py-3.5 font-bold tracking-widest text-[13px] rounded-lg hover:bg-black hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isLoading ? t.creating : t.register}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-gray-500 hover:text-black transition-colors underline underline-offset-4">
          {t.login}
        </Link>
      </div>
    </div>
  );
}

/**
 * Live checklist showing which password requirements the user has met.
 * Renders as a small ticked / un-ticked grid under the password input.
 * The keys here mirror checkPasswordPolicy() in src/lib/auth/passwordPolicy.ts
 * and the server-side policy in infrastructure/cognito.tf.
 */
function PasswordChecklist({ value, lang, header }: { value: string; lang: Lang; header: string }) {
  const result = useMemo(() => checkPasswordPolicy(value), [value]);
  if (value.length === 0) {
    // Don't surface the checklist until the user starts typing; otherwise
    // every blank-page state shows a wall of red ✗ icons that read as an
    // error before the user has done anything wrong.
    return null;
  }
  return (
    <div className="mt-2 mb-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">{header}</p>
      <ul className="space-y-0.5">
        {result.checks.map(c => (
          <li key={c.key} className="flex items-center gap-1.5 text-[11px]">
            {c.ok ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <X className="w-3 h-3 text-gray-300" />
            )}
            <span className={c.ok ? 'text-green-700' : 'text-gray-500'}>{c.label[lang]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
