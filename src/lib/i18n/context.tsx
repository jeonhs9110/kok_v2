'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Lang } from './types';
import { translations, type TranslationKey } from './translations';

interface I18nContextValue {
  lang: Lang;
  isKorea: boolean;
  t: (key: TranslationKey) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'kr',
  isKorea: true,
  t: (key) => key,
  setLang: () => {},
});

export function I18nProvider({ children, isKorea, lang: langProp }: {
  children: React.ReactNode;
  isKorea: boolean;
  lang: Lang;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const t = useMemo(() => (key: TranslationKey): string => {
    return translations[langProp]?.[key] ?? translations['en'][key] ?? key;
  }, [langProp]);

  const setLang = (newLang: Lang) => {
    // Path format: /<lang>/...
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 1) {
      segments[0] = newLang;
      router.push('/' + segments.join('/'));
    } else {
      router.push(`/${newLang}`);
    }
  };

  return (
    <I18nContext.Provider value={{ lang: langProp, isKorea, t, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
