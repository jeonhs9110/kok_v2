import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_THEME_TOKENS,
  parseThemeTokens,
  tokensToCss,
  type ThemeTokens,
} from '@/lib/theme/tokens';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useIsDirty } from '@/hooks/useIsDirty';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';
import { revalidateHeaderData, revalidateHomepageData } from '@/lib/cache/invalidate';

async function readSetting(key: string): Promise<unknown> {
  const res = await fetch(`/api/admin/site-settings?keys=${encodeURIComponent(key)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = (await res.json()) as { values?: Record<string, unknown> };
  return json.values?.[key] ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  const res = await fetch('/api/admin/site-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ key, value }] }),
  });
  if (!res.ok) throw new Error('site-settings upsert failed');
}

/**
 * State + handlers for /admin/theme. Owns the working tokens + the saved
 * snapshot (for dirty detection), the iframe ref + live-broadcast pipeline,
 * the embedded-drawer detection, and the merge-on-save flow that lets
 * /admin/best-seller-display keep its subset of theme_tokens without
 * clobbering colors/header tokens this page doesn't expose.
 */
export function useTheme() {
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
      const raw = await readSetting('theme_tokens');
      const parsed = parseThemeTokens(raw);
      setTokens(parsed);
      setSavedTokens(parsed);
    } catch (err) {
      console.error('[admin/theme] load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // Push live updates to the iframe on every token change. Debounced via
  // rAF to coalesce rapid color-picker drags into one paint. When embedded
  // in /admin/homepage's drawer, also bubble to the parent so the hub's
  // central iframe stays in sync.
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
      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage(
          { type: 'kokkok-theme-tokens', css },
          window.location.origin,
        );
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [tokens]);

  // Embedded detection (?embedded=true) — hides local preview pane.
  const [isEmbedded, setIsEmbedded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsEmbedded(new URLSearchParams(window.location.search).get('embedded') === 'true');
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Merge-on-save: refetch the latest row before writing back.
      // /admin/best-seller-display owns a subset of theme_tokens; a
      // naive full-state upsert here would clobber any change made
      // over there in parallel.
      const latestRaw = await readSetting('theme_tokens');
      const latestTokens = parseThemeTokens(latestRaw);
      const merged: ThemeTokens = {
        ...latestTokens,
        ...tokens,
        product_section_title_size: latestTokens.product_section_title_size,
        product_name_size: latestTokens.product_name_size,
        home_product_summary_size: latestTokens.home_product_summary_size,
        product_price_size: latestTokens.product_price_size,
        home_product_image_ratio: latestTokens.home_product_image_ratio,
      };
      await writeSetting('theme_tokens', JSON.stringify(merged));
      setSavedTokens(merged);
      setTokens(merged);
      setSavedFlash(true);
      // Theme tokens drive header chrome + global CSS vars. We have to
      // evict BOTH caches:
      //   - process-local header memo (lib/cache/header.ts) for this EC2
      //     instance's next render
      //   - Next.js ISR cache tag 'theme_tokens' (getThemeTokens.ts) for
      //     storefront SSR across instances
      // Without the second call, the storefront kept the old palette
      // for up to 60s after the admin save — audit 2026-06-21.
      await Promise.all([
        revalidateHeaderData(),
        revalidateHomepageData('theme_tokens'),
      ]);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      console.error('[admin/theme] save failed:', err);
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [tokens, toast]);

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      message: '기본값으로 되돌리시겠습니까? 저장 전까지는 변경 사항이 반영되지 않습니다.',
      confirmText: '초기화',
    });
    if (!ok) return;
    setTokens(DEFAULT_THEME_TOKENS);
  }, [confirm]);

  const handleRevert = useCallback(() => {
    setTokens(savedTokens);
  }, [savedTokens]);

  // Memoized — avoids reserializing the 30+-key tokens object every render.
  const isDirty = useIsDirty(tokens, savedTokens);
  useUnsavedChanges(isDirty);

  return {
    tokens, setTokens,
    isLoading, isSaving, savedFlash, isDirty,
    previewLang, setPreviewLang,
    iframeRef, isEmbedded,
    handleSave, handleReset, handleRevert,
  };
}
