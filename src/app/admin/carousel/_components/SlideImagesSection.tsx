'use client';

import SlideImageUpload from './SlideImageUpload';
import type { SlideFormData } from '../_lib';

interface Props {
  formData: SlideFormData;
  previewUrl: string;
  mobilePreviewUrl: string;
  uploadProgress: 'idle' | 'uploading' | 'done' | 'error';
  onDesktopFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDesktopUrlChange: (url: string) => void;
  onDesktopClear: () => void;
  onMobileFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMobileUrlChange: (url: string) => void;
  onMobileClear: () => void;
}

/**
 * The two-image upload block: required PC (16:10+) image with the
 * resolution warning, plus the optional mobile (4:5 or 9:16) override.
 * Migration 35 — when mobile is empty, HeroSlider falls back to the PC
 * image at every breakpoint, matching pre-2026-06-10 behavior.
 */
export default function SlideImagesSection({
  formData,
  previewUrl,
  mobilePreviewUrl,
  uploadProgress,
  onDesktopFileSelect,
  onDesktopUrlChange,
  onDesktopClear,
  onMobileFileSelect,
  onMobileUrlChange,
  onMobileClear,
}: Props) {
  return (
    <>
      <SlideImageUpload
        label="슬라이드 이미지 — PC (가로형, 필수)"
        tip={
          /* 권장 해상도 안내. 메인 배너 (HeroSlider) 가 lg:h-[1000px]
             까지 늘어나기 때문에, 세로 픽셀이 모자란 소스 (예: 2400×800)
             는 데스크탑에서 25% 이상 업스케일되며 흐릿하게 보입니다. */
          <p className="text-[10px] text-[#92400e] bg-[#fef3c7] border border-[#fde68a] rounded px-2 py-1.5">
            <strong className="font-bold">권장 해상도</strong> · 2400 × 1200 px (2:1) 이상 · 가로폭은 1920 px 이상이면 OK · 세로폭이 1000 px 미만이면 큰 화면에서 흐릿하게 보일 수 있습니다.
          </p>
        }
        previewUrl={previewUrl}
        urlValue={formData.imageUrl}
        isVideo={formData.media_type === 'video'}
        hasFile={!!formData.imageFile}
        uploadProgress={uploadProgress}
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        emptyTitle="클릭하여 이미지 업로드"
        emptySubtitle="JPG, PNG, WEBP, GIF, MP4 — 최대 20MB"
        emptyHint={
          <p className="text-[11px] text-[#9ca3af] mt-2 leading-relaxed text-center">
            권장: <strong className="font-semibold">데스크탑 2400×1500px (16:10) 이상</strong>, 가급적 원본 화질로 업로드해주세요.<br />
            출시 시 자동으로 화면 크기에 맞춰 최적화되며 품질은 95%로 유지됩니다.
          </p>
        }
        emptyHeight="h-36"
        iconSize="w-8 h-8"
        urlPlaceholder="https://example.com/image.jpg"
        onFileSelect={onDesktopFileSelect}
        onUrlChange={onDesktopUrlChange}
        onClear={onDesktopClear}
      />

      {/* Migration 35 — optional mobile composition. When empty,
          HeroSlider falls back to the desktop image at every breakpoint. */}
      <SlideImageUpload
        label="슬라이드 이미지 — 모바일 (세로형, 선택)"
        tip={
          <p className="text-[10px] text-[#1e40af] bg-[#eff6ff] border border-[#bfdbfe] rounded px-2 py-1.5">
            모바일 전용 이미지를 업로드하면 작은 화면에서 자동으로 이 이미지가 표시됩니다. <strong>비워두면 PC 이미지를 그대로 사용</strong>합니다. 권장: 1200 × 1500 px (4:5) 또는 1080 × 1920 px (9:16).
          </p>
        }
        previewUrl={mobilePreviewUrl}
        urlValue={formData.mobileImageUrl}
        hasFile={!!formData.mobileImageFile}
        accept="image/jpeg,image/png,image/webp,image/gif"
        emptyTitle="클릭하여 모바일 이미지 업로드"
        emptySubtitle="선택 사항 — 비워두면 PC 이미지 사용"
        emptyHeight="h-28"
        iconSize="w-6 h-6"
        urlPlaceholder="https://example.com/mobile.jpg"
        onFileSelect={onMobileFileSelect}
        onUrlChange={onMobileUrlChange}
        onClear={onMobileClear}
      />
    </>
  );
}
