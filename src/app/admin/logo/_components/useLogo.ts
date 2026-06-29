import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useIsDirty } from '@/hooks/useIsDirty';
import { getSiteSetting, setSiteSetting } from '@/lib/api/site-settings';
import { revalidateHeaderData, revalidateHomepageData } from '@/lib/cache/invalidate';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
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

  // 2026-06-29: replaced direct Supabase read with /api/admin/site-settings
  // which dispatches via USE_RDS server-side. Pre-fix this hook hit
  // Supabase unconditionally — the admin theme editor has been LOADING
  // the frozen 2026-06-27 snapshot since cutover, so when the operator
  // opens /admin/logo to tweak colors they see stale values, not what
  // the storefront actually rendered last edit.
  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/site-settings?keys=theme_tokens', { cache: 'no-store' });
      if (!res.ok) return;
      const { values } = await res.json() as { values: Record<string, unknown> };
      const parsed = parseThemeTokens(values.theme_tokens);
      setTokens(parsed);
      setSavedTokens(parsed);
    } catch (err) {
      console.error('[admin/logo] tokens load failed:', err);
    }
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

  const tokensDirty = useIsDirty(tokens, savedTokens);

  // 2026-06-29: replaced direct Supabase upsert with /api/admin/site-settings
  // POST which dispatches via USE_RDS. Pre-fix this hook wrote tokens
  // straight to Supabase — after cutover the storefront's getThemeTokens()
  // reads from RDS, so every "Save" was landing in the dead silo while
  // the public site kept rendering the cutover-day snapshot. Operator
  // saw a "saved" toast that meant nothing.
  //
  // Hardened 2026-06-29 (post-PR-#314 review):
  //   - Merge-on-save: refetch the latest theme_tokens row before writing
  //     so a parallel edit from /admin/theme or /admin/best-seller-display
  //     in another tab doesn't get clobbered. This is the same pattern
  //     useTheme.handleSave uses (it's the canonical theme-tokens editor).
  //     Without it, an operator who opens /admin/logo, switches tabs to
  //     /admin/theme to tweak a color and saves, then comes back to
  //     /admin/logo and saves there, would lose the color change.
  //   - Evict the storefront 'theme_tokens' ISR cache tag too. The prior
  //     code only called revalidateHeaderData(), which clears the in-
  //     process header memo. getThemeTokens.ts wraps with unstable_cache
  //     tagged 'theme_tokens'; without the tag eviction the storefront
  //     keeps rendering the old palette for up to 60s after save.
  const handleTokensSave = async () => {
    setTokensSaving(true);
    try {
      const latestRes = await fetch('/api/admin/site-settings?keys=theme_tokens', { cache: 'no-store' });
      let latestTokens: ThemeTokens = DEFAULT_THEME_TOKENS;
      if (latestRes.ok) {
        const json = (await latestRes.json()) as { values?: Record<string, unknown> };
        latestTokens = parseThemeTokens(json.values?.theme_tokens);
      }
      const merged: ThemeTokens = { ...latestTokens, ...tokens };
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ key: 'theme_tokens', value: JSON.stringify(merged) }] }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setTokens(merged);
      setSavedTokens(merged);
      await Promise.all([
        revalidateHeaderData(),
        revalidateHomepageData('theme_tokens'),
      ]);
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
    if (!logoPending) return;
    setLogoSaving(true);
    try {
      let publicUrl: string;
      if (USE_S3_FROM_BROWSER) {
        const r = await uploadFileToS3(logoPending, { keyPrefix: 'logo', contentType: logoPending.type });
        publicUrl = r.publicUrl;
      } else {
        if (!supabase) return;
        const ext = logoPending.name.split('.').pop() ?? 'png';
        const path = `logo/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, logoPending, { upsert: false });
        if (upErr) throw upErr;
        publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      // setSiteSetting already dispatches on USE_RDS server-side. The
      // supabase arg is ignored under the RDS path; pass it for the
      // supabase path's RLS requirement when USE_RDS is unset.
      const ok = await setSiteSetting(supabase!, 'logo_url', publicUrl);
      if (!ok) throw new Error('저장 실패');
      await revalidateHeaderData();
      setLogoUrl(publicUrl);
      setLogoPreview(publicUrl);
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
