'use client';

/**
 * Generic preset-picker + numeric-override row used by all three font-size
 * controls in /admin/theme's ShapeSection (header menu, header submenu,
 * subhero subtitle). Each preset button renders its label at the picked
 * font size so the admin sees the relative difference at a glance.
 */
interface Props {
  label: string;
  /** Current value, expected as a px string (e.g. "15px" or "12.5px"). */
  value: string;
  /** Persisted on every change. */
  onChange: (next: string) => void;
  /** Preset chips, e.g. [{ v: '15px', l: '기본' }]. */
  presets: Array<{ v: string; l: string }>;
  /** Number of columns in the preset grid. */
  gridCols: 4 | 5;
  /** Numeric input clamp: [min, max] + step (px). */
  min: number;
  max: number;
  step: number;
  /** Fallback when parseInt/parseFloat fails. */
  fallback: number;
  /** Helper text under the input. */
  hint: string;
  /** Use parseFloat instead of parseInt (only header_submenu wants .5px step). */
  parseFloatMode?: boolean;
}

export default function FontSizePresetPicker({
  label,
  value,
  onChange,
  presets,
  gridCols,
  min,
  max,
  step,
  fallback,
  hint,
  parseFloatMode,
}: Props) {
  const parse = parseFloatMode ? parseFloat : (s: string) => parseInt(s, 10);

  return (
    <div>
      <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">{label}</label>
      <div className={`grid grid-cols-${gridCols} gap-1.5 mt-1`}>
        {presets.map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`p-2 font-semibold border rounded ${
              value === opt.v
                ? 'bg-[#1f2937] text-white border-[#1f2937]'
                : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af] kokkok-keep-border'
            }`}
            style={{ fontSize: opt.v }}
          >
            {opt.l}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-[10px] font-bold tracking-widest text-[#6b7280] uppercase">
          직접 입력
        </label>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={parse(value) || fallback}
          onChange={e => {
            const raw = parse(e.target.value);
            if (!Number.isFinite(raw)) return;
            const clamped = Math.max(min, Math.min(max, raw));
            onChange(`${clamped}px`);
          }}
          className="w-20 px-2 py-1 text-xs rounded"
        />
        <span className="text-[10px] text-[#6b7280]">{hint}</span>
      </div>
    </div>
  );
}
