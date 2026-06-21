'use client';

import { Plus, Star, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { StatCard, StatStrip, PageHeader } from '@/components/admin/CafeWidgets';
import ReviewCardEditor from './_components/ReviewCardEditor';
import { useReviews } from './_components/useReviews';

export default function ReviewsAdminPage() {
  const {
    rows,
    loading,
    saving,
    savedId,
    uploadingIdx,
    naverIdx,
    focusedIdx,
    fileRefs,
    cardRefs,
    setFocusedIdx,
    update,
    addRow,
    autoFillFromNaver,
    save,
    remove,
    move,
    handleFile,
  } = useReviews();

  if (loading) return <div className="text-[#6b7280]">로딩 중...</div>;

  const stats = {
    total: rows.length,
    active: rows.filter(r => r.is_active).length,
    inactive: rows.filter(r => !r.is_active).length,
    missingImage: rows.filter(r => r.is_active && !r.image_url).length,
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 리뷰" value={stats.total} icon={Star} subLabel="등록된 카드" />
        <StatCard accent="#22c55e" label="게시중" value={stats.active} icon={Eye} subLabel={`전체 ${stats.total}개 중`} />
        <StatCard accent="#9ca3af" label="숨김" value={stats.inactive} icon={EyeOff} subLabel="비공개 카드" />
        <StatCard accent="#f59e0b" label="이미지 없음" value={stats.missingImage} icon={ImageIcon} subLabel="썸네일 누락" />
      </StatStrip>

      <PageHeader
        title="리뷰 카드 관리"
        description="홈 메인 · /menus/review에 표시되는 리뷰 카드를 관리합니다"
        actions={
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 새 리뷰 카드
          </button>
        }
      />

      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-4 text-sm text-[#1e3a8a]">
        <p className="font-semibold mb-1">💡 리뷰 쇼케이스</p>
        <p>리뷰 카드는 <strong>/menus/review + 홈 메인</strong>에 노출됩니다. 카드가 <strong>1개면</strong> 본문이 바로 인라인으로 표시되고, <strong>여러 개면</strong> 썸네일 그리드로 표시됩니다. 네이버 블로그 URL을 입력하고 &ldquo;네이버 자동 채우기&rdquo;를 누르면 제목 · 썸네일 · 본문이 자동으로 가져와집니다.</p>
      </div>

      {/* Thumbnail strip — visual index of every saved card so the
          operator can click to jump to a row without scrolling. Active
          card gets a brand-ink border + ring. */}
      {rows.length > 0 && (
        <div className="bg-white rounded border border-[#e5e7eb] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#374151] uppercase tracking-wider">전체 리뷰 카드 ({rows.length})</p>
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6] text-white rounded text-xs font-semibold hover:bg-[#2563eb] transition"
            >
              <Plus className="w-3.5 h-3.5" /> 새 리뷰 카드
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {rows.map((r, i) => {
              const active = focusedIdx === i;
              return (
                <button
                  key={r.id ?? `thumb-${i}`}
                  type="button"
                  onClick={() => {
                    setFocusedIdx(i);
                    // Smooth-scroll the matching card into view so the admin
                    // can edit it without manual scrolling on long lists.
                    cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`group relative aspect-square overflow-hidden rounded border-2 transition-all kokkok-keep-border ${
                    active ? 'border-[#1f2937] ring-2 ring-[#1f2937]/20' : 'border-[#e5e7eb] hover:border-[#9ca3af]'
                  } ${!r.is_active ? 'opacity-50' : ''}`}
                  title={r.title || '(제목 없음)'}
                >
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#f3f4f6] flex items-center justify-center text-[9px] font-bold text-[#9ca3af]">
                      NO IMG
                    </div>
                  )}
                  {/* Sort-order badge — visible on hover only so the thumbnails read clean by default. */}
                  <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {r.sort_order}
                  </span>
                  {!r.is_active && (
                    <span className="absolute bottom-1 right-1 bg-[#ef4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      비공개
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <button
          onClick={addRow}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition"
        >
          <Plus className="w-4 h-4" /> 리뷰 카드 추가
        </button>
      )}

      {rows.map((r, i) => (
        <ReviewCardEditor
          key={r.id ?? `new-${i}`}
          row={r}
          index={i}
          isFirst={i === 0}
          isLast={i === rows.length - 1}
          isFocused={focusedIdx === i}
          isSaving={saving === (r.id ?? `new-${i}`)}
          showSavedFlash={savedId !== null && savedId === r.id}
          isUploading={uploadingIdx === i}
          isNaverFetching={naverIdx === i}
          cardRef={el => { cardRefs.current[i] = el; }}
          fileRef={el => { fileRefs.current[i] = el; }}
          onUpdate={patch => update(i, patch)}
          onFile={file => handleFile(i, file)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          onRemove={() => remove(i)}
          onAutoFillNaver={() => autoFillFromNaver(i)}
          onSave={() => save(i)}
        />
      ))}
    </div>
  );
}
