'use client';

import { Bold, Italic, Underline } from 'lucide-react';
import { FONT_OPTIONS, POSITION_OPTIONS, type PositionKey } from '@/lib/typography/options';

/**
 * Shared admin controls for "text-over-image" fields. Used by the
 * SubHero banner editor (Phase 2) and the carousel slide modal
 * (Phase 3). Both surfaces give the admin the same set of decisions
 * so the dropdown / toggles look identical wherever they show up.
 *
 * Two pieces — kept in one module because they're always used together:
 *
 *   <TypographyPanel>   — per-text-block style (font, B/I/U, color)
 *   <PositionPicker>    — per-banner anchor inside the image
 *
 * Each is a controlled component: parent owns the value, panel emits
 * a patch via onChange. The parent maps the patch onto its row columns
 * (e.g. SubHero has title_* + subtitle_* pairs; carousel has the same
 * naming).
 */

export interface TextStyle {
  fontFamily: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string | null;
}

interface TypographyPanelProps {
  /** Label shown above the panel (e.g. "제목 타이포그래피") */
  label: string;
  value: TextStyle;
  onChange: (next: TextStyle) => void;
  /** Default color shown in the swatch when value.color is null */
  defaultColor?: string;
  /**
   * Hide the color column. Used by the carousel slide editor where the
   * subtitle reuses the title's `text_color` column — showing a second
   * color picker for the subtitle would silently overwrite the title's
   * color, which is the wrong mental model for the admin.
   */
  hideColor?: boolean;
}

export function TypographyPanel({ label, value, onChange, defaultColor = '#ffffff', hideColor = false }: TypographyPanelProps) {
  const set = <K extends keyof TextStyle>(key: K, v: TextStyle[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold tracking-widest text-gray-600 uppercase">{label}</p>
        <button
          type="button"
          onClick={() => onChange({ fontFamily: null, bold: false, italic: false, underline: false, color: null })}
          className="text-[10px] text-gray-400 hover:text-black transition-colors"
        >
          기본값으로 재설정
        </button>
      </div>

      <div className="grid grid-cols-12 gap-2 items-center">
        {/* Font family — width depends on whether color column is shown */}
        <div className={hideColor ? 'col-span-8' : 'col-span-7'}>
          <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1">폰트</label>
          <select
            value={value.fontFamily ?? ''}
            onChange={e => set('fontFamily', e.target.value || null)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:border-black outline-none"
          >
            <option value="">기본 (브랜드 폰트)</option>
            {FONT_OPTIONS.map(f => (
              <option key={f.key} value={f.key}>{f.label} — {f.hint}</option>
            ))}
          </select>
        </div>

        {/* B / I / U toggle group */}
        <div className={hideColor ? 'col-span-4' : 'col-span-3'}>
          <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1">스타일</label>
          <div className="flex gap-1">
            <StyleToggle pressed={value.bold}      onClick={() => set('bold', !value.bold)}            title="굵게"     ><Bold className="w-3 h-3" strokeWidth={3} /></StyleToggle>
            <StyleToggle pressed={value.italic}    onClick={() => set('italic', !value.italic)}        title="기울임"   ><Italic className="w-3 h-3" /></StyleToggle>
            <StyleToggle pressed={value.underline} onClick={() => set('underline', !value.underline)}  title="밑줄"     ><Underline className="w-3 h-3" /></StyleToggle>
          </div>
        </div>

        {/* Color picker — omitted when the consumer shares this row's
            color with another column (carousel subtitle reuses
            text_color from the title). */}
        {!hideColor && (
          <div className="col-span-2">
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1">색상</label>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={value.color ?? defaultColor}
                onChange={e => set('color', e.target.value)}
                className="w-7 h-7 rounded border border-gray-200 cursor-pointer bg-white"
                title="색상 선택"
              />
              {value.color !== null && (
                <button
                  type="button"
                  onClick={() => set('color', null)}
                  className="text-[9px] text-gray-400 hover:text-black"
                  title="기본 색상으로 되돌리기"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StyleToggle({
  pressed, onClick, title, children,
}: { pressed: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={pressed}
      className={`flex-1 flex items-center justify-center h-7 rounded border transition-colors ${
        pressed
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  );
}

// ─── 9-cell anchor picker ─────────────────────────────────────────────

interface PositionPickerProps {
  /** Stored anchor key (tl..br). null/undefined defaults to 'mc'. */
  value: PositionKey | null | undefined;
  onChange: (next: PositionKey) => void;
  /** Label shown above the picker */
  label?: string;
}

export function PositionPicker({ value, onChange, label = '텍스트 위치' }: PositionPickerProps) {
  const active = value ?? 'mc';
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold tracking-widest text-gray-600 uppercase">{label}</p>
        <span className="text-[10px] text-gray-400 font-mono">{active}</span>
      </div>
      {/* 3×3 grid drawn over a 16:9 box so the dot visually matches
          where the text will sit on the actual banner. */}
      <div className="relative aspect-[16/9] w-44 rounded-md border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-50 p-1.5">
        <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-1">
          {POSITION_OPTIONS.map(opt => {
            const isActive = opt.key === active;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChange(opt.key)}
                aria-label={`위치: ${opt.key}`}
                aria-pressed={isActive}
                className={`relative flex items-center justify-center rounded-sm transition-colors ${
                  isActive
                    ? 'bg-black/85 ring-2 ring-black/30'
                    : 'bg-white/60 hover:bg-white border border-gray-200'
                }`}
              >
                <span
                  className={`block w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-white' : 'bg-gray-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
