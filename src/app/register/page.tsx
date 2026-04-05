'use client';
import { UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const L: Record<string, { title: string; subtitle: string; email: string; password: string; register: string; creating: string; login: string; minChars: string; failMsg: string; successTitle: string; successMsg: string; backToLogin: string }> = {
  kr: { title: '회원가입', subtitle: '콕콕가든 계정을 만드세요.', email: '이메일 주소', password: '비밀번호 (6자 이상)', register: '회원가입', creating: '생성 중...', login: '로그인으로 돌아가기', minChars: '비밀번호는 6자 이상이어야 합니다.', failMsg: '회원가입에 실패했습니다. 다시 시도해주세요.', successTitle: '가입 완료', successMsg: '계정이 생성되었습니다. 이제 로그인할 수 있습니다.', backToLogin: '로그인하기' },
  en: { title: 'Create Account', subtitle: 'Register for Kokkok Garden.', email: 'Email Address', password: 'Password (min 6 chars)', register: 'REGISTER', creating: 'CREATING...', login: 'Back to login', minChars: 'Password must be at least 6 characters.', failMsg: 'Registration failed. Please try again.', successTitle: 'Account Created', successMsg: 'Your account has been created. You can now log in.', backToLogin: 'GO TO LOGIN' },
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

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lang, setLang] = useState('kr');
  const t = L[lang] ?? L['en'];

  useEffect(() => { setLang(detectLang()); }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password.length < 6) {
      setError(t.minChars);
      setIsLoading(false);
      return;
    }

    try {
      if (!supabase) throw new Error('No client');
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      if (authError) {
        setError(authError.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t.failMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans px-4 animate-in fade-in duration-500">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 font-extrabold text-2xl">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] mb-4">{t.successTitle}</h1>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">{t.successMsg}</p>
          <Link href="/login" className="px-8 py-3 bg-[#111111] text-white tracking-widest text-xs font-bold w-full block">
            {t.backToLogin}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans px-4 animate-in fade-in duration-500">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-50">
            <UserPlus className="w-5 h-5 text-[#111111]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] mb-2">{t.title}</h1>
          <p className="text-sm text-gray-500">{t.subtitle}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={t.email} required
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-[#111111] placeholder:text-gray-400"
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t.password} required
              className="w-full bg-white border-b border-gray-200 px-2 py-3 focus:outline-none focus:border-black transition text-sm text-[#111111] placeholder:text-gray-400"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full bg-[#111111] text-white py-4 font-bold tracking-widest text-[13px] hover:bg-black hover:shadow-lg transition-all mt-8 disabled:opacity-50">
            {isLoading ? t.creating : t.register}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <Link href="/login" className="text-gray-500 hover:text-black transition-colors font-medium underline underline-offset-4">
            {t.login}
          </Link>
        </div>
      </div>
    </div>
  );
}
