'use client';

import Image from 'next/image';
import { Film, FileText } from 'lucide-react';
import { EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import type { Asset } from './types';

/**
 * Tile grid of assets — 2 → 5 columns responsive, click-to-select.
 * Loading/empty states delegate to the shared CafeWidgets. Selected
 * tile gets a black ring; image/video/file each get distinct preview
 * chrome. Extracted from /admin/assets/page.tsx at 2026-06-21.
 */

interface Props {
  /** All loaded assets — used to drive the empty-state copy when
   *  the filter matches nothing vs the library being empty. */
  totalCount: number;
  filtered: Asset[];
  isLoading: boolean;
  selected: { bucket: string; key: string } | null;
  onSelect: (asset: Asset) => void;
}

export default function AssetGrid({
  totalCount,
  filtered,
  isLoading,
  selected,
  onSelect,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-4 min-h-[400px]">
      {isLoading && filtered.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          label={
            totalCount === 0
              ? '아직 업로드된 파일이 없습니다'
              : '검색 결과 없음 · 검색어 또는 버킷 필터를 변경해보세요'
          }
        />
      ) : (
        <>
          <p className="text-xs text-[#9ca3af] mb-3 ml-1">총 {filtered.length}개</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(a => {
              const isSelected = selected?.bucket === a.bucket && selected?.key === a.key;
              return (
                <button
                  key={`${a.bucket}/${a.key}`}
                  onClick={() => onSelect(a)}
                  className={`group relative aspect-square rounded overflow-hidden border-2 transition-all bg-[#fafbfc] ${
                    isSelected
                      ? 'border-[#1f2937] ring-2 ring-black/10'
                      : 'border-transparent hover:border-[#e5e7eb]'
                  }`}
                >
                  {a.kind === 'image' ? (
                    <Image
                      src={a.publicUrl}
                      alt={a.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : a.kind === 'video' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#9ca3af] bg-[#f3f4f6]">
                      <Film className="w-8 h-8" />
                      <span className="mt-1 text-[10px] font-mono uppercase">
                        {a.name.split('.').pop()}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#9ca3af] bg-[#f3f4f6]">
                      <FileText className="w-8 h-8" />
                      <span className="mt-1 text-[10px] font-mono uppercase">
                        {a.name.split('.').pop() || 'file'}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-2 py-1.5 text-left">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="opacity-70 truncate">{a.bucket}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
