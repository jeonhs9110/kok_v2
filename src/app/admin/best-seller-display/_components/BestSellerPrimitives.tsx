'use client';

/**
 * Two form primitives shared by /admin/best-seller-display:
 *
 *   - Control: a label + slider + minus/plus button trio with tick marks
 *     underneath. Used for card_scale / gap_x / gap_y on the layout
 *     editor.
 *   - SizePicker: preset row + numeric direct input (px). Mirrors the
 *     /admin/theme size-token UX so the operator's muscle memory
 *     carries over.
 *
 * Extracted from page.tsx at 2026-06-21.
 */

interface ControlProps {
  label: string;
  hint: string;
  valueLabel: string;
  onMinus: () => void;
  onPlus: () => void;
  sliderProps: React.InputHTMLAttributes<HTMLInputElement>;
  ticks: number[];
}

export function Control({
  label,
  hint,
  valueLabel,
  onMinus,
  onPlus,
  sliderProps,
  ticks,
}: ControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-[#374151]">{label}</div>
          <div className="text-[11px] text-[#9ca3af]">{hint}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMinus}
            className="w-7 h-7 flex items-center justify-center text-[#6b7280] border border-[#d1d5db] rounded hover:bg-[#f9fafb]"
            aria-label="감소"
          >
            −
          </button>
          <div className="w-16 text-center text-[13px] font-mono font-semibold text-[#1f2937]">
            {valueLabel}
          </div>
          <button
            type="button"
            onClick={onPlus}
            className="w-7 h-7 flex items-center justify-center text-[#6b7280] border border-[#d1d5db] rounded hover:bg-[#f9fafb]"
            aria-label="증가"
          >
            +
          </button>
        </div>
      </div>
      <input type="range" {...sliderProps} className="w-full" />
      <div className="flex justify-between text-[10px] text-[#9ca3af] font-mono px-0.5">
        {ticks.map(t => (
          <span key={t}>{Number.isInteger(t) ? t : t.toFixed(2)}</span>
        ))}
      </div>
    </div>
  );
}

export function SizePicker({
  label,
  value,
  fallback,
  presets,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  fallback: number;
  presets: { v: string; l: string }[];
  min: number;
  max: number;
  onChange: (v: string) => void;
}) {
  const parsed = parseInt(value, 10);
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return (
    <div>
      <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
        {label}
      </label>
      <div className="grid grid-cols-4 gap-1.5 mt-1">
        {presets.map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`p-2 font-semibold border rounded ${
              value === opt.v
                ? 'bg-[#1f2937] text-white border-[#1f2937]'
                : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af]'
            }`}
            style={{ fontSize: opt.v }}
          >
            {opt.l}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-[10px] font-semibold tracking-wider text-[#6b7280] uppercase">
          직접 입력
        </label>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={safe}
          onChange={e => {
            const raw = parseInt(e.target.value, 10);
            if (!Number.isFinite(raw)) return;
            onChange(`${Math.max(min, Math.min(max, raw))}px`);
          }}
          className="w-20 px-2 py-1 text-xs rounded"
        />
        <span className="text-[10px] text-[#6b7280]">px ({min}–{max})</span>
      </div>
    </div>
  );
}

/** JSON.parse with a null fallback — used by the parent's initial load
 *  effect to tolerate malformed site_settings rows. */
export function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
