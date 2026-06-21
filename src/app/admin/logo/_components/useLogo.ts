import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { getSiteSetting, setSiteSetting } from '@/lib/api/site-settings';
import { revalidateHeaderData } from '@/lib/cache/invalidate';
import {
  DEFAULT_THEME_TOKENS,
  parseThemeTokens,
  tokensToCss,
  type ThemeTokens,
} from '@/lib/theme/tokens';
import { useBackgroundManagement } from './useBackgroundManagement';

const supabase = getSupabaseBrowser();
const BUCKET = 'site-assets';

/**
 * Top-level hook for /admin/logo. Owns:
 *  - logo file picker + upload pipeline (with cookie/url state for preview)
 *  - theme tokens load + save (tokensDirty signal drives the LogoSizeCard
 *    save button)
 *  - iframe ref + rAF-debounced live broadcast to both the local preview
 *    and the parent hub when embedded in /admin/homepage's drawer
 *  - embedded-mode detection (?embedded=true) — hides local preview pane
 *  - the background-management hook bag (forwarded as `bg`)
 */
export function useLogo() {
  const toast = useToast();
  const confirm = useConfirm();

  // Logo state
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [logoPending, setLogoPending] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoSavedFlash, setLogoSavedFlash] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Theme tokens (drives logo height + iframe live updates)
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [savedTokens, setSavedTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [tokensSaving, setTokensSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const reloadIframe = useCallback(() => setIframeKey(k => k + 1), []);

  // Background-management bag
  const bg = useBackgroundManagement({
    supabase,
    toast,
    confirm,
    onIframeReload: reloadIframe,
  });

  const loadTokens = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'theme_tokens')
      .maybeSingle();
    const parsed = parseThemeTokens(data?.value);
    setTokens(parsed);
    setSavedTokens(parsed);
  }, []);

  useEffect(() => {
    (async () => {
      const url = await getSiteSetting('logo_url');
      setLogoUrl(url);
      setLogoPreview(url);
      await Promise.all([bg.loadBackgrounds(), loadTokens()]);
      setIsLoading(false);
    })();
  }, [bg, loadTokens]);

  // Push live token updates to the iframe + parent hub when embedded.
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

  // Embedded-mode detection.
  const [isEmbedded, setIsEmbedded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsEmbedded(new URLSearchParams(window.location.search).get('embedded') === 'true');
  }, []);

  const tokensDirty = JSON.stringify(tokens) !== JSON.stringify(savedTokens);

  const handleTokensSave = async () => {
    if (!supabase) return;
    setTokensSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'theme_tokens', value: JSON.stringify(tokens), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      setSavedTokens(tokens);
    } catch (err) {
      console.error('[admin/logo] tokens save failed:', err);
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setTokensSaving(false);
    }
  };

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoPending(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const uploadLogo = async () => {
    if (!logoPending || !supabase) return;
    setLogoSaving(true);
    try {
      const ext = logoPending.name.split('.').pop() ?? 'png';
      const path = `logo/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, logoPending, { upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const ok = await setSiteSetting(supabase, 'logo_url', data.publicUrl);
      if (!ok) throw new Error('저장 실패');
      await revalidateHeaderData();
      setLogoUrl(data.publicUrl);
      setLogoPreview(data.publicUrl);
      setLogoPending(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setLogoSavedFlash(true);
      setTimeout(() => setLogoSavedFlash(false), 3500);
      reloadIframe();
    } catch (err) {
      console.error(err);
      toast.show('로고 업로드에 실패했습니다.', 'error');
    } finally {
      setLogoSaving(false);
    }
  };

  const removeLogo = async () => {
    const confirmed = await confirm({ message: '로고를 삭제하고 기본 텍스트(KOKKOK GARDEN)로 돌아가시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!confirmed) return;
    setLogoSaving(true);
    const ok = await setSiteSetting(supabase, 'logo_url', '');
    if (ok) {
      await revalidateHeaderData();
      setLogoUrl('');
      setLogoPreview('');
      setLogoPending(null);
      setLogoSavedFlash(true);
      setTimeout(() => setLogoSavedFlash(false), 3500);
      reloadIframe();
    }
    setLogoSaving(false);
  };

  return {
    // logo
    logoUrl, logoPreview, logoPending,
    logoSaving, logoSavedFlash, logoInputRef,
    handleLogoPick, uploadLogo, removeLogo,
    // tokens
    tokens, setTokens, savedTokens,
    tokensDirty, tokensSaving, handleTokensSave,
    // iframe + embedded
    iframeRef, iframeKey, reloadIframe, isEmbedded,
    // bg
    bg,
    // overall
    isLoading,
  };
}
