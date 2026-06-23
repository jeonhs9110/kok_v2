'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  rangeFromCustom,
  type DateRange,
  type RangePreset,
} from './useDashboardData';

const PRESET_LABEL: Record<Exclude<RangePreset, 'custom'>, string> = {
  today: '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
};

const PRESETS: Exclude<RangePreset, 'custom'>[] = ['today', '7d', '30d', '90d'];

/**
 * Cafe24-style date range selector — preset chips (오늘 / 7일 / 30일 /
 * 90일) plus a "직접 선택" toggle that reveals two date inputs. The
 * heavy lifting (computing range objects) lives in useDashboardData;
 * this component is presentation + dispatch.
 */
export default function DateRangeControl({
  range,
  presets,
  onChange,
}: {
  range: DateRange;
  presets: Record<Exclude<RangePreset, 'custom'>, DateRange>;
  onChange: (next: DateRange) => void;
}) {
  const [customOpen, setCustomOpen] = useState(range.preset === 'custom');
  // Initial date strings live inside lazy useState initializers so
  // Date.now() / new Date() never runs during render — the
  // react-hooks/purity rule rejects impure calls in the render body.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [customStart, setCustomStart] = useState(() =>
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));

  function applyCustom() {
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) return;
    onChange(rangeFromCustom(customStart, customEnd));
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map(p => {
        const active = range.preset === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => {
              setCustomOpen(false);
              onChange(presets[p]);
            }}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition ${
              active
                ? 'bg-[#1f2937] text-white border-[#1f2937]'
                : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]'
            }`}
          >
            {PRESET_LABEL[p]}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setCustomOpen(v => !v)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full border transition ${
          range.preset === 'custom' || customOpen
            ? 'bg-[#1f2937] text-white border-[#1f2937]'
            : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]'
        }`}
      >
        <Calendar className="w-3 h-3" /> 직접 선택
      </button>

      {customOpen && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={customStart}
            max={customEnd || today}
            onChange={e => setCustomStart(e.target.value)}
            className="px-2 py-1 text-[11px] rounded border border-[#e5e7eb] focus:outline-none focus:border-[#3b82f6]"
          />
          <span className="text-[11px] text-[#9ca3af]">~</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={today}
            onChange={e => setCustomEnd(e.target.value)}
            className="px-2 py-1 text-[11px] rounded border border-[#e5e7eb] focus:outline-none focus:border-[#3b82f6]"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="px-2.5 py-1 text-[11px] font-bold rounded bg-[#3b82f6] text-white hover:bg-[#2563eb] transition"
          >
            적용
          </button>
        </div>
      )}
    </div>
  );
}
