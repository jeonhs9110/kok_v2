'use client';

import { LANG_LABELS } from '@/lib/i18n/types';
import { TypographyPanel } from '@/components/admin/TypographyPanel';
import type { SlideFormData } from '../_lib';

/**
 * One section per slide element (뱃지 / 제목 / 부제목). Holds everything
 * that element controls — text, font size, font family, weight/italic/
 * underline, color, and shadow — so the admin's eye doesn't have to
 * jump across the form to tune one element.
 *
 * Replaces the property-grouped SlideTextEditor + SlideColorPicker +
 * SlideFontSizeOffsets + (typography parts of) SlideTypographyAndPosition.
 * The position pickers stay below as a separate section because they
 * apply to the entire text block, not per element.
 */

export type ElementKey = 'badge' | 'title' | 'subtitle';

interface ElementConfig {
  label: string;
  basePx: number;
  placeholder: { kr: string; en: string };
  textColorField: 'badge_text_color' | 'text_color';
  fontFamilyField: 'badge_font_family' | 'title_font_family' | 'subtitle_font_family';
  boldField: 'badge_bold' | 'title_bold' | 'subtitle_bold';
  italicField: 'badge_italic' | 'title_italic' | 'subtitle_italic';
  underlineField: 'badge_underline' | 'title_underline' | 'subtitle_underline';
  sizeOffsetField: 'badge_size_offset' | 'title_size_offset' | 'subtitle_size_offset';
  shadowField: 'badge_shadow_depth' | 'title_shadow_depth' | 'subtitle_shadow_depth';
  /** Inputs (badge) get a single-line input; title gets a textarea. */
  multiline: boolean;
  /** Title is required on the canonical Korean language. */
  required: boolean;
  /** Default color used by the picker when value is null. */
  defaultColor: string;
  /** Bg-color field only exists on badge — the slide bg_color stays as a
   *  slide-level setting elsewhere. */
  hasBgColor: boolean;
  /** Hide the color picker (subtitle reuses the title color). */
  hideColor: boolean;
}

const ELEMENT_CONFIG: Record<ElementKey, ElementConfig> = {
  badge: {
    label: '뱃지',
    basePx: 12,
    placeholder: { kr: '수분천재 크림', en: 'Moisture Cream' },
    textColorField: 'badge_text_color',
    fontFamilyField: 'badge_font_family',
    boldField: 'badge_bold',
    italicField: 'badge_italic',
    underlineField: 'badge_underline',
    sizeOffsetField: 'badge_size_offset',
    shadowField: 'badge_shadow_depth',
    multiline: false,
    required: false,
    defaultColor: '#FFFFFF',
    hasBgColor: true,
    hideColor: false,
  },
  title: {
    label: '제목',
    basePx: 48,
    placeholder: { kr: '강력한\n고보습 케어', en: 'Intense\nMoisture Care' },
    textColorField: 'text_color',
    fontFamilyField: 'title_font_family',
    boldField: 'title_bold',
    italicField: 'title_italic',
    underlineField: 'title_underline',
    sizeOffsetField: 'title_size_offset',
    shadowField: 'title_shadow_depth',
    multiline: true,
    required: true,
    defaultColor: '#111111',
    hasBgColor: false,
    hideColor: false,
  },
  subtitle: {
    label: '부제목',
    basePx: 16,
    placeholder: {
      kr: '사계절 + 속수분 + 윤광 + 모공쫀쫀',
      en: 'All-season + Deep hydration + Glow',
    },
    textColorField: 'text_color',
    fontFamilyField: 'subtitle_font_family',
    boldField: 'subtitle_bold',
    italicField: 'subtitle_italic',
    underlineField: 'subtitle_underline',
    sizeOffsetField: 'subtitle_size_offset',
    shadowField: 'subtitle_shadow_depth',
    multiline: false,
    required: false,
    defaultColor: '#111111',
    hasBgColor: false,
    hideColor: true,
  },
};

interface Props {
  element: ElementKey;
  formData: SlideFormData;
  activeLang: string;
  onUpdateField: (
    field: 'badge' | 'title' | 'subtitle',
    lang: string,
    value: string,
  ) => void;
  onPatch: (patch: Partial<SlideFormData>) => void;
}

/** Default depth assigned when the operator first toggles shadow on. */
const DEFAULT_SHADOW_DEPTH = 40;

