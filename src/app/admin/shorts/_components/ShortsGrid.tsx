'use client';

import Image from 'next/image';
import { Trash2, Link as LinkIcon } from 'lucide-react';

/**
 * Thumbnail grid of currently-published BRAND SHORTS. Each tile shows
 * the YouTube hqdefault thumbnail with a delete button overlay + a
 * per-tile product-link <select>. Extracted from /admin/shorts/page.tsx
 * at 2026-06-21.
 */

interface Short {
  id: string;
  youtubeId: string;
  productId: string | null;
  productName?: string | null;
  addedAt: string;
}

interface Product {
  id: string;
  name: string;
}

interface Props {
  shorts: Short[];
  products: Product[];
  linkingId: string | null;
  onDelete: (id: string) => void;
  onLinkProduct: (id: string, productId: string | null) => void;
}

export default function ShortsGrid({
  shorts,
  products,
  linkingId,
  onDelete,
  onLinkProduct,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
      <div className="p-4 border-b border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc]">
        <h2 className="text-[14px] font-bold text-[#1f2937]">현재 스토어에 게시 중</h2>
        <span className="text-sm font-medium text-[#6b7280]">{shorts.length}개 항목</span>
      </div>

      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {shorts.map(short => (
          <div
            key={short.id}
            className="relative group rounded-xl overflow-hidden border border-[#e5e7eb] bg-[#fafbfc]"
          >
            <div className="relative aspect-[9/16] w-full">
              <Image
                src={`https://i.ytimg.com/vi/${short.youtubeId}/hqdefault.jpg`}
                alt="썸네일"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-start">
              <span className="text-[10px] text-white font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                {short.youtubeId}
              </span>
              <button
                onClick={() => onDelete(short.id)}
                className="w-8 h-8 rounded-full bg-[#ef4444] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#dc2626] shadow-md"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Product link selector */}
            <div className="p-2 border-t border-[#f3f4f6]">
              <label className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-wide flex items-center gap-1 mb-1">
                <LinkIcon className="w-2.5 h-2.5" /> 연결 제품
              </label>
              <select
                value={short.productId || ''}
                onChange={e => onLinkProduct(short.id, e.target.value || null)}
                disabled={linkingId === short.id}
                className="w-full text-[11px] rounded px-1.5 py-1 bg-white disabled:opacity-50"
              >
                <option value="">연결 없음</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {short.productName && (
                <p className="text-[10px] text-[#16a34a] font-semibold mt-1 truncate">
                  ✓ {short.productName}
                </p>
              )}
            </div>

            <div className="px-3 pb-2 text-xs text-[#6b7280] font-medium">
              추가일: {short.addedAt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
