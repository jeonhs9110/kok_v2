import { useCallback, useEffect, useRef, useState } from 'react';
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

const supabase = getSupabaseBrowser();

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

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      // Merge-on-save: refetch DB row before writing back. /admin/best-seller-display
      // owns a subset of theme_tokens; a naive full-state upsert here would clobber
      // any change made over there in parallel.
      const { data: latest } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'theme_tokens')
        .maybeSingle();
      const latestTokens = parseThemeTokens(latest?.value);
      const merged: ThemeTokens = {
        ...latestTokens,
        ...tokens,
        // BEST SELLER subset owned by /admin/best-seller-display; pin to
        // DB value so this save can't undo changes made there.
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

  return {
    tokens, setTokens,
    isLoading, isSaving, savedFlash, isDirty,
    previewLang, setPreviewLang,
    iframeRef, isEmbedded,
    handleSave, handleReset, handleRevert,
  };
}
