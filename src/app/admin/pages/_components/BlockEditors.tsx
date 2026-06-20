'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { normalizeEmbedUrl, type PageBlock } from '@/lib/pages/blocks';

/**
 * Per-type editors for the section-based page builder. All 5 block
 * types (hero / text / image / cta / embed) plus a tiny ColorRow
 * helper live together in one file — splitting into 5 files would
 * add navigation overhead without much organizational benefit at this
 * size. Extracted from PageBlocksEditor at 2026-06-21.
 *
 * Pure UI: each editor receives the block and an onChange callback,
 * doesn't reach into parent state otherwise.
 */

const labelClass = 'text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider';
const inputClass = 'w-full rounded px-3 py-2 text-sm bg-white';

/** Dispatcher — picks the right editor for the block's type. */
export function BlockEditor({
  block,
  onChange,
}: {
  block: PageBlock;
  onChange: (next: PageBlock) => void;
}) {
  switch (block.type) {
    case 'hero':
      return <HeroEditor block={block} onChange={onChange} />;
    case 'text':
      return <TextEditor block={block} onChange={onChange} />;
    case 'image':
      return <ImageEditor block={block} onChange={onChange} />;
    case 'cta':
      return <CtaEditor block={block} onChange={onChange} />;
    case 'embed':
      return <EmbedEditor block={block} onChange={onChange} />;
  }
}

/** Short summary string for the collapsed-block header row. */
export function summarize(block: PageBlock): string {
  switch (block.type) {
    case 'hero':
      return block.title || block.subtitle || '(빈 히어로)';
    case 'text':
      return block.html.replace(/<[^>]+>/g, '').slice(0, 60) || '(빈 텍스트)';
    case 'image':
      return block.image_url ? `🖼 ${block.image_url.split('/').pop()}` : '(이미지 없음)';
    case 'cta':
      return block.label ? `→ ${block.label}` : '(빈 버튼)';
    case 'embed':
      return block.url || '(빈 임베드)';
  }
}

function HeroEditor({
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

function TextEditor({
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

function ImageEditor({
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

function CtaEditor({
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

function EmbedEditor({
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

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
