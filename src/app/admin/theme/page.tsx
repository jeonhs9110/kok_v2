'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Palette, RefreshCw, Save, RotateCcw } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import {
  DEFAULT_THEME_TOKENS,
  parseThemeTokens,
  tokensToCss,
  type ThemeTokens,
} from '@/lib/theme/tokens';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';
import { LoadingState } from '@/components/admin/CafeWidgets';
import HeroSizeCompact from './_components/HeroSizeCompact';
import { Section, ColorRow, FontRow } from './_components/ThemeFormPrimitives';
import ShapeSection from './_components/ShapeSection';
import ThemePreviewPane from './_components/ThemePreviewPane';

// Session-aware client. site_settings writes require admin JWT (Phase 2 RLS).
const supabase = getSupabaseBrowser();

/**
 * /admin/theme — live theme tokens editor.
 *
 * Two-pane layout:
 *   left  → color pickers + radius + font inputs
 *   right → iframe pointing at /kr that receives postMessage updates
 *           on every change, no reload required.
 *
 * Save flow writes the JSON-encoded tokens to the `theme_tokens` row in
 * site_settings. The next public page load picks up the change via
 * getThemeTokens() in [lang]/layout. Other admin tabs already pointed
 * at /kr (the live preview iframe here) update via postMessage on save.
 */
