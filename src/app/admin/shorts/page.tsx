'use client';

import { Video, Plus, Link2, Package } from 'lucide-react';
import { StatCard, StatStrip, PageHeader } from '@/components/admin/CafeWidgets';
import SectionBgCard from '@/components/admin/SectionBgCard';
import ShortsHeaderStyleCard from './_components/ShortsHeaderStyleCard';
import ShortsGrid from './_components/ShortsGrid';
import { useShorts } from './_components/useShorts';

export default function ShortsAdminPage() {
  const s = useShorts();

  if (s.isLoading) return (
    <div className="p-10 animate-pulse bg-[#f3f4f6] rounded-xl h-64 flex items-center justify-center text-[#9ca3af] font-bold tracking-widest">
      숏츠 불러오는 중...
    </div>
  );

  const linkedCount = s.shorts.filter(x => x.productId).length;
  const unlinkedCount = s.shorts.filter(x => !x.productId).length;

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 쇼츠" value={s.shorts.length} icon={Video} subLabel="등록된 영상" />
        <StatCard accent="#22c55e" label="상품 연결됨" value={linkedCount} icon={Link2} subLabel={`전체 ${s.shorts.length}개 중`} />
        <StatCard accent="#f59e0b" label="상품 미연결" value={unlinkedCount} icon={Package} subLabel="구매 유도 비활성" />
        <StatCard accent="#8b5cf6" label="활성 상품" value={s.products.length} icon={Package} subLabel="연결 가능한 상품" />
      </StatStrip>

      <PageHeader
        title="BRAND SHORTS 관리"
        description="홈 메인 가로 캐러셀로 노출되는 9:16 세로 영상을 관리합니다"
      />

      <ShortsHeaderStyleCard
        text={s.headerText}
        fontSize={s.headerFontSize}
        textColor={s.headerTextColor}
        bgEnabled={s.headerBgEnabled}
        bgColor={s.headerBgColor}
        isSaving={s.savingHeader}
        showSavedFlash={s.headerSaved}
        onTextChange={s.setHeaderText}
        onFontSizeChange={s.setHeaderFontSize}
        onTextColorChange={s.setHeaderTextColor}
        onBgEnabledChange={s.setHeaderBgEnabled}
        onBgColorChange={s.setHeaderBgColor}
        onSave={s.saveHeader}
      />

      <SectionBgCard
        value={s.bg}
        onChange={s.setBg}
        defaultColor="#171717"
        uploadPathPrefix="shorts-bg"
        isSaving={s.savingBg}
        showSavedFlash={s.bgSaved}
        onSave={s.saveBg}
        hint="기본값은 검정(neutral-900) 배경입니다."
      />

      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <h2 className="text-[14px] font-bold text-[#1f2937] mb-4 flex items-center gap-2">
          <Video className="w-5 h-5 text-[#a855f7]" /> 새 브랜드 숏츠 추가
        </h2>
        <form onSubmit={s.handleAdd} className="flex gap-4">
          <input
            type="text"
            value={s.newUrl}
            onChange={(e) => s.setNewUrl(e.target.value)}
            placeholder="YouTube Shorts URL 또는 영상 ID 붙여넣기 (예: ho0EhuO3RNs)"
            className="flex-1 px-4 py-3 rounded-lg text-sm"
          />
          <button type="submit" className="bg-[#3b82f6] text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition-colors whitespace-nowrap flex items-center gap-2">
            <Plus className="w-4 h-4" /> 피드에 추가
          </button>
        </form>
        <p className="text-xs text-[#9ca3af] mt-3">홈페이지에 최대 10개까지 자동으로 표시됩니다.</p>
      </div>

      <ShortsGrid
        shorts={s.shorts}
        products={s.products}
        linkingId={s.linkingId}
        onDelete={s.handleDelete}
        onLinkProduct={s.handleLinkProduct}
      />
    </div>
  );
}
