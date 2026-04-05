'use client';

import { usePathname } from 'next/navigation';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';

export default function StorefrontLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAdmin = pathname.startsWith('/admin');
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/register');
  // /[lang]/ routes have their own layouts via the [lang]/layout.tsx
  const firstSeg = pathname.split('/')[1];
  const isLangRoute = SUPPORTED_LANGS.includes(firstSeg as typeof SUPPORTED_LANGS[number]);

  if (isAdmin || isAuth || isLangRoute) return <>{children}</>;

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <main className="flex-1 w-full bg-white">{children}</main>
    </div>
  );
}
