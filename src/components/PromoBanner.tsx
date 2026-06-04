'use client';

import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

const COOKIE_KEY = 'kokkok_promo_hidden';

function subscribeNoop() {
  return () => {};
}

function getServerSnapshot() {
  // Hide on SSR + first client paint — see CookieConsent for the same
  // pattern. Avoids hydration mismatch + lets the second client render
  // surface the real cookie state.
  return true;
}

function getClientSnapshot() {
  return document.cookie.includes(`${COOKIE_KEY}=1`);
}

export default function PromoBanner() {
  const { t } = useI18n();
  const hiddenByCookie = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);
  const [hideToday, setHideToday] = useState(false);

  if (hiddenByCookie || dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    if (hideToday) {
      const expires = new Date();
      expires.setHours(23, 59, 59, 999);
      document.cookie = `${COOKIE_KEY}=1; path=/; expires=${expires.toUTCString()}`;
    }
  };

  return (
    <div className="bg-brand-primary text-white text-[12.5px] font-medium tracking-wide py-2.5 px-4 z-50 flex items-center justify-center relative">
      <div className="flex items-center gap-2">
        <span>{t('promo.message')}</span>
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-white/70 hover:text-white/90 transition-colors">
          <input
            type="checkbox"
            checked={hideToday}
            onChange={e => setHideToday(e.target.checked)}
            className="w-3 h-3 rounded border-white/40 accent-white"
          />
          {t('promo.hideToday')}
        </label>
        <button
          onClick={handleClose}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
