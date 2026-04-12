'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import Link from 'next/link';

const L: Record<string, { message: string; accept: string; decline: string; link: string }> = {
  kr: {
    message: '이 웹사이트는 맞춤 서비스를 위해 쿠키를 사용합니다.',
    accept: '동의',
    decline: '거부',
    link: '개인정보처리방침',
  },
  en: {
    message: 'We use cookies to provide personalized services and improve your experience.',
    accept: 'Accept',
    decline: 'Decline',
    link: 'Privacy Policy',
  },
};

export default function CookieConsent() {
  const { lang } = useI18n();
  const t = L[lang] ?? L['en'];
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = document.cookie.match(/kokkok_cookie_consent=(\w+)/);
    if (!consent) setShow(true);
  }, []);

  const handleAccept = () => {
    document.cookie = 'kokkok_cookie_consent=accepted; path=/; max-age=31536000; SameSite=Lax';
    setShow(false);
  };

  const handleDecline = () => {
    document.cookie = 'kokkok_cookie_consent=declined; path=/; max-age=31536000; SameSite=Lax';
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200 p-4 flex flex-col sm:flex-row items-center gap-3">
        <p className="text-sm text-gray-600 flex-1">
          {t.message}{' '}
          <Link href={`/${lang}/privacy`} className="text-blue-500 underline underline-offset-2 text-xs">{t.link}</Link>
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleDecline} className="px-4 py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            {t.decline}
          </button>
          <button onClick={handleAccept} className="px-4 py-2 text-xs font-semibold text-white bg-[#111] rounded-lg hover:bg-black transition">
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
