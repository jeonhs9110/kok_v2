'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
import SiteLogoCard from './_components/SiteLogoCard';
import LogoSizeCard from './_components/LogoSizeCard';
import BackgroundMediaCard from './_components/BackgroundMediaCard';
import LogoPreviewPane from './_components/LogoPreviewPane';
import { useBackgroundManagement } from './_components/useBackgroundManagement';

// Session-aware client. Phase 2 RLS lockdown requires admin's JWT for
// site_backgrounds writes — see migration 18.
const supabase = getSupabaseBrowser();

const BUCKET = 'site-assets';

export default function LogoAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  // ── Logo state ───────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [logoPending, setLogoPending] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoSavedFlash, setLogoSavedFlash] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Theme tokens (drives logo height + iframe live updates) ─────
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [savedTokens, setSavedTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [tokensSaving, setTokensSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const reloadIframe = useCallback(() => setIframeKey(k => k + 1), []);

  // ── Background management (extracted hook) ──────────────────
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

  // Push live updates to the iframe on every token change (same pattern
  // as /admin/theme). The iframe's <style id="kokkok-theme-tokens">
  // listener — registered in src/app/[lang]/layout.tsx — swaps in the
  // new CSS so the logo height changes without a save / refresh.
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
      // When this page is rendered inside the /admin/homepage builder
      // drawer (?embedded=true), bubble the same tokens up to the
      // parent so the hub's central iframe stays in sync.
      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage(
          { type: 'kokkok-theme-tokens', css },
          window.location.origin,
        );
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [tokens]);

  // Embedded mode hides the local preview pane — the parent hub's
  // central iframe shows it instead.
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

  // ── Logo handlers ──────────────────────────────────────────
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

  if (isLoading) {
    return <div className="p-8 text-sm text-[#6b7280]">불러오는 중...</div>;
  }

  return (
    <div className={isEmbedded ? 'block' : 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6'}>
      {/* ── Controls pane (left) ────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        <SiteLogoCard
          logoPreview={logoPreview}
          logoUrl={logoUrl}
          hasPending={!!logoPending}
          isSaving={logoSaving}
          showSavedFlash={logoSavedFlash}
          onPickFile={handleLogoPick}
          onUpload={uploadLogo}
          onDelete={removeLogo}
        />

        <LogoSizeCard
          tokens={tokens}
          setTokens={setTokens}
          savedTokens={savedTokens}
          isDirty={tokensDirty}
          isSaving={tokensSaving}
          onSave={handleTokensSave}
        />

        <BackgroundMediaCard
          backgrounds={bg.backgrounds}
          bgPending={bg.bgPending}
          bgUploading={bg.bgUploading}
          bgBusyId={bg.bgBusyId}
          accept={bg.accept}
          onPickFile={bg.handleBgPick}
          onUpload={bg.uploadBackground}
          onActivate={bg.activateBackground}
          onDeactivate={bg.deactivateBackground}
          onToggleScrollDriven={bg.toggleScrollDriven}
          onDelete={bg.deleteBackground}
        />
      </div>

      {/* Live preview pane (right) — hidden in embedded mode. The hub
          shows the live preview in its central iframe instead, fed by
          the bubbled-up postMessage tokens above. */}
      {!isEmbedded && (
        <LogoPreviewPane
          iframeKey={iframeKey}
          iframeRef={iframeRef}
          onReload={reloadIframe}
        />
      )}
    </div>
  );
}
