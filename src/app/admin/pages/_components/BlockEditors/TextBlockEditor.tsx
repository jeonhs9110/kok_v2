'use client';

import type { PageBlock } from '@/lib/pages/blocks';
import { labelClass, inputClass } from './common';

export default function TextBlockEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: 'text' }>;
  onChange: (next: PageBlock) => void;
}) {
  return (
    <div>
      <label className={labelClass}>본문 HTML</label>
      <textarea
        rows={6}
        value={block.html}
        onChange={e => onChange({ ...block, html: e.target.value })}
        className={`${inputClass} font-mono text-xs resize-vertical`}
        placeholder="<p>안녕하세요</p>"
      />
      <p className="text-[10px] text-[#9ca3af] mt-1">
        HTML 태그 사용 가능 (`&lt;p&gt;`, `&lt;strong&gt;`, `&lt;a href&gt;`, `&lt;br&gt;` 등). 스크립트와 이벤트
        핸들러는 자동 제거됩니다.
      </p>
    </div>
  );
}
