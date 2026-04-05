export type Lang = 'kr' | 'en';

export const SUPPORTED_LANGS: Lang[] = ['kr', 'en'];

export const LANG_LABELS: Record<Lang, string> = {
  kr: '한국어',
  en: 'English',
};

export const LANG_FLAGS: Record<Lang, string> = {
  kr: '🇰🇷',
  en: '🇺🇸',
};

export function isValidLang(lang: string): lang is Lang {
  return SUPPORTED_LANGS.includes(lang as Lang);
}
