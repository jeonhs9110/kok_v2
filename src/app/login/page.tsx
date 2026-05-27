'use client';
import { Lock } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { I18nProvider } from '@/lib/i18n/context';
import { isValidLang, type Lang } from '@/lib/i18n/types';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const L: Record<string, { title: string; subtitle: string; email: string; password: string; signin: string; verifying: string; register: string; error: string }> = {
  kr: { title: '로그인', subtitle: '콕콕가든 스토어에 로그인하세요.', email: '이메일 주소', password: '비밀번호', signin: '로그인', verifying: '확인 중...', register: '회원가입', error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
  en: { title: 'Sign In', subtitle: 'Sign in to Kokkok Garden storefront.', email: 'Email Address', password: 'Password', signin: 'SIGN IN', verifying: 'VERIFYING...', register: 'Create an account', error: 'Invalid email or password.' },
};

function detectLang(): string {
  if (typeof window === 'undefined') return 'kr';
  const cookie = document.cookie.match(/kokkok_lang=(\w+)/);
  if (cookie && ['kr', 'en'].includes(cookie[1])) return cookie[1];
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith('ko')) return 'kr';
  return 'en';
}

/**
 * Sanitize the `?next=` redirect target so a crafted link can't bounce
 * users off-site. Allow only same-origin absolute paths.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null; // protocol-relative
  return raw;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState('kr');
  const t = L[lang] ?? L['en'];

  useEffect(() => { setLang(detectLang()); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Singleton browser client backed by @supabase/ssr — cookie format
      // matches what `proxy.ts` expects on the next request, so the
      // session is recognized server-side without a refresh.
      const supabase = getSupabaseBrowser();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError || !data.user) {
        setError(t.error);
        return;
      }

      // Resolve landing page:
      //   1. ?next=/some/path → honor it (already sanitized).
      //   2. Admin role        → /admin.
      //   3. Otherwise         → home in the user's language.
      // Role lookup uses the same query the middleware does, so the
      // post-login redirect is consistent with what /admin/* will allow.
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

  const i18nLang: Lang = isValidLang(lang) ? lang : 'kr';

  return (
    <I18nProvider isKorea={i18nLang === 'kr'} lang={i18nLang}>
      <div className="flex flex-col min-h-screen bg-white font-sans">
        <Header canPurchase={true} />
        <main className="flex-1 w-full flex items-center justify-center px-4 py-16 animate-in fade-in duration-500">
          <div className="w-full max-w-sm">
            <div className="text-center mb-10">
              <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-50">
                <Lock className="w-5 h-5 text-[#111111]" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] mb-2">{t.title}</h1>
              <p className="text-sm text-gray-500">{t.subtitle}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t.email}
                  autoComplete="email"
                  required
                  className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-[#111111] placeholder:text-gray-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t.password}
                  autoComplete="current-password"
                  required
                  className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-[#111111] placeholder:text-gray-400"
                />
              </div>

              {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#111111] text-white py-4 font-bold tracking-widest text-[13px] hover:bg-black hover:shadow-lg transition-all mt-8 disabled:opacity-50"
              >
                {isLoading ? t.verifying : t.signin}
              </button>
            </form>

            <div className="mt-8 text-center text-sm">
              <Link href="/register" className="text-gray-500 hover:text-black transition-colors font-medium underline underline-offset-4">
                {t.register}
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}

export default function LoginPage() {
  // useSearchParams must be inside a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
