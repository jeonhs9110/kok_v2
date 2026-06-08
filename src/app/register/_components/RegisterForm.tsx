'use client';

import { UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
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
  login: string; failMsg: string; successTitle: string; successMsg: string; backToLogin: string;
  privacyConsent: string; marketingConsent: string; required: string; optional: string;
  orSocialLogin: string; minChars: string; agreeAll: string;
}> = {
  kr: {
    title: '회원가입', subtitle: '콕콕가든 계정을 만드세요.',
    register: '회원가입', creating: '생성 중...',
    login: '이미 계정이 있으신가요? 로그인', failMsg: '회원가입에 실패했습니다.',
    successTitle: '가입 완료', successMsg: '계정이 생성되었습니다. 이제 로그인할 수 있습니다.',
    backToLogin: '로그인하기',
    privacyConsent: '(필수) 개인정보 처리방침에 동의합니다.',
    marketingConsent: '(선택) 마케팅 정보 수신에 동의합니다.',
    required: '필수', optional: '선택',
    orSocialLogin: '또는 소셜 계정으로 가입',
    minChars: '비밀번호는 8자 이상이어야 합니다.',
    agreeAll: '전체 동의',
  },
  en: {
    title: 'Create Account', subtitle: 'Register for Kokkok Garden.',
    register: 'REGISTER', creating: 'CREATING...',
    login: 'Already have an account? Sign in', failMsg: 'Registration failed. Please try again.',
    successTitle: 'Account Created', successMsg: 'Your account has been created. You can now log in.',
    backToLogin: 'GO TO LOGIN',
    privacyConsent: '(Required) I agree to the Privacy Policy.',
    marketingConsent: '(Optional) I agree to receive marketing communications.',
    required: 'Required', optional: 'Optional',
    orSocialLogin: 'or sign up with',
    minChars: 'Password must be at least 8 characters.',
    agreeAll: 'Agree to all',
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

  const t = L[lang];

  useEffect(() => {
    async function load() {
      try {
        const [regRes, authRes] = await Promise.all([
          supabase.from('registration_config').select('*').single(),
          supabase.from('auth_providers_config').select('provider, is_enabled').eq('is_enabled', true),
        ]);
        if (regRes.data) {
          setConfig({
            fields: regRes.data.fields || [],
            require_marketing_consent: regRes.data.require_marketing_consent ?? true,
            require_privacy_consent: regRes.data.require_privacy_consent ?? true,
            terms_url: regRes.data.terms_url || '/terms',
            privacy_url: regRes.data.privacy_url || '/privacy',
          });
        }
        if (authRes.data) setSocialProviders(authRes.data);
      } catch { /* tables may not exist, use defaults */ }
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

    // Align register with reset (which already required 8). Previously 6
    // here, 8 in reset — a user registering at 7 chars then resetting was
    // forced to pick a fresh longer password. Same min everywhere now.
    if ((formData.password?.length || 0) < 8) {
      setError(t.minChars);
      setIsLoading(false);
      return;
    }

    if (config?.require_privacy_consent && !privacyChecked) {
      setError(lang === 'kr' ? '개인정보 처리방침에 동의해주세요.' : 'Please agree to the Privacy Policy.');
      setIsLoading(false);
      return;
    }

    try {
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=/`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email?.trim(),
        password: formData.password?.trim(),
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

        const standardKeys = ['email', 'password', 'name', 'phone', 'gender', 'birthday', 'age_range', 'country', 'skin_type'];
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

  const handleSocialLogin = async (provider: string) => {
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
        <Link href="/login" className="px-8 py-3 bg-brand-ink text-white tracking-widest text-xs font-bold w-full block">{t.backToLogin}</Link>
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

      {socialProviders.length > 0 && (
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

            if (f.type === 'select' && options) {
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
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-3 text-sm text-brand-ink outline-none focus:border-black transition"
                  >
                    <option value="">{lang === 'kr' ? '선택해주세요' : 'Select...'}</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              );
            }

            return (
              <div key={f.key}>
                <label className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mb-1">
                  {label}
                  {f.required ? <span className="text-red-400">*</span> : <span className="text-gray-300">({t.optional})</span>}
                </label>
                <input
                  type={f.type}
                  value={formData[f.key] || ''}
                  onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  placeholder={label}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-3 text-sm text-brand-ink placeholder:text-gray-400 outline-none focus:border-black transition"
                />
              </div>
            );
          })
        )}

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer" onClick={handleAgreeAll}>
            <input type="checkbox" checked={privacyChecked && marketingChecked} readOnly className="w-4 h-4 rounded border-gray-300" />
            <span className="text-sm font-semibold text-gray-800">{t.agreeAll}</span>
          </label>
          <div className="ml-6 space-y-2">
            {config?.require_privacy_consent !== false && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={privacyChecked} onChange={() => setPrivacyChecked(!privacyChecked)} className="w-4 h-4 rounded border-gray-300 mt-0.5" />
                <span className="text-xs text-gray-600">
                  {t.privacyConsent}{' '}
                  <Link href={config?.privacy_url || '/privacy'} className="text-blue-500 underline" target="_blank">보기</Link>
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
