'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';
import BackgroundMediaTile from './BackgroundMediaTile';

/**
 * Background media library + uploader for /admin/logo. Drag a file in
 * via the picker, then activate exactly one of the library tiles to
 * use it as the storefront background. Videos can additionally be
 * marked scroll-driven so the storefront renders an Apple-style
 * scroll-synced playback.
 *
 * Per-tile rendering lives in <BackgroundMediaTile />; this file owns
 * the uploader chrome + the empty / grid branch.
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
            {backgrounds.map(bg => (
              <BackgroundMediaTile
                key={bg.id}
                bg={bg}
                busy={bgBusyId === bg.id}
                onActivate={onActivate}
                onDeactivate={onDeactivate}
                onToggleScrollDriven={onToggleScrollDriven}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
