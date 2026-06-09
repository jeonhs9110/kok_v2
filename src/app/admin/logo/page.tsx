'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, Trash2, Check, Star, Eye, RefreshCw, Save } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { getSiteSetting, setSiteSetting } from '@/lib/api/site-settings';
import { revalidateHeaderData } from '@/lib/cache/invalidate';
import {
  DEFAULT_THEME_TOKENS,
  parseThemeTokens,
  tokensToCss,
  type ThemeTokens,
} from '@/lib/theme/tokens';

// Session-aware client. Phase 2 RLS lockdown requires admin's JWT for
// site_backgrounds writes — see migration 18.
const supabase = getSupabaseBrowser();

const BUCKET = 'site-assets';

interface Background {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'image' | 'video';
  mime_type: string;
  is_active: boolean;
  scroll_driven: boolean;
  created_at: string;
}

const ACCEPT_BG = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm';
const MAX_BG_SIZE = 50 * 1024 * 1024; // 50MB

const LOGO_HEIGHT_PRESETS: { v: string; l: string }[] = [
  { v: '32px', l: '작게' },
  { v: '40px', l: '기본' },
  { v: '48px', l: '크게' },
  { v: '56px', l: '더 크게' },
];

export default function LogoAdminPage() {
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
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: 'kokkok-theme-tokens', css: tokensToCss(tokens) },
        window.location.origin,
      );
    });
    return () => cancelAnimationFrame(handle);
  }, [tokens]);

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
      alert(err instanceof Error ? err.message : '저장 실패');
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
      alert('로고 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLogoSaving(false);
    }
  };

  const removeLogo = async () => {
    if (!confirm('로고를 삭제하고 기본 텍스트(KOKKOK GARDEN)로 돌아가시겠습니까?')) return;
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
      alert(`파일 크기가 ${MAX_BG_SIZE / 1024 / 1024}MB를 초과합니다.`);
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
      alert('배경 업로드에 실패했습니다.');
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
    if (!confirm(`"${bg.file_name || '이 배경'}"을(를) 삭제하시겠습니까?`)) return;
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
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
      {/* ── Controls pane (left) ────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        {/* 사이트 로고 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">사이트 로고</h2>
          <p className="text-sm text-gray-500 mb-6">
            상단 좌측에 노출되는 로고 이미지입니다. 업로드하지 않으면 기본 텍스트 &ldquo;KOKKOK GARDEN&rdquo;이 표시됩니다.
          </p>

          <div className="flex items-start gap-6 pb-6 border-b border-gray-100">
            <div className="flex-shrink-0 w-48 h-24 bg-brand-ink rounded flex items-center justify-center overflow-hidden">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="logo preview" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-white text-[18px] font-black tracking-[0.12em] uppercase">KOKKOK<br />GARDEN</span>
              )}
            </div>
            <div className="flex-1 text-sm text-gray-600 space-y-1.5">
              <p><strong className="text-gray-800">권장 규격</strong></p>
              <p>• 가로형 이미지 (예: 600×160px, 투명 배경 PNG 또는 SVG 권장)</p>
              <p>• 최대 2MB · PNG / SVG / WEBP / JPG</p>
              <p>• 어두운 배경 위에 올라가므로 밝은 색상의 로고를 권장합니다.</p>
            </div>
          </div>

          <div className="pt-6 space-y-4">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoPick}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />

            <div className="flex gap-3 flex-wrap">
              <button
                disabled={!logoPending || logoSaving}
                onClick={uploadLogo}
                className="inline-flex items-center gap-2 bg-brand-ink text-white px-6 py-2.5 text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {logoSaving ? '업로드 중...' : '로고 업로드 및 저장'}
              </button>

              {logoUrl && (
                <button
                  disabled={logoSaving}
                  onClick={removeLogo}
                  className="inline-flex items-center gap-2 bg-white text-red-600 border border-red-200 px-6 py-2.5 text-sm font-bold tracking-wider hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  로고 삭제 (기본 텍스트로 복구)
                </button>
              )}

              {logoSavedFlash && (
                <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                  <Check className="w-4 h-4" /> 저장되었습니다
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 로고 크기 — same picker pattern as /admin/theme's button-radius
            and menu-font controls. Token writes go to the theme_tokens
            row in site_settings; the picker shows a Save bar at the
            bottom so the admin can preview-then-commit. */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">로고 크기</h2>
          <p className="text-sm text-gray-500 mb-4">
            상단 헤더에 표시되는 로고의 높이를 조절합니다. 가로 폭은 비율을 유지한 채 자동으로 맞춰집니다. 오른쪽 미리보기가 실시간으로 반영됩니다.
          </p>

          <div className="grid grid-cols-4 gap-1.5">
            {LOGO_HEIGHT_PRESETS.map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setTokens(t => ({ ...t, header_logo_height: opt.v }))}
                className={`p-3 text-xs font-semibold border rounded ${
                  tokens.header_logo_height === opt.v
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{opt.l}</span>
                  <span className="text-[10px] opacity-70">{opt.v}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Numeric input for any height the presets don't cover (e.g.
              44px between 기본 40 and 크게 48). Range-clamped to
              20–80px — outside that the logo either disappears or
              breaks the 66px header bar. */}
          <div className="mt-3 flex items-center gap-2">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              직접 입력
            </label>
            <input
              type="number"
              min={20}
              max={80}
              step={1}
              value={parseInt(tokens.header_logo_height, 10) || 40}
              onChange={(e) => {
                const raw = parseInt(e.target.value, 10);
                if (!Number.isFinite(raw)) return;
                const clamped = Math.max(20, Math.min(80, raw));
                setTokens(t => ({ ...t, header_logo_height: `${clamped}px` }));
              }}
              className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
            />
            <span className="text-xs text-gray-500">px (20–80)</span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleTokensSave}
              disabled={!tokensDirty || tokensSaving}
              className="inline-flex items-center gap-2 bg-brand-ink text-white px-5 py-2 text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {tokensSaving ? '저장 중...' : tokensDirty ? '로고 크기 저장' : '저장됨'}
            </button>
            {tokensDirty && (
              <button
                type="button"
                onClick={() => setTokens(savedTokens)}
                className="text-xs text-gray-500 hover:text-black underline underline-offset-2"
              >
                되돌리기
              </button>
            )}
          </div>
        </div>

        {/* 배경 미디어 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">배경 미디어</h2>
          <p className="text-sm text-gray-500 mb-6">
            사이트 배경으로 사용할 이미지 또는 영상을 관리합니다. 여러 개 업로드 후 하나를 <strong className="text-green-600">활성</strong>으로 지정하면 오른쪽 미리보기에서 바로 확인할 수 있습니다.
          </p>

          {/* Upload form */}
          <div className="space-y-3 pb-6 border-b border-gray-100">
            <input
              ref={bgInputRef}
              type="file"
              accept={ACCEPT_BG}
              onChange={handleBgPick}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            {bgPending && (
              <p className="text-xs text-gray-500">
                선택됨: <span className="font-mono">{bgPending.name}</span> · {(bgPending.size / 1024 / 1024).toFixed(2)}MB · {bgPending.type || '(타입 미상)'}
              </p>
            )}
            <p className="text-[11px] text-gray-400">PNG / JPG / WEBP / GIF / MP4 / WEBM · 최대 50MB</p>

            <button
              disabled={!bgPending || bgUploading}
              onClick={uploadBackground}
              className="inline-flex items-center gap-2 bg-brand-ink text-white px-6 py-2.5 text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              {bgUploading ? '업로드 중...' : '배경 업로드'}
            </button>
          </div>

          {/* Library */}
          <div className="pt-6">
            {backgrounds.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">아직 등록된 배경이 없습니다. 위에서 업로드해주세요.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {backgrounds.map(bg => {
                  const busy = bgBusyId === bg.id;
                  return (
                    <div
                      key={bg.id}
                      className={`border overflow-hidden transition-shadow ${bg.is_active ? 'border-green-400 ring-2 ring-green-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="aspect-video bg-gray-100 relative overflow-hidden">
                        {bg.file_type === 'video' ? (
                          <video
                            src={bg.file_url}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bg.file_url} alt={bg.file_name} className="w-full h-full object-cover" />
                        )}
                        {bg.is_active && (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5">
                            <Star className="w-3 h-3 fill-white" /> 활성
                          </span>
                        )}
                        <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 uppercase">
                          {bg.file_type}
                        </span>
                      </div>

                      <div className="p-3 space-y-2">
                        <p className="text-xs text-gray-700 truncate font-medium" title={bg.file_name}>
                          {bg.file_name || '(이름 없음)'}
                        </p>
                        <p className="text-[10px] text-gray-400">{new Date(bg.created_at).toLocaleString('ko-KR')}</p>

                        {bg.file_type === 'video' && (
                          <label className="flex items-start gap-1.5 cursor-pointer pt-1 hover:bg-gray-50 -mx-1 px-1 py-1">
                            <input
                              type="checkbox"
                              checked={bg.scroll_driven}
                              disabled={busy}
                              onChange={() => toggleScrollDriven(bg)}
                              className="mt-0.5 w-3.5 h-3.5 accent-[#00693A] cursor-pointer flex-shrink-0"
                            />
                            <span className="text-[10px] text-gray-600 leading-tight">
                              <span className="font-semibold text-gray-700">스크롤 동기 재생</span>
                              <span className="block text-gray-400">스크롤에 맞춰 영상 진행 (Apple 스타일)</span>
                            </span>
                          </label>
                        )}

                        <div className="flex gap-1.5 pt-1">
                          {bg.is_active ? (
                            <button
                              disabled={busy}
                              onClick={() => deactivateBackground(bg.id)}
                              className="flex-1 text-xs font-semibold px-2 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                            >
                              비활성화
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => activateBackground(bg.id)}
                              className="flex-1 text-xs font-semibold px-2 py-1.5 bg-brand-ink text-white hover:bg-black transition-colors disabled:opacity-40"
                            >
                              활성화
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => deleteBackground(bg)}
                            className="px-2 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                            aria-label="삭제"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Live preview pane (right) ───────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)]">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">실시간 미리보기</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIframeKey(k => k + 1)}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-black"
              title="미리보기 새로고침"
            >
              <RefreshCw className="w-3 h-3" /> 새로고침
            </button>
            <a
              href="/kr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-500 hover:text-black underline"
            >
              새 탭
            </a>
          </div>
        </div>
        <div className="flex-1 min-h-[600px] bg-gray-100 relative">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src="/kr"
            className="absolute inset-0 w-full h-full bg-white"
            title="storefront preview"
          />
        </div>
      </section>
    </div>
  );
}
