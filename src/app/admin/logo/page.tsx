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
import BackgroundMediaCard, { type Background } from './_components/BackgroundMediaCard';
import LogoPreviewPane from './_components/LogoPreviewPane';

// Session-aware client. Phase 2 RLS lockdown requires admin's JWT for
// site_backgrounds writes — see migration 18.
const supabase = getSupabaseBrowser();

const BUCKET = 'site-assets';

const ACCEPT_BG = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm';
const MAX_BG_SIZE = 50 * 1024 * 1024; // 50MB

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
  // Bumping this key forces the iframe to remount — used after a logo upload
  // or background activate/deactivate so the preview refetches everything
  // instead of holding the cached header / background from before the change.
  const [iframeKey, setIframeKey] = useState(0);

  // ── Background state ─────────────────────────────────────────
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [bgPending, setBgPending] = useState<File | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgBusyId, setBgBusyId] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // ── Load everything on mount ─────────────────────────────────
  const loadBackgrounds = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('site_backgrounds')
      .select('*')
      .order('created_at', { ascending: false });
    setBackgrounds((data ?? []) as Background[]);
  }, []);

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
      await Promise.all([loadBackgrounds(), loadTokens()]);
      setIsLoading(false);
    })();
  }, [loadBackgrounds, loadTokens]);

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
      // parent so the hub's central iframe stays in sync. The hub
      // re-broadcasts to its storefront preview.
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
  // central iframe shows it instead. Read after mount so SSR + this
  // 'use client' page agree on the initial render.
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
      // Reload the preview iframe so it picks up the new logo URL.
      setIframeKey(k => k + 1);
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
      setIframeKey(k => k + 1);
    }
    setLogoSaving(false);
  };

  // ── Background handlers ──────────────────────────────────────
  const handleBgPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BG_SIZE) {
      toast.show(`파일 크기가 ${MAX_BG_SIZE / 1024 / 1024}MB를 초과합니다.`, 'warning');
      e.target.value = '';
      return;
    }
    setBgPending(f);
  };

  const uploadBackground = async () => {
    if (!bgPending || !supabase) return;
    setBgUploading(true);
    try {
      const ext = bgPending.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const isVideo = bgPending.type.startsWith('video/');
      const path = `backgrounds/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bgPending, {
        upsert: false,
        contentType: bgPending.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: insErr } = await supabase.from('site_backgrounds').insert({
        file_url: urlData.publicUrl,
        file_name: bgPending.name,
        file_type: isVideo ? 'video' : 'image',
        mime_type: bgPending.type || '',
        is_active: false,
      });
      if (insErr) throw insErr;
      setBgPending(null);
      if (bgInputRef.current) bgInputRef.current.value = '';
      await loadBackgrounds();
    } catch (err) {
      console.error(err);
      toast.show('배경 업로드에 실패했습니다.', 'error');
    } finally {
      setBgUploading(false);
    }
  };

  const activateBackground = async (id: string) => {
    if (!supabase) return;
    setBgBusyId(id);
    try {
      await supabase.from('site_backgrounds').update({ is_active: false }).neq('id', id);
      await supabase.from('site_backgrounds').update({ is_active: true }).eq('id', id);
      await loadBackgrounds();
      setIframeKey(k => k + 1);
    } finally {
      setBgBusyId(null);
    }
  };

  const deactivateBackground = async (id: string) => {
    if (!supabase) return;
    setBgBusyId(id);
    try {
      await supabase.from('site_backgrounds').update({ is_active: false }).eq('id', id);
      await loadBackgrounds();
      setIframeKey(k => k + 1);
    } finally {
      setBgBusyId(null);
    }
  };

  const toggleScrollDriven = async (bg: Background) => {
    if (!supabase) return;
    setBgBusyId(bg.id);
    try {
      await supabase
        .from('site_backgrounds')
        .update({ scroll_driven: !bg.scroll_driven })
        .eq('id', bg.id);
      await loadBackgrounds();
    } finally {
      setBgBusyId(null);
    }
  };

  const deleteBackground = async (bg: Background) => {
    if (!supabase) return;
    const ok = await confirm({ message: `"${bg.file_name || '이 배경'}"을(를) 삭제하시겠습니까?`, tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    setBgBusyId(bg.id);
    try {
      const marker = `/${BUCKET}/`;
      const idx = bg.file_url.indexOf(marker);
      if (idx >= 0) {
        const objPath = bg.file_url.slice(idx + marker.length);
        await supabase.storage.from(BUCKET).remove([objPath]);
      }
      await supabase.from('site_backgrounds').delete().eq('id', bg.id);
      await loadBackgrounds();
      setIframeKey(k => k + 1);
    } finally {
      setBgBusyId(null);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;
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
          backgrounds={backgrounds as Background[]}
          bgPending={bgPending}
          bgUploading={bgUploading}
          bgBusyId={bgBusyId}
          accept={ACCEPT_BG}
          onPickFile={handleBgPick}
          onUpload={uploadBackground}
          onActivate={activateBackground}
          onDeactivate={deactivateBackground}
          onToggleScrollDriven={toggleScrollDriven}
          onDelete={deleteBackground}
        />
      </div>

      {/* Live preview pane (right) — hidden in embedded mode. The hub
          shows the live preview in its central iframe instead, fed by
          the bubbled-up postMessage tokens above. */}
      {!isEmbedded && (
        <LogoPreviewPane
          iframeKey={iframeKey}
          iframeRef={iframeRef}
          onReload={() => setIframeKey(k => k + 1)}
        />
      )}
    </div>
  );
}