export default function ThemePage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [savedTokens, setSavedTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [previewLang, setPreviewLang] = useState<'kr' | 'en'>('kr');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('no client');
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'theme_tokens')
        .maybeSingle();
      const parsed = parseThemeTokens(data?.value);
      setTokens(parsed);
      setSavedTokens(parsed);
    } catch (err) {
      console.error('[admin/theme] load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // Push live updates to the iframe on every token change. Debounced
  // via rAF to coalesce rapid color-picker drags into one paint.
  //
  // When this page renders inside the /admin/homepage builder's
  // slide-in drawer (?embedded=true), the local iframe is hidden
  // and we forward the same message to the parent window — the hub
  // re-broadcasts it to ITS central preview iframe so the operator sees
  // changes against the actual storefront while editing in the
  // drawer (no redundant in-drawer iframe stealing space).
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const css = tokensToCss(tokens);
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: 'kokkok-theme-tokens', css },
          window.location.origin,
        );
      }
      // Bubble to parent hub when embedded.
      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage(
          { type: 'kokkok-theme-tokens', css },
          window.location.origin,
        );
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [tokens]);

  // Embedded detection — hides the local preview pane and uses the
  // parent hub's central iframe instead. Reads ?embedded=true from
  // window.location after mount (safe — this is a 'use client' page).
  const [isEmbedded, setIsEmbedded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsEmbedded(new URLSearchParams(window.location.search).get('embedded') === 'true');
  }, []);

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      // Merge-on-save: refetch the current DB row before writing back.
      // /admin/best-seller-display now owns a subset of theme_tokens
      // (product fonts + image ratio) — if both pages are open in
      // parallel tabs, a naive full-state upsert here would clobber
      // any change the operator just saved over there. Refetching +
      // spreading current state preserves whatever's in DB for fields
      // this page doesn't expose.
      const { data: latest } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'theme_tokens')
        .maybeSingle();
      const latestTokens = parseThemeTokens(latest?.value);
      // Fields this page DOES own — overwrite from local state. Other
      // fields fall through from the freshly-loaded DB row.
      const merged: ThemeTokens = {
        ...latestTokens,
        ...tokens,
        // BEST SELLER subset is owned by /admin/best-seller-display
        // now; pin it to the DB value so this save can't undo
        // changes the operator just made there.
        product_section_title_size: latestTokens.product_section_title_size,
        product_name_size: latestTokens.product_name_size,
        home_product_summary_size: latestTokens.home_product_summary_size,
        product_price_size: latestTokens.product_price_size,
        home_product_image_ratio: latestTokens.home_product_image_ratio,
      };
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'theme_tokens', value: JSON.stringify(merged), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      setSavedTokens(merged);
      setTokens(merged);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      console.error('[admin/theme] save failed:', err);
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirm({
      message: '기본값으로 되돌리시겠습니까? 저장 전까지는 변경 사항이 반영되지 않습니다.',
      confirmText: '초기화',
    });
    if (!ok) return;
    setTokens(DEFAULT_THEME_TOKENS);
  };

  const handleRevert = () => {
    setTokens(savedTokens);
  };

  const isDirty = JSON.stringify(tokens) !== JSON.stringify(savedTokens);
  useUnsavedChanges(isDirty);

  return (
    <div className={isEmbedded ? 'block' : 'grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6'}>
      {/* Editor pane */}
      <aside className="bg-white rounded border border-[#e5e7eb] overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
        <div className="p-4 border-b border-[#e5e7eb] bg-[#fafbfc]">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-gray-500" />
            <h2 className="font-bold text-gray-800">테마 편집</h2>
          </div>
          <p className="text-xs text-gray-500">
            오른쪽 미리보기에 실시간으로 반영됩니다. 저장 전에는 사이트에 적용되지 않습니다.
          </p>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {isLoading ? (
            <LoadingState />
          ) : (
            <>
              <Section title="브랜드 색상">
                <ColorRow label="잉크 (본문/타이틀)" value={tokens.color_brand_ink}
                  onChange={v => setTokens(t => ({ ...t, color_brand_ink: v }))} />
                <ColorRow label="액센트 (할인 표시)" value={tokens.color_brand_accent}
                  onChange={v => setTokens(t => ({ ...t, color_brand_accent: v }))} />
                <ColorRow label="뮤트 (보조 텍스트)" value={tokens.color_brand_muted}
                  onChange={v => setTokens(t => ({ ...t, color_brand_muted: v }))} />
                <ColorRow label="프라이머리 (긍정/저장)" value={tokens.color_brand_primary}
                  onChange={v => setTokens(t => ({ ...t, color_brand_primary: v }))} />
                <ColorRow label="공지 시작 (그라데이션)" value={tokens.color_brand_notice_from}
                  onChange={v => setTokens(t => ({ ...t, color_brand_notice_from: v }))} />
                <ColorRow label="공지 끝 (그라데이션)" value={tokens.color_brand_notice_to}
                  onChange={v => setTokens(t => ({ ...t, color_brand_notice_to: v }))} />
              </Section>

              <ShapeSection tokens={tokens} setTokens={setTokens} />

              <Section title="메인 배너 (히어로) 크기">
                <HeroSizeCompact tokens={tokens} setTokens={setTokens} />
              </Section>

              {/* BEST SELLER font + image-ratio controls moved to
                  /admin/best-seller-display on 2026-06-17 so the
                  operator manages every BEST SELLER surface (scale,
                  gaps, fonts, image ratio) on one screen. Leaving a
                  redirect breadcrumb so muscle memory routes to the
                  new home. */}
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
                <FontRow label="본문 폰트" value={tokens.font_body}
                  onChange={v => setTokens(t => ({ ...t, font_body: v }))} />
                <FontRow label="제목 폰트 (H1~H6)" value={tokens.font_display}
                  onChange={v => setTokens(t => ({ ...t, font_display: v }))} />
                <FontRow label="헤더 / 메뉴 폰트" value={tokens.font_header}
                  onChange={v => setTokens(t => ({ ...t, font_header: v }))} />
                <FontRow label="버튼 폰트 (CTA)" value={tokens.font_button}
                  onChange={v => setTokens(t => ({ ...t, font_button: v }))} />
                <FontRow label="가격 폰트 (숫자)" value={tokens.font_price}
                  onChange={v => setTokens(t => ({ ...t, font_price: v }))} />
                <p className="text-[10px] text-gray-400">
                  드롭다운에서 사이트가 미리 로드한 8개 폰트 중 하나를 고르거나, &quot;기타 (직접 입력)&quot;를
                  선택해 시스템에 설치된 폰트명 또는 Google Fonts 폰트 패밀리 문자열을 직접 입력할 수 있습니다.
                  비워두면 본문 폰트(또는 브랜드 기본값)를 따릅니다.
                </p>
              </Section>
            </>
          )}
        </div>

        <div className="border-t border-[#f3f4f6] p-4 flex flex-wrap items-center gap-2 bg-[#fafbfc]">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider rounded-lg transition ${
              savedFlash
                ? 'bg-[#16a34a] text-white'
                : isDirty
                ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                : 'bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : savedFlash ? '✓ 저장 완료' : isDirty ? '변경 사항 저장' : '저장된 상태'}
          </button>
          <button
            type="button"
            onClick={handleRevert}
            disabled={!isDirty}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-[#d1d5db] text-[#6b7280] rounded-lg hover:bg-[#f9fafb] transition disabled:opacity-40 kokkok-keep-border"
            title="저장된 상태로 되돌리기"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 되돌리기
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-[#d1d5db] text-[#6b7280] rounded-lg hover:bg-[#f9fafb] transition kokkok-keep-border"
            title="기본값으로 리셋 (저장 안 함)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 기본값
          </button>
        </div>
      </aside>

      {/* Preview pane — hidden in embedded mode; the parent hub's
          central iframe shows the live preview instead. */}
      {!isEmbedded && (
        <ThemePreviewPane
          previewLang={previewLang}
          onPreviewLangChange={setPreviewLang}
          iframeRef={iframeRef}
        />
      )}
    </div>
  );
}
