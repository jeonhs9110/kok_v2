'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { SUPPORTED_LANGS, LANG_LABELS, LANG_FLAGS, type Lang } from '@/lib/i18n/types';

export default function LanguagePicker() {
  const { lang, setLang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        id="language-picker-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 hover:border-neutral-400 transition-colors text-sm text-neutral-700 bg-white/80 backdrop-blur-sm"
        aria-label="Language selector"
      >
        <Globe className="w-3.5 h-3.5 text-neutral-500" />
        <span className="text-base leading-none">{LANG_FLAGS[lang]}</span>
        <span className="text-[13px] font-semibold hidden sm:inline">{LANG_LABELS[lang]}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id="language-picker-dropdown"
          className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-[100] animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {SUPPORTED_LANGS.map((l) => (
            <button
              key={l}
              id={`lang-option-${l}`}
              onClick={() => {
                setLang(l);
                setIsOpen(false);
                document.cookie = `kokkok_lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                l === lang ? 'font-semibold text-black bg-gray-50' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">{LANG_FLAGS[l]}</span>
              <span>{LANG_LABELS[l]}</span>
              {l === lang && <span className="ml-auto text-[10px] font-bold text-[#6b9fd4]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
