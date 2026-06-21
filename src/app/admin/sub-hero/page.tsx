'use client';

import { LoadingState } from '@/components/admin/CafeWidgets';
import SubHeroPreview from './_components/SubHeroPreview';
import SubHeroImageUpload from './_components/SubHeroImageUpload';
import SubHeroFontSizeOffsets from './_components/SubHeroFontSizeOffsets';
import SubHeroTypographyAndPosition from './_components/SubHeroTypographyAndPosition';
import SubHeroBasicFields from './_components/SubHeroBasicFields';
import { useSubHero } from './_components/useSubHero';

export default function SubHeroAdminPage() {
  const s = useSubHero();

  if (s.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">서브 히어로 배너 관리</h2>
        <p className="text-sm text-[#6b7280]">홈페이지 영상 리뷰 아래에 표시되는 전체 너비 배너입니다.</p>
      </div>

      <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-5">
        <SubHeroPreview
          banner={s.banner}
          previewView={s.previewView}
          onChangeView={s.setPreviewView}
        />

        <SubHeroImageUpload
          imageUrl={s.banner.image_url}
          isUploading={s.isUploading}
          onPickFile={s.handleFileUpload}
          onUrlChange={url => s.setBanner(prev => ({ ...prev, image_url: url }))}
        />

        <SubHeroFontSizeOffsets
          banner={s.banner}
          onChange={(key, value) => s.setBanner(prev => ({ ...prev, [key]: value }))}
        />

        <SubHeroTypographyAndPosition
          banner={s.banner}
          onChange={patch => s.setBanner(prev => ({ ...prev, ...patch }))}
        />

        <SubHeroBasicFields
          banner={s.banner}
          isSaving={s.isSaving}
          onChange={patch => s.setBanner(prev => ({ ...prev, ...patch }))}
          onSave={s.handleSave}
        />
      </div>
    </div>
  );
}
