'use client';

import { normalizeEmbedUrl, type PageBlock } from '@/lib/pages/blocks';
import { labelClass, inputClass } from './common';

export default function EmbedBlockEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: 'embed' }>;
  onChange: (next: PageBlock) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className={labelClass}>종류</label>
        <div className="grid grid-cols-3 gap-1">
          {(['youtube', 'vimeo', 'iframe'] as const).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...block, embed_kind: k })}
              className={`p-2 rounded border text-xs ${
                block.embed_kind === k
                  ? 'border-[#1f2937] bg-[#1f2937] text-white'
                  : 'border-[#e5e7eb] bg-white text-[#374151]'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClass}>비율</label>
        <div className="grid grid-cols-3 gap-1">
          {(['16/9', '4/3', '1/1'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ ...block, aspect: a })}
              className={`p-2 rounded border text-xs ${
                (block.aspect ?? '16/9') === a
                  ? 'border-[#1f2937] bg-[#1f2937] text-white'
                  : 'border-[#e5e7eb] bg-white text-[#374151]'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>URL</label>
        <input
          type="url"
          value={block.url}
          onChange={e =>
            onChange({ ...block, url: normalizeEmbedUrl(e.target.value, block.embed_kind) })
          }
          className={`${inputClass} font-mono text-xs`}
          placeholder={
            block.embed_kind === 'youtube'
              ? 'https://www.youtube.com/watch?v=...'
              : block.embed_kind === 'vimeo'
              ? 'https://vimeo.com/...'
              : 'https://...'
          }
        />
        <p className="text-[10px] text-[#9ca3af] mt-1">
          유튜브 watch / shorts URL은 자동으로 embed URL로 변환됩니다.
        </p>
      </div>
    </div>
  );
}
