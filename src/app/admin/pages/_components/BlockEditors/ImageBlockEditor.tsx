'use client';

import type { PageBlock } from '@/lib/pages/blocks';
import { labelClass, inputClass } from './common';

export default function ImageBlockEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: 'image' }>;
  onChange: (next: PageBlock) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="md:col-span-2">
        <label className={labelClass}>이미지 URL</label>
        <input
          type="url"
          value={block.image_url}
          onChange={e => onChange({ ...block, image_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="https://..."
        />
      </div>
      <div>
        <label className={labelClass}>대체 텍스트 (alt)</label>
        <input
          type="text"
          value={block.alt}
          onChange={e => onChange({ ...block, alt: e.target.value })}
          className={inputClass}
          placeholder="스크린리더에 읽힐 설명"
        />
      </div>
      <div>
        <label className={labelClass}>링크 URL (선택)</label>
        <input
          type="text"
          value={block.link_url ?? ''}
          onChange={e => onChange({ ...block, link_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="/kr/products/123"
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>캡션 (선택)</label>
        <input
          type="text"
          value={block.caption ?? ''}
          onChange={e => onChange({ ...block, caption: e.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>최대 너비 (px)</label>
        <input
          type="number"
          min="200"
          max="2400"
          step="100"
          value={block.max_width ?? 1200}
          onChange={e => onChange({ ...block, max_width: Number(e.target.value) || 1200 })}
          className={inputClass}
        />
      </div>
    </div>
  );
}
