'use client';

import { useState } from 'react';
import { Plus, LayoutTemplate, Type, ImageIcon, Megaphone, Video } from 'lucide-react';
import { BLOCK_LABELS, type BlockType } from '@/lib/pages/blocks';

const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  hero: LayoutTemplate,
  text: Type,
  image: ImageIcon,
  cta: Megaphone,
  embed: Video,
};

interface Props {
  onAdd: (type: BlockType) => void;
}

/**
 * Add-block tray below the block list. Collapsed by default — clicking
 * "블록 추가" reveals a 5-column grid of block-type chips (each lights
 * up an icon + Korean label). Picking one fires onAdd(type) and closes
 * the tray.
 */
export default function AddBlockTray({ onAdd }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {open ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 border border-[#e5e7eb] rounded-lg bg-[#fafbfc]">
          {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
            const Icon = BLOCK_ICONS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => { onAdd(t); setOpen(false); }}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-md border border-[#e5e7eb] hover:border-[#1f2937] hover:shadow-sm transition kokkok-keep-border"
              >
                <Icon className="w-5 h-5 text-[#6b7280]" />
                <span className="text-xs font-semibold text-[#374151]">{BLOCK_LABELS[t]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="col-span-2 sm:col-span-5 text-xs text-[#9ca3af] hover:text-[#6b7280] py-1"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[#e5e7eb] rounded-lg text-sm font-semibold text-[#6b7280] hover:border-[#9ca3af] hover:bg-[#fafbfc] transition kokkok-keep-border"
        >
          <Plus className="w-4 h-4" /> 블록 추가
        </button>
      )}
    </div>
  );
}
