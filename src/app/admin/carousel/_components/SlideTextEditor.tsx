'use client';

import { SUPPORTED_LANGS, LANG_LABELS } from '@/lib/i18n/types';
import type { SlideFormData } from '../_lib';

/**
 * Multi-language badge / title / subtitle inputs + link URL for the
 * carousel slide modal. Owns the active-language tab state externally
 * (parent passes activeLang + onChangeLang) so the modal can route
 * keyboard shortcuts and the unsaved-change guard against it without
 * round-tripping through this child.
 *
 * Extracted from CarouselSlideModal at 2026-06-20 as part of the 927-LOC
 * modal split — all text-content concerns now live here.
 */

interface Props {
  formData: SlideFormData;
  activeLang: string;
  onChangeLang: (lang: string) => void;
  onUpdateField: (
    field: 'badge' | 'title' | 'subtitle',
    lang: string,
    value: string,
  ) => void;
  onUpdateLink: (url: string) => void;
}

export default function SlideTextEditor({
  formData,
  activeLang,
  onChangeLang,
  onUpdateField,
  onUpdateLink,
}: Props) {
  const langKey = activeLang as keyof typeof LANG_LABELS;

  return (
    <>
      <div>
        {/* Language tabs — active tab is solid Cafe24 dark, dotted with
            a green pip when that language has any saved text. */}
        <div className="flex gap-1 mb-4">
          {SUPPORTED_LANGS.map(l => {
            const isActive = activeLang === l;
            const hasContent = formData.badge[l] || formData.title[l];
            return (
              <button
                key={l}
                type="button"
                onClick={() => onChangeLang(l)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  isActive
                    ? 'bg-[#1f2937] text-white'
                    : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
                }`}
              >
                {LANG_LABELS[l]}
                {hasContent && (
                  <span className="ml-1 w-1.5 h-1.5 bg-[#22c55e] rounded-full inline-block" />
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-1 mb-4">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            뱃지 ({LANG_LABELS[langKey]})
          </label>
          <input
            type="text"
            value={formData.badge[activeLang] || ''}
            onChange={e => onUpdateField('badge', activeLang, e.target.value)}
            placeholder={activeLang === 'kr' ? '수분천재 크림' : 'Moisture Cream'}
            className="w-full rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 mb-4">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            제목 ({LANG_LABELS[langKey]}) {activeLang === 'kr' && '*'}
          </label>
          <textarea
            required={activeLang === 'kr'}
            rows={3}
            value={formData.title[activeLang] || ''}
            onChange={e => onUpdateField('title', activeLang, e.target.value)}
            placeholder={activeLang === 'kr' ? '강력한\n고보습 케어' : 'Intense\nMoisture Care'}
            className="w-full rounded px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            부제목 ({LANG_LABELS[langKey]})
          </label>
          <input
            type="text"
            value={formData.subtitle[activeLang] || ''}
            onChange={e => onUpdateField('subtitle', activeLang, e.target.value)}
            placeholder={
              activeLang === 'kr'
                ? '사계절 + 속수분 + 윤광 + 모공쫀쫀'
                : 'All-season + Deep hydration + Glow'
            }
            className="w-full rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          클릭 링크 URL (선택)
        </label>
        <input
          type="text"
          value={formData.link_url}
          onChange={e => onUpdateLink(e.target.value)}
          placeholder="예: /kr/products 또는 https://example.com"
          className="w-full rounded px-3 py-2 text-sm"
        />
        <p className="text-[10px] text-[#9ca3af]">
          입력하면 슬라이드 클릭 시 해당 링크로 이동합니다. 비워두면 클릭 비활성.
        </p>
      </div>
    </>
  );
}
