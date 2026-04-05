'use client';
import { Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const L: Record<string, { title: string; subtitle: string; email: string; password: string; signin: string; verifying: string; register: string; error: string }> = {
  kr: { title: '로그인', subtitle: '콕콕가든 스토어에 로그인하세요.', email: '이메일 주소', password: '비밀번호', signin: '로그인', verifying: '확인 중...', register: '회원가입', error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
  en: { title: 'Sign In', subtitle: 'Sign in to Kokkok Garden storefront.', email: 'Email Address', password: 'Password', signin: 'SIGN IN', verifying: 'VERIFYING...', register: 'Create an account', error: 'Invalid email or password.' },
};

function detectLang(): string {
  if (typeof window === 'undefined') return 'kr';
  const cookie = document.cookie.match(/kokkok_lang=(\w+)/);
  if (cookie && ['kr','en'].includes(cookie[1])) return cookie[1];
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith('ko')) return 'kr';
  if (nav.startsWith('zh')) return 'cn';
  if (nav.startsWith('ja')) return 'jp';
  if (nav.startsWith('vi')) return 'vn';
  if (nav.startsWith('th')) return 'th';
  return 'en';
}

export default function LoginPage() {
  const [id, setId] = useState('');
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
      if (supabase) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: id.trim(),
          password: password.trim(),
        });
        if (!authError) {
          document.cookie = "kokkok_auth=true; path=/; max-age=86400; Secure; SameSite=Lax";
          // Check if user is admin
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
            if (profile?.role === 'admin') {
              document.cookie = "kokkok_admin_auth=true; path=/; max-age=86400; Secure; SameSite=Lax";
            }
          }
          window.location.href = `/${lang}`;
          return;
        }
      }

      setError(t.error);
    } catch {
      setError(t.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans px-4 animate-in fade-in duration-500">
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
              type="text" value={id} onChange={e => setId(e.target.value)}
              placeholder={t.email}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-[#111111] placeholder:text-gray-400"
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t.password}
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-[#111111] placeholder:text-gray-400"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full bg-[#111111] text-white py-4 font-bold tracking-widest text-[13px] hover:bg-black hover:shadow-lg transition-all mt-8 disabled:opacity-50">
            {isLoading ? t.verifying : t.signin}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <Link href="/register" className="text-gray-500 hover:text-black transition-colors font-medium underline underline-offset-4">
            {t.register}
          </Link>
        </div>
      </div>
    </div>
  );
}
