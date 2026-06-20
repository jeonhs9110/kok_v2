'use client';

import Image from 'next/image';
import { Trash2, Copy, Check, ExternalLink, ImageIcon, FileText } from 'lucide-react';
import type { Asset } from './types';

/**
 * Right-side asset detail panel — large preview, metadata grid (path,
 * bucket, size, updated), and the action stack (copy URL, open new tab,
 * delete, close). Pure UI: parent owns the copy/delete latches and
 * fires the actual storage mutations.
 *
 * Extracted from /admin/assets/page.tsx at 2026-06-21.
 */

function formatBytes(n: number): string {
  if (n === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

interface Props {
  asset: Asset | null;
  copiedKey: string | null;
  deletingKey: string | null;
  onCopy: (a: Asset) => void;
  onDelete: (a: Asset) => void;
  onClose: () => void;
}

export default function AssetDetail({
  asset,
  copiedKey,
  deletingKey,
  onCopy,
  onDelete,
  onClose,
}: Props) {
  if (!asset) {
    return (
      <aside className="bg-white rounded border border-[#e5e7eb] p-5 lg:sticky lg:top-6 h-fit">
        <div className="py-10 text-center text-[#9ca3af]">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-xs">왼쪽에서 파일을 선택하면 상세 정보가 표시됩니다</p>
        </div>
      </aside>
    );
  }

  const isCopied = copiedKey === asset.key;
  const isDeleting = deletingKey === asset.key;

  return (
    <aside className="bg-white rounded border border-[#e5e7eb] p-5 lg:sticky lg:top-6 h-fit">
      <div className="space-y-4">
        <div className="aspect-square rounded overflow-hidden bg-[#fafbfc] border border-[#f3f4f6] relative">
          {asset.kind === 'image' ? (
            <Image
              src={asset.publicUrl}
              alt={asset.name}
              fill
              sizes="320px"
              className="object-contain"
              unoptimized
            />
          ) : asset.kind === 'video' ? (
            <video
              src={asset.publicUrl}
              controls
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#9ca3af]">
              <FileText className="w-12 h-12" />
              <span className="mt-2 text-xs font-mono uppercase">
                {asset.name.split('.').pop() || 'file'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">파일명</p>
            <p className="text-sm font-semibold text-[#1f2937] break-all">{asset.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">버킷</p>
              <p className="font-mono text-[#374151]">{asset.bucket}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">크기</p>
              <p className="text-[#374151]">{formatBytes(asset.size)}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">경로</p>
            <p className="font-mono text-[11px] text-[#6b7280] break-all">{asset.key}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">업데이트</p>
            <p className="text-xs text-[#6b7280]">
              {asset.updatedAt ? new Date(asset.updatedAt).toLocaleString('ko-KR') : '—'}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-[#f3f4f6]">
          <button
            onClick={() => onCopy(asset)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3b82f6] text-white text-xs font-bold tracking-wider rounded hover:bg-[#2563eb] transition"
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {isCopied ? '복사됨' : 'URL 복사'}
          </button>
          <a
            href={asset.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#e5e7eb] text-[#374151] text-xs font-bold tracking-wider rounded hover:bg-[#fafbfc] transition"
          >
            <ExternalLink className="w-4 h-4" />
            새 탭에서 열기
          </a>
          <button
            onClick={() => onDelete(asset)}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#fecaca] text-[#ef4444] text-xs font-bold tracking-wider rounded hover:bg-[#fef2f2] transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
          <button
            onClick={onClose}
            className="w-full text-[11px] text-[#9ca3af] hover:text-[#6b7280] pt-1"
          >
            닫기
          </button>
        </div>
      </div>
    </aside>
  );
}
