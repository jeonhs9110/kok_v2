'use client';

import { Star, Trash2 } from 'lucide-react';
import type { Background } from './BackgroundMediaCard';

interface Props {
  bg: Background;
  busy: boolean;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onToggleScrollDriven: (bg: Background) => void;
  onDelete: (bg: Background) => void;
}

/**
 * One tile in the site-backgrounds library grid. Shows the media (image
 * or video), a "활성" star badge when the bg is currently driving the
 * storefront, the file name + uploaded-at timestamp, the optional
 * scroll-driven checkbox (video only), and activate / deactivate / delete
 * actions. Busy state disables all buttons during the in-flight DB call.
 */
export default function BackgroundMediaTile({
  bg, busy,
  onActivate, onDeactivate, onToggleScrollDriven, onDelete,
}: Props) {
  return (
    <div
      className={`border overflow-hidden transition-shadow rounded ${
        bg.is_active
          ? 'border-[#16a34a] ring-2 ring-[#bbf7d0] shadow-sm'
          : 'border-[#e5e7eb] hover:border-[#d1d5db]'
      }`}
    >
      <div className="aspect-video bg-[#f3f4f6] relative overflow-hidden">
        {bg.file_type === 'video' ? (
          <video
            src={bg.file_url}
            className="w-full h-full object-cover"
            muted
            loop
            autoPlay
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bg.file_url}
            alt={bg.file_name}
            className="w-full h-full object-cover"
          />
        )}
        {bg.is_active && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-[#16a34a] text-white text-[10px] font-bold px-2 py-0.5 rounded">
            <Star className="w-3 h-3 fill-white" /> 활성
          </span>
        )}
        <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 uppercase rounded">
          {bg.file_type}
        </span>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-xs text-[#374151] truncate font-medium" title={bg.file_name}>
          {bg.file_name || '(이름 없음)'}
        </p>
        <p className="text-[10px] text-[#9ca3af]">
          {new Date(bg.created_at).toLocaleString('ko-KR')}
        </p>

        {bg.file_type === 'video' && (
          <label className="flex items-start gap-1.5 cursor-pointer pt-1 hover:bg-[#fafbfc] -mx-1 px-1 py-1 rounded">
            <input
              type="checkbox"
              checked={bg.scroll_driven}
              disabled={busy}
              onChange={() => onToggleScrollDriven(bg)}
              className="mt-0.5 w-3.5 h-3.5 accent-[#00693A] cursor-pointer flex-shrink-0"
            />
            <span className="text-[10px] text-[#6b7280] leading-tight">
              <span className="font-semibold text-[#374151]">스크롤 동기 재생</span>
              <span className="block text-[#9ca3af]">
                스크롤에 맞춰 영상 진행 (Apple 스타일)
              </span>
            </span>
          </label>
        )}

        <div className="flex gap-1.5 pt-1">
          {bg.is_active ? (
            <button
              disabled={busy}
              onClick={() => onDeactivate(bg.id)}
              className="flex-1 text-xs font-semibold px-2 py-1.5 border border-[#e5e7eb] text-[#6b7280] hover:bg-[#fafbfc] transition-colors disabled:opacity-40 rounded kokkok-keep-border"
            >
              비활성화
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => onActivate(bg.id)}
              className="flex-1 text-xs font-semibold px-2 py-1.5 bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors disabled:opacity-40 rounded"
            >
              활성화
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => onDelete(bg)}
            className="px-2 py-1.5 border border-[#fecaca] text-[#ef4444] hover:bg-[#fef2f2] transition-colors disabled:opacity-40 rounded kokkok-keep-border"
            aria-label="삭제"
            title="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
