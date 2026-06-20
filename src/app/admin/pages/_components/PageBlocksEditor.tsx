'use client';

import { useState } from 'react';
import {
  Plus, Trash2,
  LayoutTemplate, Type, ImageIcon, Megaphone, Video, GripVertical,
} from 'lucide-react';
import {
  BLOCK_LABELS,
  makeBlock,
  type BlockType,
  type PageBlock,
} from '@/lib/pages/blocks';
import SortableList from '@/components/admin/SortableList';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { BlockEditor, summarize } from './BlockEditors';

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
