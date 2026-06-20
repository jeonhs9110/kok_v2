'use client';

import { FONT_OPTIONS } from '@/lib/typography/options';

/**
 * Three small form primitives used throughout the theme editor:
 *
 *   - Section: a label + children stack with the standard 11px Cafe24
 *     uppercase tracking-wider title
 *   - ColorRow: color picker + hex input pair with a single label
 *   - FontRow: brand-or-custom font dropdown that stores a CSS family
 *     string; reveals an inline text input in "custom" mode for paste-
 *     ing arbitrary stacks
 *
 * Extracted from /admin/theme/page.tsx at 2026-06-21. Each was a local
 * function at the bottom of the 762-LOC file.
 */

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
          {label}
        </label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-9 h-9 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="flex-1 rounded px-2 py-1.5 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Font picker for the theme tokens. Stores the CSS font-family string
 * (same shape `font_body` / `font_display` always had) so existing
 * theme_tokens rows keep rendering unchanged, but presents a dropdown
 * of the 8 brand + Google-loaded fonts the rest of the admin uses.
 *
 * "기타 (직접 입력)" reveals the legacy text input so an admin can paste
 * any CSS family stack — handy when previewing a font we haven't added
 * to FONT_OPTIONS yet.
 *
 * Mode is derived from `value`: if the stored string matches any of
 * FONT_OPTIONS[].cssFamily exactly, the dropdown shows that entry;
 * otherwise it falls into "custom" mode and reveals the text field.
 * Switching from custom back to a preset clears the text field.
 */
export function FontRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const presetMatch = FONT_OPTIONS.find(f => f.cssFamily === value);
  const isCustom = value.trim() !== '' && !presetMatch;
  const selectValue =
    value.trim() === '' ? '' : presetMatch ? presetMatch.key : '__custom__';

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
        {label}
      </label>
      <select
        value={selectValue}
        onChange={e => {
          const v = e.target.value;
          if (v === '') onChange(''); // back to brand default
          else if (v === '__custom__') onChange(value || ' '); // force non-empty so chip shows
          else {
            const opt = FONT_OPTIONS.find(f => f.key === v);
            if (opt) onChange(opt.cssFamily);
          }
        }}
        className="w-full rounded px-2 py-1.5 text-xs bg-white"
      >
        <option value="">기본 (비워둠 — 브랜드 폰트)</option>
        {FONT_OPTIONS.map(f => (
          <option key={f.key} value={f.key}>
            {f.label} — {f.hint}
          </option>
        ))}
        <option value="__custom__">기타 (직접 입력)</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          placeholder='예: "Helvetica Neue", system-ui, sans-serif'
          onChange={e => onChange(e.target.value)}
          className="w-full rounded px-2 py-1.5 text-xs font-mono"
        />
      )}
    </div>
  );
}
