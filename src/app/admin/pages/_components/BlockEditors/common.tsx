'use client';

export const labelClass = 'text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider';
export const inputClass = 'w-full rounded px-3 py-2 text-sm bg-white';

export function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-10 h-10 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputClass} font-mono text-xs flex-1`}
      />
    </div>
  );
}
