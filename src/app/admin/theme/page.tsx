'use client';

import Link from 'next/link';
import { Palette, RefreshCw, Save, RotateCcw } from 'lucide-react';
import { LoadingState } from '@/components/admin/CafeWidgets';
import HeroSizeCompact from './_components/HeroSizeCompact';
import { Section, ColorRow, FontRow } from './_components/ThemeFormPrimitives';
import ShapeSection from './_components/ShapeSection';
import ThemePreviewPane from './_components/ThemePreviewPane';
import { useTheme } from './_components/useTheme';

/**
 * /admin/theme — live theme tokens editor.
 *
 * Left pane → color pickers + radius + font inputs.
 * Right pane → iframe pointing at /kr that receives postMessage updates
 *              on every change, no reload required.
 *
 * Save flow writes the JSON-encoded tokens to the `theme_tokens` row in
 * site_settings. The next public page load picks up the change via
 * getThemeTokens() in [lang]/layout.
 */
export default function ThemePage() {
  const t = useTheme();

  return (
    <div className={t.isEmbedded ? 'block' : 'grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6'}>
      {/* Editor pane */}
      <aside className="bg-white rounded border border-[#e5e7eb] overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
        <div className="p-4 border-b border-[#e5e7eb] bg-[#fafbfc]">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-[#6b7280]" />
            <h2 className="font-bold text-[#1f2937]">테마 편집</h2>
          </div>
          <p className="text-xs text-[#6b7280]">
            오른쪽 미리보기에 실시간으로 반영됩니다. 저장 전에는 사이트에 적용되지 않습니다.
          </p>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {t.isLoading ? (
            <LoadingState />
          ) : (
            <>
              <Section title="브랜드 색상">
                <ColorRow label="잉크 (본문/타이틀)" value={t.tokens.color_brand_ink}
                  onChange={v => t.setTokens(prev => ({ ...prev, color_brand_ink: v }))} />
                <ColorRow label="액센트 (할인 표시)" value={t.tokens.color_brand_accent}
                  onChange={v => t.setTokens(prev => ({ ...prev, color_brand_accent: v }))} />
                <ColorRow label="뮤트 (보조 텍스트)" value={t.tokens.color_brand_muted}
                  onChange={v => t.setTokens(prev => ({ ...prev, color_brand_muted: v }))} />
                <ColorRow label="프라이머리 (긍정/저장)" value={t.tokens.color_brand_primary}
                  onChange={v => t.setTokens(prev => ({ ...prev, color_brand_primary: v }))} />
                <ColorRow label="공지 시작 (그라데이션)" value={t.tokens.color_brand_notice_from}
                  onChange={v => t.setTokens(prev => ({ ...prev, color_brand_notice_from: v }))} />
                <ColorRow label="공지 끝 (그라데이션)" value={t.tokens.color_brand_notice_to}
                  onChange={v => t.setTokens(prev => ({ ...prev, color_brand_notice_to: v }))} />
              </Section>

              <ShapeSection tokens={t.tokens} setTokens={t.setTokens} />

              <Section title="메인 배너 (히어로) 크기">
                <HeroSizeCompact tokens={t.tokens} setTokens={t.setTokens} />
              </Section>

              {/* BEST SELLER font + image-ratio controls moved to
                  /admin/best-seller-display on 2026-06-17. Breadcrumb here. */}
              <Section title="홈 메인 추천 상품 (BEST SELLER) — 이동됨">
                <Link
                  href="/admin/best-seller-display"
                  className="block rounded border border-[#bfdbfe] bg-[#eff6ff] hover:bg-[#dbeafe] px-3 py-2.5 transition-colors no-underline"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-semibold text-[#1e3a8a]">
                        섹션 제목 · 제품명 · 가격 · 설명 · 이미지 비율
                      </div>
                      <div className="text-[11px] text-[#3b82f6] mt-0.5">
                        카드 크기 / 간격과 함께 한 곳에서 조절하도록 옮겼습니다.
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold text-[#1d4ed8] flex-shrink-0">이동 →</span>
                  </div>
                </Link>
              </Section>

              <Section title="타이포그래피 (선택)">
                <FontRow label="본문 폰트" value={t.tokens.font_body}
                  onChange={v => t.setTokens(prev => ({ ...prev, font_body: v }))} />
                <FontRow label="제목 폰트 (H1~H6)" value={t.tokens.font_display}
                  onChange={v => t.setTokens(prev => ({ ...prev, font_display: v }))} />
                <FontRow label="헤더 / 메뉴 폰트" value={t.tokens.font_header}
                  onChange={v => t.setTokens(prev => ({ ...prev, font_header: v }))} />
                <FontRow label="버튼 폰트 (CTA)" value={t.tokens.font_button}
                  onChange={v => t.setTokens(prev => ({ ...prev, font_button: v }))} />
                <FontRow label="가격 폰트 (숫자)" value={t.tokens.font_price}
                  onChange={v => t.setTokens(prev => ({ ...prev, font_price: v }))} />
                <p className="text-[10px] text-[#9ca3af]">
                  드롭다운에서 사이트가 미리 로드한 8개 폰트 중 하나를 고르거나, &quot;기타 (직접 입력)&quot;를
                  선택해 시스템에 설치된 폰트명 또는 Google Fonts 폰트 패밀리 문자열을 직접 입력할 수 있습니다.
                  비워두면 본문 폰트(또는 브랜드 기본값)를 따릅니다.
                </p>
              </Section>

              <Section title="Google Analytics 4">
                <label className="block">
                  <span className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
                    측정 ID
                  </span>
                  <input
                    type="text"
                    value={t.tokens.ga_measurement_id}
                    onChange={e => t.setTokens(prev => ({ ...prev, ga_measurement_id: e.target.value.trim() }))}
                    placeholder="G-XXXXXXXXXX"
                    className="mt-1 w-full px-3 py-2 text-sm rounded border border-[#e5e7eb] focus:outline-none focus:border-[#3b82f6] font-mono"
                  />
                </label>
                {t.tokens.ga_measurement_id && !/^G-[A-Z0-9]+$/i.test(t.tokens.ga_measurement_id) && (
                  <p className="text-[11px] text-[#dc2626] mt-1 font-semibold">
                    G-로 시작하고 영문/숫자만 사용한 측정 ID여야 합니다. 형식이 맞지 않으면 스토어에 로드되지 않습니다.
                  </p>
                )}
                <p className="text-[10px] text-[#9ca3af] mt-2 leading-relaxed">
                  GA4 속성의 측정 ID(<code className="font-mono">G-</code>로 시작)를 입력하면 스토어
                  방문이 Google Analytics에 함께 기록됩니다. 비워두면 GA가 로드되지 않습니다.
                  GA4 enhanced measurement가 자동으로 페이지 이동을 추적하므로 별도 설정이
                  필요 없습니다.
                </p>
              </Section>
            </>
          )}
        </div>

        <div className="border-t border-[#f3f4f6] p-4 flex flex-wrap items-center gap-2 bg-[#fafbfc]">
          <button
            type="button"
            onClick={t.handleSave}
            disabled={!t.isDirty || t.isSaving}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider rounded-lg transition ${
              t.savedFlash
                ? 'bg-[#16a34a] text-white'
                : t.isDirty
                ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                : 'bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {t.isSaving ? '저장 중...' : t.savedFlash ? '✓ 저장 완료' : t.isDirty ? '변경 사항 저장' : '저장된 상태'}
          </button>
          <button
            type="button"
            onClick={t.handleRevert}
            disabled={!t.isDirty}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-[#d1d5db] text-[#6b7280] rounded-lg hover:bg-[#f9fafb] transition disabled:opacity-40 kokkok-keep-border"
            title="저장된 상태로 되돌리기"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 되돌리기
          </button>
          <button
            type="button"
            onClick={t.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-[#d1d5db] text-[#6b7280] rounded-lg hover:bg-[#f9fafb] transition kokkok-keep-border"
            title="기본값으로 리셋 (저장 안 함)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 기본값
          </button>
        </div>
      </aside>

      {/* Preview pane — hidden in embedded mode; the parent hub's central
          iframe shows the live preview instead. */}
      {!t.isEmbedded && (
        <ThemePreviewPane
          previewLang={t.previewLang}
          onPreviewLangChange={t.setPreviewLang}
          iframeRef={t.iframeRef}
        />
      )}
    </div>
  );
}
