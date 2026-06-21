'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageBlock } from '@/lib/pages/blocks';
import { labelClass, inputClass } from './common';

export default function CtaBlockEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: 'cta' }>;
  onChange: (next: PageBlock) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className={labelClass}>버튼 라벨</label>
        <input
          type="text"
          value={block.label}
          onChange={e => onChange({ ...block, label: e.target.value })}
          className={inputClass}
          placeholder="구매하러 가기"
        />
      </div>
      <div>
        <label className={labelClass}>링크 URL</label>
        <input
          type="text"
          value={block.link_url}
          onChange={e => onChange({ ...block, link_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="/kr/products"
        />
      </div>
      <div>
        <label className={labelClass}>정렬</label>
        <div className="grid grid-cols-3 gap-1">
          {(['left', 'center', 'right'] as const).map(a => {
            const Icon = a === 'left' ? ChevronLeft : a === 'right' ? ChevronRight : null;
            return (
              <button
                key={a}
                type="button"
                onClick={() => onChange({ ...block, align: a })}
                className={`p-2 rounded border text-xs flex items-center justify-center ${
                  (block.align ?? 'center') === a
                    ? 'border-[#1f2937] bg-[#1f2937] text-white'
                    : 'border-[#e5e7eb] bg-white text-[#374151]'
                }`}
              >
                {Icon ? <Icon className="w-4 h-4" /> : '⋯'}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className={labelClass}>스타일</label>
        <div className="grid grid-cols-2 gap-1">
          {(['primary', 'secondary'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...block, style: s })}
              className={`p-2 rounded border text-xs ${
                (block.style ?? 'primary') === s
                  ? 'border-[#1f2937] bg-[#1f2937] text-white'
                  : 'border-[#e5e7eb] bg-white text-[#374151]'
              }`}
            >
              {s === 'primary' ? '검정' : '흰색 (보더)'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
