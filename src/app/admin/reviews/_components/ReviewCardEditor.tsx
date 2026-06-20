'use client';

import { Save, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import RichEditor from '@/components/admin/RichEditor';

/**
 * Per-card editor for /admin/reviews. Each saved row gets its own
 * <ReviewCardEditor /> instance — thumbnail upload, title, external
 * URL with the Naver auto-fill button, RichEditor body, sort_order +
 * active toggle, and the row-level save button.
 *
 * Extracted from /admin/reviews/page.tsx at 2026-06-21. Parent owns
 * the row state + every callback; this child is pure UI.
 */

export interface ReviewRow {
  id: string | null;
  image_url: string;
  title: string;
  content_html: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
}

interface Props {
  row: ReviewRow;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isFocused: boolean;
  isSaving: boolean;
  showSavedFlash: boolean;
  isUploading: boolean;
  isNaverFetching: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  fileRef: (el: HTMLInputElement | null) => void;
  onUpdate: (patch: Partial<ReviewRow>) => void;
  onFile: (file: File) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAutoFillNaver: () => void;
  onSave: () => void;
}

export default function ReviewCardEditor({
  row,
  index,
  isFirst,
  isLast,
  isFocused,
  isSaving,
  showSavedFlash,
  isUploading,
  isNaverFetching,
  cardRef,
  fileRef,
  onUpdate,
  onFile,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAutoFillNaver,
  onSave,
}: Props) {
  return (
    <div
      ref={cardRef}
      className={`bg-white rounded border p-5 space-y-4 transition-shadow ${
        isFocused ? 'border-[#3b82f6] shadow-md' : 'border-[#e5e7eb]'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#1f2937]">{row.title || '(제목 없음)'}</p>
        <div className="flex gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 rounded hover:bg-[#f3f4f6] disabled:opacity-30"
            title="위로"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 rounded hover:bg-[#f3f4f6] disabled:opacity-30"
            title="아래로"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded hover:bg-[#fef2f2] text-[#ef4444]"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
          썸네일 이미지
        </label>
        <div className="flex gap-3 mt-1 items-start">
          {row.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.image_url}
              alt=""
              className="w-24 h-24 object-cover rounded border border-[#e5e7eb]"
            />
          ) : (
            <div className="w-24 h-24 bg-[#f3f4f6] rounded border border-[#e5e7eb] flex items-center justify-center text-[10px] text-[#9ca3af]">
              NO IMG
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#f3f4f6] file:text-[#374151] hover:file:bg-[#e5e7eb]"
            />
            {isUploading && (
              <p className="text-[11px] text-[#3b82f6] flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> 업로드 중...
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
          제목
        </label>
        <input
          type="text"
          value={row.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="리뷰 제목 (옵션, 썸네일 위에 표시)"
          className="w-full mt-1 rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
          외부 링크 (선택)
        </label>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={row.link_url}
            onChange={e => onUpdate({ link_url: e.target.value })}
            placeholder="https://... (지정하면 클릭 시 새 창에서 링크로 이동. 비워두면 아래 내용이 팝업으로 표시됩니다)"
            className="flex-1 rounded px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={onAutoFillNaver}
            disabled={isNaverFetching || !row.link_url}
            title="네이버 블로그/포스트 URL이면 제목·이미지·설명을 자동으로 채워요"
            className="px-3 py-2 text-xs font-bold text-white bg-[#03c75a] hover:bg-[#02b14d] disabled:opacity-40 rounded whitespace-nowrap flex items-center gap-1.5"
          >
            {isNaverFetching ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                가져오는 중...
              </>
            ) : (
              '네이버 자동 채우기'
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#9ca3af] mt-1">
          네이버 블로그 / 포스트 / 네이버 단축 URL(naver.me)을 인식합니다. 이미 채워진 칸은
          덮어쓰지 않아요.
        </p>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
          리뷰 내용 (HTML, 팝업에 표시)
        </label>
        <div className="mt-1">
          <RichEditor
            content={row.content_html}
            onChange={html => onUpdate({ content_html: html })}
            uploadPath="reviews-body"
            minHeight={200}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
            정렬
          </label>
          <input
            type="number"
            value={row.sort_order}
            onChange={e => onUpdate({ sort_order: Number(e.target.value) || 0 })}
            className="w-24 mt-1 rounded px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm mt-5 cursor-pointer text-[#1f2937]">
          <input
            type="checkbox"
            checked={row.is_active}
            onChange={e => onUpdate({ is_active: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          공개
        </label>
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-[#f3f4f6]">
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`px-5 py-2 rounded font-semibold text-sm flex items-center gap-2 transition ${
            showSavedFlash
              ? 'bg-[#16a34a] text-white'
              : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
          } disabled:opacity-50`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? '저장 중...' : showSavedFlash ? '✓ 저장 완료' : row.id ? '저장' : '추가'}
        </button>
        <span className="text-xs text-[#9ca3af]">{index + 1} / 카드</span>
      </div>
    </div>
  );
}
