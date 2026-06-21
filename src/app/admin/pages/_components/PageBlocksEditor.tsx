'use client';

import { useState } from 'react';
import {
  Trash2,
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
import AddBlockTray from './AddBlockTray';

interface BlockWithId {
  id: string;
  block: PageBlock;
}

// Blocks don't carry an id — generate stable client-side ids for dnd-kit
// derived from the array index + content fingerprint so they survive
// re-mounts but change when blocks are added/removed.
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
 * editors per block, drag-and-drop reorder via SortableList, and an
 * <AddBlockTray /> that lights up the 5 block types as chips.
 */
export default function PageBlocksEditor({ blocks, onChange }: Props) {
  const confirm = useConfirm();
  const [openId, setOpenId] = useState<string | null>(
    blocks.length === 0 ? null : makeBlockId(blocks[0], 0),
  );

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
  };

  return (
    <div className="space-y-3">
      {blocks.length === 0 ? (
        <div className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-10 text-center text-[#9ca3af] kokkok-keep-border">
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
                  isOpen ? 'border-[#1f2937] shadow-sm' : 'border-[#e5e7eb]'
                }`}
              >
                <div className="flex items-center bg-[#fafbfc] border-b border-[#f3f4f6]">
                  <button
                    type="button"
                    {...dragHandleProps}
                    className={`${dragHandleProps.className ?? ''} pl-2 pr-1 py-3 text-[#d1d5db] hover:text-[#6b7280]`}
                    aria-label="드래그하여 순서 변경"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex-1 flex items-center gap-2 px-2 py-3 text-left text-sm hover:bg-[#fafbfc]"
                  >
                    <Icon className="w-4 h-4 text-[#6b7280]" />
                    <span className="font-bold text-[#374151]">{BLOCK_LABELS[block.type]}</span>
                    <span className="text-xs text-[#9ca3af] truncate">{summarize(block)}</span>
                  </button>
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="p-1.5 text-[#9ca3af] hover:text-[#ef4444]"
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

      <AddBlockTray onAdd={add} />
    </div>
  );
}
