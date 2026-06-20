'use client';

import { useRef } from 'react';
import { Upload, Trash2, Check } from 'lucide-react';

/**
 * Top card on /admin/logo — current logo preview tile, recommended-spec
 * blurb, file picker, upload + delete buttons. Pure UI: parent owns the
 * staged pending file + the persisted URL and hands down the callbacks.
 *
 * Extracted from /admin/logo/page.tsx at 2026-06-21.
 */

interface Props {
  /** Object URL or persisted https URL — whichever is current. */
  logoPreview: string;
  /** Persisted URL on the row. Empty = no logo saved yet. Drives whether
   *  the delete button shows. */
  logoUrl: string;
  /** True when a local File has been picked but not yet uploaded. */
  hasPending: boolean;
  isSaving: boolean;
  /** Brief green "✓ 저장되었습니다" affordance that fades a few seconds
   *  after a successful save. */
  showSavedFlash: boolean;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDelete: () => void;
}

export default function SiteLogoCard({
  logoPreview,
  logoUrl,
  hasPending,
  isSaving,
  showSavedFlash,
  onPickFile,
  onUpload,
  onDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">사이트 로고</h2>
      <p className="text-sm text-[#6b7280] mb-6">
        상단 좌측에 노출되는 로고 이미지입니다. 업로드하지 않으면 기본 텍스트
        &ldquo;KOKKOK GARDEN&rdquo;이 표시됩니다.
      </p>

      <div className="flex items-start gap-6 pb-6 border-b border-[#f3f4f6]">
        <div className="flex-shrink-0 w-48 h-24 bg-brand-ink rounded flex items-center justify-center overflow-hidden">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="logo preview"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <span className="text-white text-[18px] font-black tracking-[0.12em] uppercase">
              KOKKOK
              <br />
              GARDEN
            </span>
          )}
        </div>
        <div className="flex-1 text-sm text-[#374151] space-y-1.5">
          <p>
            <strong className="text-[#1f2937]">권장 규격</strong>
          </p>
          <p>• 가로형 이미지 (예: 600×160px, 투명 배경 PNG 또는 SVG 권장)</p>
          <p>• 최대 2MB · PNG / SVG / WEBP / JPG</p>
          <p>• 어두운 배경 위에 올라가므로 밝은 색상의 로고를 권장합니다.</p>
        </div>
      </div>

      <div className="pt-6 space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={onPickFile}
          className="block w-full text-sm text-[#374151] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[#f3f4f6] file:text-[#374151] hover:file:bg-[#e5e7eb]"
        />

        <div className="flex gap-3 flex-wrap">
          <button
            disabled={!hasPending || isSaving}
            onClick={onUpload}
            className="inline-flex items-center gap-2 bg-[#3b82f6] text-white px-6 py-2.5 text-sm font-bold tracking-wider hover:bg-[#2563eb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded"
          >
            <Upload className="w-4 h-4" />
            {isSaving ? '업로드 중...' : '로고 업로드 및 저장'}
          </button>

          {logoUrl && (
            <button
              disabled={isSaving}
              onClick={onDelete}
              className="inline-flex items-center gap-2 bg-white text-[#ef4444] border border-[#fecaca] px-6 py-2.5 text-sm font-bold tracking-wider hover:bg-[#fef2f2] transition-colors disabled:opacity-40 rounded"
            >
              <Trash2 className="w-4 h-4" />
              로고 삭제 (기본 텍스트로 복구)
            </button>
          )}

          {showSavedFlash && (
            <span className="inline-flex items-center gap-1.5 text-sm text-[#16a34a] font-semibold">
              <Check className="w-4 h-4" /> 저장되었습니다
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