export default function SlideElementGroup({
  element,
  formData,
  activeLang,
  onUpdateField,
  onPatch,
}: Props) {
  const cfg = ELEMENT_CONFIG[element];
  const langKey = activeLang as keyof typeof LANG_LABELS;
  const textValue = formData[element][activeLang] || '';
  const sizeOffset = formData[cfg.sizeOffsetField] || 0;
  const effectivePx = cfg.basePx + sizeOffset;
  const sampleText = (textValue || cfg.label).split('\n')[0];
  const shadowDepth = formData[cfg.shadowField];
  const shadowOn = shadowDepth !== null;

  return (
    <div className="space-y-3 pt-3 border-t border-[#e5e7eb]">
      <h4 className="text-[12px] font-bold tracking-wider text-[#1f2937] uppercase">
        {cfg.label}
      </h4>

      {/* 1. Text input — multi-lang state lives at the modal level so
          changing the tab updates every element at once. */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          텍스트 ({LANG_LABELS[langKey]}){cfg.required && activeLang === 'kr' && ' *'}
        </label>
        {cfg.multiline ? (
          <textarea
            required={cfg.required && activeLang === 'kr'}
            rows={3}
            value={textValue}
            onChange={e => onUpdateField(element, activeLang, e.target.value)}
            placeholder={activeLang === 'kr' ? cfg.placeholder.kr : cfg.placeholder.en}
            className="w-full rounded px-3 py-2 text-sm resize-none"
          />
        ) : (
          <input
            type="text"
            value={textValue}
            onChange={e => onUpdateField(element, activeLang, e.target.value)}
            placeholder={activeLang === 'kr' ? cfg.placeholder.kr : cfg.placeholder.en}
            className="w-full rounded px-3 py-2 text-sm"
          />
        )}
      </div>

      {/* 2. Font size offset — ± px nudge with a live mini-preview so the
          admin sees the change at real desktop size. */}
      <div className="grid grid-cols-[1fr_2fr] gap-3 items-end">
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <label className="text-[11px] font-semibold text-[#6b7280]">크기 (±px)</label>
            <span className="text-[10px] text-[#9ca3af] font-mono">= {effectivePx}px</span>
          </div>
          <input
            type="number"
            value={sizeOffset}
            onChange={e => onPatch({ [cfg.sizeOffsetField]: parseInt(e.target.value) || 0 } as Partial<SlideFormData>)}
            placeholder="0"
            className="w-full rounded px-3 py-2 text-sm"
          />
        </div>
        <div
          className="px-2 py-1.5 border border-[#e5e7eb] rounded bg-white overflow-hidden truncate"
          style={{
            fontSize: `${effectivePx}px`,
            lineHeight: 1.15,
            ...(shadowOn && shadowDepth !== null && {
              textShadow: `0 2px ${shadowDepth / 6}px rgba(0,0,0,${shadowDepth / 100})`,
            }),
          }}
          title={sampleText}
        >
          {sampleText}
        </div>
      </div>

      {/* 3. Font family + B/I/U + color via the shared TypographyPanel.
          The subtitle's hideColor reuses title color so it's a no-op pass
          for that element — same shape as the legacy code. */}
      <TypographyPanel
        label={`${cfg.label} 스타일`}
        value={{
          fontFamily: formData[cfg.fontFamilyField],
          bold: formData[cfg.boldField],
          italic: formData[cfg.italicField],
          underline: formData[cfg.underlineField],
          color: formData[cfg.textColorField],
        }}
        onChange={s => onPatch({
          [cfg.fontFamilyField]: s.fontFamily,
          [cfg.boldField]: s.bold,
          [cfg.italicField]: s.italic,
          [cfg.underlineField]: s.underline,
          ...(!cfg.hideColor && {
            [cfg.textColorField]: s.color ?? formData[cfg.textColorField],
          }),
        } as Partial<SlideFormData>)}
        defaultColor={cfg.defaultColor}
        hideColor={cfg.hideColor}
      />

      {/* 4. Badge gets its own bg color since it visually sits as a
          standalone chip; other elements blend into the slide. */}
      {cfg.hasBgColor && (
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">뱃지 배경색</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.badge_bg_color}
              onChange={e => onPatch({ badge_bg_color: e.target.value })}
              className="w-14 h-10 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
            />
            <input
              type="text"
              value={formData.badge_bg_color}
              onChange={e => onPatch({ badge_bg_color: e.target.value })}
              className="flex-1 rounded px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
      )}

      {/* 5. Shadow checkbox + depth slider. Off = null in DB; on with no
          slider movement = DEFAULT_SHADOW_DEPTH so the operator sees an
          immediate effect when they tick the box. */}
      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={shadowOn}
            onChange={e =>
              onPatch({
                [cfg.shadowField]: e.target.checked ? DEFAULT_SHADOW_DEPTH : null,
              } as Partial<SlideFormData>)
            }
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            그림자 적용
          </span>
        </label>
        {shadowOn && shadowDepth !== null && (
          <div className="grid grid-cols-[1fr_auto] gap-3 items-center pl-6">
            <input
              type="range"
              min={0}
              max={100}
              value={shadowDepth}
              onChange={e =>
                onPatch({ [cfg.shadowField]: parseInt(e.target.value) } as Partial<SlideFormData>)
              }
              className="w-full"
            />
            <span className="text-xs text-[#6b7280] font-mono tabular-nums w-10 text-right">
              {shadowDepth}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
