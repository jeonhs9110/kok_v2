'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, Trash2, Check, Star } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Session-aware client. Phase 2 RLS lockdown requires admin's JWT for
// site_backgrounds writes — see migration 18.
const supabase = getSupabaseBrowser();
import { getSiteSetting, setSiteSetting } from '@/lib/api/site-settings';
import { revalidateHeaderData } from '@/lib/cache/invalidate';

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
const MAX_BG_SIZE = 50 * 1024 * 1024; // 50MB (Supabase Storage default upload limit)

export default function LogoAdminPage() {
  // ── Logo state ───────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [logoPending, setLogoPending] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoSavedFlash, setLogoSavedFlash] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Background state ─────────────────────────────────────────
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [bgPending, setBgPending] = useState<File | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgBusyId, setBgBusyId] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // ── Load both on mount ───────────────────────────────────────
  const loadBackgrounds = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('site_backgrounds')
      .select('*')
      .order('created_at', { ascending: false });
    setBackgrounds((data ?? []) as Background[]);
  }, []);

  useEffect(() => {
    (async () => {
      const url = await getSiteSetting('logo_url');
      setLogoUrl(url);
      setLogoPreview(url);
      await loadBackgrounds();
      setIsLoading(false);
    })();
  }, [loadBackgrounds]);

  // ── Logo handlers (unchanged behaviour) ──────────────────────
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
      // Header memo caches the logo URL alongside menus + categories;
      // bust it so the new logo shows immediately on the public site.
      await revalidateHeaderData();
      setLogoUrl(data.publicUrl);
      setLogoPreview(data.publicUrl);
      setLogoPending(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setLogoSavedFlash(true);
      setTimeout(() => setLogoSavedFlash(false), 3500);
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
      // Only one active at a time
      await supabase.from('site_backgrounds').update({ is_active: false }).neq('id', id);
      await supabase.from('site_backgrounds').update({ is_active: true }).eq('id', id);
      await loadBackgrounds();
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
      // Try to remove the underlying storage object (best-effort)
      const marker = `/${BUCKET}/`;
      const idx = bg.file_url.indexOf(marker);
      if (idx >= 0) {
        const objPath = bg.file_url.slice(idx + marker.length);
        await supabase.storage.from(BUCKET).remove([objPath]);
      }
      await supabase.from('site_backgrounds').delete().eq('id', bg.id);
      await loadBackgrounds();
    } finally {
      setBgBusyId(null);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── 사이트 로고 ──────────────────────────────────────── */}
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
              className="inline-flex items-center gap-2 bg-brand-ink text-white px-6 py-2.5 rounded text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              {logoSaving ? '업로드 중...' : '로고 업로드 및 저장'}
            </button>

            {logoUrl && (
              <button
                disabled={logoSaving}
                onClick={removeLogo}
                className="inline-flex items-center gap-2 bg-white text-red-600 border border-red-200 px-6 py-2.5 rounded text-sm font-bold tracking-wider hover:bg-red-50 transition-colors disabled:opacity-40"
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

      {/* ── 배경 미디어 ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">배경 미디어</h2>
        <p className="text-sm text-gray-500 mb-6">
          사이트 배경으로 사용할 이미지 또는 영상을 관리합니다. 여러 개 업로드 후 하나를 <strong className="text-green-600">활성</strong>으로 지정하면 그 항목이 사이트에 표시됩니다.
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
            className="inline-flex items-center gap-2 bg-brand-ink text-white px-6 py-2.5 rounded text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {backgrounds.map(bg => {
                const busy = bgBusyId === bg.id;
                return (
                  <div
                    key={bg.id}
                    className={`border rounded-lg overflow-hidden transition-shadow ${bg.is_active ? 'border-green-400 ring-2 ring-green-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
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
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          <Star className="w-3 h-3 fill-white" /> 활성
                        </span>
                      )}
                      <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase">
                        {bg.file_type}
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      <p className="text-xs text-gray-700 truncate font-medium" title={bg.file_name}>
                        {bg.file_name || '(이름 없음)'}
                      </p>
                      <p className="text-[10px] text-gray-400">{new Date(bg.created_at).toLocaleString('ko-KR')}</p>

                      {bg.file_type === 'video' && (
                        <label className="flex items-start gap-1.5 cursor-pointer pt-1 hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
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
                            className="flex-1 text-xs font-semibold px-2 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                          >
                            비활성화
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => activateBackground(bg.id)}
                            className="flex-1 text-xs font-semibold px-2 py-1.5 rounded bg-brand-ink text-white hover:bg-black transition-colors disabled:opacity-40"
                          >
                            활성화
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => deleteBackground(bg)}
                          className="px-2 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">💡 변경 후 반영</p>
        <p>업로드 후 사이트 페이지를 새로고침(F5)하면 새로운 로고/배경이 노출됩니다. 문제가 있으면 &ldquo;삭제&rdquo; 또는 &ldquo;비활성화&rdquo; 버튼으로 언제든 되돌릴 수 있습니다.</p>
      </div>
    </div>
  );
}
