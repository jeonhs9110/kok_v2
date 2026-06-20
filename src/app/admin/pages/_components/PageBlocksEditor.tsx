'use client';

import { useState } from 'react';
import {
  Plus, Trash2, ChevronRight, ChevronLeft,
  LayoutTemplate, Type, ImageIcon, Megaphone, Video, GripVertical,
} from 'lucide-react';
import {
  BLOCK_LABELS,
  makeBlock,
  normalizeEmbedUrl,
  type BlockType,
  type PageBlock,
} from '@/lib/pages/blocks';
import SortableList from '@/components/admin/SortableList';
import { useConfirm } from '@/components/admin/ConfirmModal';

interface BlockWithId {
  id: string;
  block: PageBlock;
}

// Blocks themselves don't carry an id — we generate stable client-side ids
// for dnd-kit, derived from the array index + content fingerprint so they
// survive re-mounts but change when blocks are added/removed.
function makeBlockId(block: PageBlock, index: number): string {
  return `${index}-${block.type}`;
}

interface Props {
  blocks: PageBlock[];
  onChange: (next: PageBlock[]) => void;
}

const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  hero: LayoutTemplate,
  text: Type,
  image: ImageIcon,
  cta: Megaphone,
  embed: Video,
};

/**
 * Section-based page builder. List of blocks with collapse/expand inline
 * editors per block, up/down reorder, and an "add block" tray.
 *
 * Drag-and-drop reorder is intentionally skipped here — adding a real DnD
 * library (@dnd-kit) would balloon the bundle for ~10 admins. Up/down
 * arrows are good enough for short block lists and don't require any
 * pointer-event plumbing.
 */
