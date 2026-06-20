'use client';

import { useRef } from 'react';
import { Upload, Trash2, Star } from 'lucide-react';

/**
 * Background media library + uploader for /admin/logo. Drag a file in
 * via the picker, then activate exactly one of the library tiles to
 * use it as the storefront background. Videos can additionally be
 * marked scroll-driven so the storefront renders an Apple-style
 * scroll-synced playback.
 *
 * Extracted from /admin/logo/page.tsx at 2026-06-21.
 */

export interface Background {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'image' | 'video';
  mime_type: string;
  is_active: boolean;
  scroll_driven: boolean;
  created_at: string;
}

interface Props {
  backgrounds: Background[];
  bgPending: File | null;
  bgUploading: boolean;
  /** Per-row busy lock (toggle/delete in flight). Disables the row's
   *  controls so a double-click can't double-fire. */
  bgBusyId: string | null;
  accept: string;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onToggleScrollDriven: (bg: Background) => void;
  onDelete: (bg: Background) => void;
}

export default function BackgroundMediaCard({
  backgrounds,
  bgPending,
  bgUploading,
  bgBusyId,
  accept,
  onPickFile,
  onUpload,
  onActivate,
  onDeactivate,
  onToggleScrollDriven,
  onDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">배경 미디어</h2>
      <p className="text-sm text-[#6b7280] mb-6">
        사이트 배경으로 사용할 이미지 또는 영상을 관리합니다. 여러 개 업로드 후 하나를{' '}
        <strong className="text-[#16a34a]">활성</strong>으로 지정하면 오른쪽 미리보기에서 바로
        확인할 수 있습니다.
      </p>

      {/* Upload form */}
      <div className="space-y-3 pb-6 border-b border-[#f3f4f6]">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onPickFile}
          className="block w-full text-sm text-[#374151] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[#f3f4f6] file:text-[#374151] hover:file:bg-[#e5e7eb]"
        />
        {bgPending && (
          <p className="text-xs text-[#6b7280]">
            선택됨: <span className="font-mono">{bgPending.name}</span> ·{' '}
            {(bgPending.size / 1024 / 1024).toFixed(2)}MB ·{' '}
            {bgPending.type || '(타입 미상)'}
          </p>
        )}
        <p className="text-[11px] text-[#9ca3af]">PNG / JPG / WEBP / GIF / MP4 / WEBM · 최대 50MB</p>

        <button
          disabled={!bgPending || bgUploading}
          onClick={onUpload}
          className="inline-flex items-center gap-2 bg-[#3b82f6] text-white px-6 py-2.5 text-sm font-bold tracking-wider hover:bg-[#2563eb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded"
        >
          <Upload className="w-4 h-4" />
          {bgUploading ? '업로드 중...' : '배경 업로드'}
        </button>
      </div>

      {/* Library */}
      <div className="pt-6">
        {backgrounds.length === 0 ? (
          <p className="text-sm text-[#9ca3af] text-center py-12">
            아직 등록된 배경이 없습니다. 위에서 업로드해주세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {backgrounds.map(bg => {
              const busy = bgBusyId === bg.id;
              return (
                <div
                  key={bg.id}
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
                          className="flex-1 text-xs font-semibold px-2 py-1.5 border border-[#e5e7eb] text-[#6b7280] hover:bg-[#fafbfc] transition-colors disabled:opacity-40 rounded"
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
                        className="px-2 py-1.5 border border-[#fecaca] text-[#ef4444] hover:bg-[#fef2f2] transition-colors disabled:opacity-40 rounded"
                        aria-label="삭제"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
