'use client';

import type { PageBlock } from '@/lib/pages/blocks';
import { labelClass, inputClass, ColorRow } from './common';

export default function HeroBlockEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: 'hero' }>;
  onChange: (next: PageBlock) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="md:col-span-2">
        <label className={labelClass}>제목</label>
        <input
          type="text"
          value={block.title}
          onChange={e => onChange({ ...block, title: e.target.value })}
          className={inputClass}
          placeholder="이번 주 신상품 출시"
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>서브 텍스트</label>
        <textarea
          rows={2}
          value={block.subtitle}
          onChange={e => onChange({ ...block, subtitle: e.target.value })}
          className={`${inputClass} resize-none`}
          placeholder="설명을 입력하세요"
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>이미지 URL</label>
        <input
          type="url"
          value={block.image_url}
          onChange={e => onChange({ ...block, image_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="https://..."
        />
        <p className="text-[10px] text-[#9ca3af] mt-1">에셋 라이브러리에서 URL 복사 후 붙여넣기</p>
      </div>
      <div>
        <label className={labelClass}>버튼 라벨 (선택)</label>
        <input
          type="text"
          value={block.cta_text ?? ''}
          onChange={e => onChange({ ...block, cta_text: e.target.value })}
          className={inputClass}
          placeholder="자세히 보기"
        />
      </div>
      <div>
        <label className={labelClass}>버튼 링크 (선택)</label>
        <input
          type="text"
          value={block.cta_link ?? ''}
          onChange={e => onChange({ ...block, cta_link: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="/kr/products"
        />
      </div>
      <div>
        <label className={labelClass}>레이아웃</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...block, layout: 'image-right' })}
            className={`p-2 rounded border text-xs ${
              (block.layout ?? 'image-right') === 'image-right'
                ? 'border-[#1f2937] bg-[#1f2937] text-white'
                : 'border-[#e5e7eb] bg-white text-[#374151]'
            }`}
          >
            텍스트 + 이미지
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...block, layout: 'fullbleed' })}
            className={`p-2 rounded border text-xs ${
              block.layout === 'fullbleed'
                ? 'border-[#1f2937] bg-[#1f2937] text-white'
                : 'border-[#e5e7eb] bg-white text-[#374151]'
            }`}
          >
            풀스크린 (오버레이)
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>배경색</label>
          <ColorRow
            value={block.bg_color || '#f5f5f5'}
            onChange={v => onChange({ ...block, bg_color: v })}
          />
        </div>
        <div>
          <label className={labelClass}>텍스트색</label>
          <ColorRow
            value={block.text_color || '#111111'}
            onChange={v => onChange({ ...block, text_color: v })}
          />
        </div>
      </div>
    </div>
  );
}