export default function PageBlocksEditor({ blocks, onChange }: Props) {
  const confirm = useConfirm();
  const [openId, setOpenId] = useState<string | null>(
    blocks.length === 0 ? null : makeBlockId(blocks[0], 0),
  );
  const [adderOpen, setAdderOpen] = useState(false);

  // dnd-kit needs stable ids per item. Derive from array index + type so
  // adds / removes invalidate them as expected, and reorder preserves them.
  const withIds: BlockWithId[] = blocks.map((block, i) => ({ id: makeBlockId(block, i), block }));

  const updateAt = (i: number, next: PageBlock) => {
    onChange(blocks.map((b, idx) => (idx === i ? next : b)));
  };

  const removeAt = async (i: number) => {
    const ok = await confirm({ message: '이 블록을 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    onChange(blocks.filter((_, idx) => idx !== i));
    setOpenId(null);
  };

  const add = (type: BlockType) => {
    const newIndex = blocks.length;
    const newBlock = makeBlock(type);
    onChange([...blocks, newBlock]);
    setOpenId(makeBlockId(newBlock, newIndex));
    setAdderOpen(false);
  };

  return (
    <div className="space-y-3">
      {blocks.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center text-gray-400">
          <p className="text-sm font-semibold">아직 추가된 블록이 없습니다</p>
          <p className="text-xs mt-1">아래 버튼을 눌러 첫 번째 블록을 추가해보세요</p>
        </div>
      ) : (
        <SortableList
          items={withIds}
          getId={(b) => b.id}
          onReorder={(next) => onChange(next.map((x) => x.block))}
          className="space-y-3"
        >
          {(item, { dragHandleProps }) => {
            // Re-derive the index from the on-screen list so updates / removes
            // hit the original blocks array regardless of dnd-kit ordering.
            const i = withIds.findIndex((x) => x.id === item.id);
            const block = item.block;
            const Icon = BLOCK_ICONS[block.type];
            const isOpen = openId === item.id;
            return (
              <div
                className={`border rounded-lg overflow-hidden transition-shadow ${
                  isOpen ? 'border-black shadow-sm' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center bg-gray-50/50 border-b border-gray-100">
                  <button
                    type="button"
                    {...dragHandleProps}
                    className={`${dragHandleProps.className ?? ''} pl-2 pr-1 py-3 text-gray-300 hover:text-gray-500`}
                    aria-label="드래그하여 순서 변경"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex-1 flex items-center gap-2 px-2 py-3 text-left text-sm hover:bg-gray-50"
                  >
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="font-bold text-gray-700">{BLOCK_LABELS[block.type]}</span>
                    <span className="text-xs text-gray-400 truncate">{summarize(block)}</span>
                  </button>
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="p-4 bg-white">
                    <BlockEditor block={block} onChange={(next) => updateAt(i, next)} />
                  </div>
                )}
              </div>
            );
          }}
        </SortableList>
      )}

      {/* Add block tray */}
      <div>
        {adderOpen ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
              const Icon = BLOCK_ICONS[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => add(t)}
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-md border border-gray-200 hover:border-black hover:shadow-sm transition"
                >
                  <Icon className="w-5 h-5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-700">{BLOCK_LABELS[t]}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAdderOpen(false)}
              className="col-span-2 sm:col-span-5 text-xs text-gray-400 hover:text-gray-600 py-1"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdderOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm font-semibold text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition"
          >
            <Plus className="w-4 h-4" /> 블록 추가
          </button>
        )}
      </div>
    </div>
  );
}

function summarize(block: PageBlock): string {
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

/* ────────────────────────────────────────────────────────────────
   Per-type editors. Kept inline in one file so the block-editor
   surface stays self-contained — splitting into 5 files would cost
   navigation overhead without much organizational benefit at this
   size.
   ──────────────────────────────────────────────────────────────── */

function BlockEditor({
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

const labelClass = 'text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider';
const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black bg-white';

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
          onChange={(e) => onChange({ ...block, title: e.target.value })}
          className={inputClass}
          placeholder="이번 주 신상품 출시"
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>서브 텍스트</label>
        <textarea
          rows={2}
          value={block.subtitle}
          onChange={(e) => onChange({ ...block, subtitle: e.target.value })}
          className={`${inputClass} resize-none`}
          placeholder="설명을 입력하세요"
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>이미지 URL</label>
        <input
          type="url"
          value={block.image_url}
          onChange={(e) => onChange({ ...block, image_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="https://..."
        />
        <p className="text-[10px] text-gray-400 mt-1">에셋 라이브러리에서 URL 복사 후 붙여넣기</p>
      </div>
      <div>
        <label className={labelClass}>버튼 라벨 (선택)</label>
        <input
          type="text"
          value={block.cta_text ?? ''}
          onChange={(e) => onChange({ ...block, cta_text: e.target.value })}
          className={inputClass}
          placeholder="자세히 보기"
        />
      </div>
      <div>
        <label className={labelClass}>버튼 링크 (선택)</label>
        <input
          type="text"
          value={block.cta_link ?? ''}
          onChange={(e) => onChange({ ...block, cta_link: e.target.value })}
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
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            텍스트 + 이미지
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...block, layout: 'fullbleed' })}
            className={`p-2 rounded border text-xs ${
              block.layout === 'fullbleed'
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-gray-600'
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
            onChange={(v) => onChange({ ...block, bg_color: v })}
          />
        </div>
        <div>
          <label className={labelClass}>텍스트색</label>
          <ColorRow
            value={block.text_color || '#111111'}
            onChange={(v) => onChange({ ...block, text_color: v })}
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
        onChange={(e) => onChange({ ...block, html: e.target.value })}
        className={`${inputClass} font-mono text-xs resize-vertical`}
        placeholder="<p>안녕하세요</p>"
      />
      <p className="text-[10px] text-gray-400 mt-1">
        HTML 태그 사용 가능 (`&lt;p&gt;`, `&lt;strong&gt;`, `&lt;a href&gt;`, `&lt;br&gt;` 등).
        스크립트와 이벤트 핸들러는 자동 제거됩니다.
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
          onChange={(e) => onChange({ ...block, image_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="https://..."
        />
      </div>
      <div>
        <label className={labelClass}>대체 텍스트 (alt)</label>
        <input
          type="text"
          value={block.alt}
          onChange={(e) => onChange({ ...block, alt: e.target.value })}
          className={inputClass}
          placeholder="스크린리더에 읽힐 설명"
        />
      </div>
      <div>
        <label className={labelClass}>링크 URL (선택)</label>
        <input
          type="text"
          value={block.link_url ?? ''}
          onChange={(e) => onChange({ ...block, link_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="/kr/products/123"
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>캡션 (선택)</label>
        <input
          type="text"
          value={block.caption ?? ''}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
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
          onChange={(e) => onChange({ ...block, max_width: Number(e.target.value) || 1200 })}
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
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          className={inputClass}
          placeholder="구매하러 가기"
        />
      </div>
      <div>
        <label className={labelClass}>링크 URL</label>
        <input
          type="text"
          value={block.link_url}
          onChange={(e) => onChange({ ...block, link_url: e.target.value })}
          className={`${inputClass} font-mono text-xs`}
          placeholder="/kr/products"
        />
      </div>
      <div>
        <label className={labelClass}>정렬</label>
        <div className="grid grid-cols-3 gap-1">
          {(['left', 'center', 'right'] as const).map((a) => {
            const Icon = a === 'left' ? ChevronLeft : a === 'right' ? ChevronRight : null;
            return (
              <button
                key={a}
                type="button"
                onClick={() => onChange({ ...block, align: a })}
                className={`p-2 rounded border text-xs flex items-center justify-center ${
                  (block.align ?? 'center') === a
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-600'
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
          {(['primary', 'secondary'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...block, style: s })}
              className={`p-2 rounded border text-xs ${
                (block.style ?? 'primary') === s
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-600'
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
          {(['youtube', 'vimeo', 'iframe'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...block, embed_kind: k })}
              className={`p-2 rounded border text-xs ${
                block.embed_kind === k
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-600'
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
          {(['16/9', '4/3', '1/1'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ ...block, aspect: a })}
              className={`p-2 rounded border text-xs ${
                (block.aspect ?? '16/9') === a
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-600'
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
          onChange={(e) => onChange({ ...block, url: normalizeEmbedUrl(e.target.value, block.embed_kind) })}
          className={`${inputClass} font-mono text-xs`}
          placeholder={
            block.embed_kind === 'youtube'
              ? 'https://www.youtube.com/watch?v=...'
              : block.embed_kind === 'vimeo'
              ? 'https://vimeo.com/...'
              : 'https://...'
          }
        />
        <p className="text-[10px] text-gray-400 mt-1">
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
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} font-mono text-xs flex-1`}
      />
    </div>
  );
}
