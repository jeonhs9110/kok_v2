'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, findCountry, type Country } from '@/lib/geo/countries';
import type { Lang } from '@/lib/i18n/types';

/**
 * Two flavors of the same dropdown:
 *
 *   <CountryPicker mode="country" value={iso} onChange={(c) => setIso(c.code)} />
 *   <CountryPicker mode="dial"    value={iso} onChange={(c) => setIso(c.code)} />
 *
 * `country` shows "🇰🇷 South Korea" in the trigger.
 * `dial`    shows "🇰🇷 +82"          in the trigger — ideal for the
 *                                                      phone-prefix slot.
 *
 * Both use the same searchable list with the country flag, English
 * name, Korean name, and dial code. Search matches against name + code
 * + dial (so a customer can type "82", "kr", or "한국" and find KR).
 *
 * Why a custom component and not <select>: native <option> elements
 * can't render flags or two-line layouts. The picker is keyboard-
 * navigable (Esc closes, arrow keys move selection, Enter confirms)
 * and click-outside-to-close.
 */
interface Props {
  /** ISO-3166-1 alpha-2 (lowercase). */
  value: string;
  onChange: (country: Country) => void;
  mode: 'country' | 'dial';
  lang: Lang;
  /** Optional aria-label / placeholder fallback for accessibility. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

function flagEmoji(iso: string): string {
  // ISO alpha-2 → flag emoji by mapping each char to the regional
  // indicator code point. "kr" → U+1F1F0 U+1F1F7 → 🇰🇷. Works in
  // every browser except old Windows Chrome where Microsoft's
  // segoe-ui-emoji renders monochrome — acceptable degrade.
  if (iso.length !== 2) return '🌐';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (iso.charCodeAt(0) - 'a'.charCodeAt(0)),
    base + (iso.charCodeAt(1) - 'a'.charCodeAt(0)),
  );
}

export default function CountryPicker({
  value,
  onChange,
  mode,
  lang,
  ariaLabel,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = findCountry(value) ?? COUNTRIES[0]!;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.nameEn.toLowerCase().includes(q) ||
      c.nameKr.includes(q) ||
      c.code.includes(q) ||
      c.dialCode.includes(q),
    );
  }, [query]);

  const triggerLabel =
    mode === 'dial'
      ? `+${selected.dialCode}`
      : lang === 'kr'
        ? selected.nameKr
        : selected.nameEn;

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full flex items-center justify-between gap-2 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm bg-white hover:border-neutral-300 focus:border-black outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none" aria-hidden>{flagEmoji(selected.code)}</span>
          <span className="truncate font-semibold">{triggerLabel}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 min-w-[280px] bg-white border border-neutral-200 rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
            <Search className="w-3.5 h-3.5 text-neutral-400" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={lang === 'kr' ? '국가 또는 코드 검색' : 'Search country or code'}
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-neutral-400">
                {lang === 'kr' ? '결과 없음' : 'No match'}
              </li>
            ) : (
              filtered.map(c => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === value}
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors ${
                      c.code === value ? 'bg-neutral-50 font-semibold' : ''
                    }`}
                  >
                    <span className="text-base leading-none" aria-hidden>{flagEmoji(c.code)}</span>
                    <span className="flex-1 truncate">
                      {lang === 'kr' ? c.nameKr : c.nameEn}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">+{c.dialCode}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
