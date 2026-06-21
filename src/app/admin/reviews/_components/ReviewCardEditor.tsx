'use client';

import { Save, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import RichEditor from '@/components/admin/RichEditor';
import ReviewThumbnailRow from './ReviewThumbnailRow';
import ReviewNaverLinkRow from './ReviewNaverLinkRow';

/**
 * Per-card editor for /admin/reviews. Each saved row gets its own
 * <ReviewCardEditor /> — composed of:
 *   - header (title preview + move up/down/delete actions)
 *   - <ReviewThumbnailRow /> (image + file picker)
 *   - title input
 *   - <ReviewNaverLinkRow /> (link URL + auto-fill button)
 *   - RichEditor body
 *   - sort_order + active toggle + save button
 *
 * Parent (useReviews hook) owns the row state + every callback; this
 * child is pure UI.
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

      <ReviewThumbnailRow
        imageUrl={row.image_url}
        isUploading={isUploading}
        fileRef={fileRef}
        onFile={onFile}
      />

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

      <ReviewNaverLinkRow
        linkUrl={row.link_url}
        isNaverFetching={isNaverFetching}
        onChange={v => onUpdate({ link_url: v })}
        onAutoFillNaver={onAutoFillNaver}
      />

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
