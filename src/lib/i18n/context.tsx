'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Lang } from './types';
import { isValidLang } from './types';
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
    const segments = pathname.split('/').filter(Boolean);
    // Only swap segments[0] when it's ALREADY a supported lang (i.e.
    // the visitor is on a /[lang]/... route). Otherwise the flag click
    // used to blindly overwrite `/login` / `/register` / `/cart` /
    // `/admin/*` etc. — dumping the customer on `/kr` or 404-ing the
    // admin. Round 25 broken-link audit flagged this after finding an
    // admin who clicked KR on /admin/homepage and landed on
    // /kr/homepage (a route that doesn't exist).
    if (segments.length >= 1 && isValidLang(segments[0])) {
      segments[0] = newLang;
      router.push('/' + segments.join('/'));
      return;
    }
    // Non-lang route: keep the customer on the same page and just let
    // the [lang]-detection cookie carry the preference forward. The
    // cookie is set by LanguagePicker itself right before this call.
    router.refresh();
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
