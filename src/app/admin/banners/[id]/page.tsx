'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/types';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { LoadingState } from '@/components/admin/CafeWidgets';

const supabase = getSupabaseBrowser();

interface BannerRow {
  text: Record<string, string>;
  link_url: string;
  bg_color: string;
  text_color: string;
  is_active: boolean;
}

const DEFAULT: BannerRow = {
  text: {},
  link_url: '',
  bg_color: '#1f2937',
  text_color: '#ffffff',
  is_active: true,
};

/**
 * /admin/banners/[id] — edit one inline homepage banner. The row is
 * spawned by the + button on /admin/homepage; this page only handles
 * editing the row's content and deleting it. Placement (where the
 * banner sits in the homepage flow) is owned by the homepage builder's
 * drag-reorder — there is no order control on this form.
 *
 * 6-language text editor (matches carousel slide modal pattern). Live
 * preview chip mirrors the storefront's HomepageBanner rendering, and
 * every formData change posts up to the hub which forwards to the
 * central 1440px iframe (same pipeline as the slide live preview).
 */
export default function BannerEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const id = params?.id;

  const [data, setData] = useState<BannerRow>(DEFAULT);
  const [saved, setSaved] = useState<BannerRow>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [activeLang, setActiveLang] = useState<Lang>('kr');

  useEffect(() => {
    if (!supabase || !id) { setLoading(false); return; }
    (async () => {
      const { data: row, error } = await supabase
        .from('homepage_banners')
        .select('text,link_url,bg_color,text_color,is_active')
        .eq('id', id)
        .maybeSingle();
      if (error || !row) { setLoading(false); return; }
      const next: BannerRow = {
        text: typeof row.text === 'object' && row.text !== null ? row.text : {},
        link_url: row.link_url || '',
        bg_color: row.bg_color || DEFAULT.bg_color,
        text_color: row.text_color || DEFAULT.text_color,
        is_active: row.is_active ?? true,
      };
      setData(next);
      setSaved(next);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [id]);

  // Note: banner edits don't drive a live preview in the central
  // iframe today — save → hub bumps iframe key → DB refetch.
  // The earlier `kokkok-builder-banner-preview` postMessage was wired
  // here but never listened anywhere; removed to avoid silent dead
  // traffic. If we add live preview later, mirror the slide-preview
  // pipeline in CarouselSlideModal + admin/homepage + HomepageBanner.

  const updateText = useCallback((lang: Lang, value: string) => {
    setData(prev => ({ ...prev, text: { ...prev.text, [lang]: value } }));
  }, []);

  async function handleSave() {
    if (!supabase || !id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('homepage_banners')
        .update({
          text: data.text,
          link_url: data.link_url || null,
          bg_color: data.bg_color,
          text_color: data.text_color,
          is_active: data.is_active,
        })
        .eq('id', id);
      if (error) throw error;
      revalidateHomepageData('homepage_banners');
      setSaved(data);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      toast.show('띠배너가 저장되었습니다', 'success');
    } catch (err) {
      console.error('[admin/banners] save failed:', err);
      toast.show('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!supabase || !id) return;
    const ok = await confirm({ message: '이 띠배너를 삭제할까요? 되돌릴 수 없습니다.', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('homepage_banners')
        .delete()
        .eq('id', id);
      if (error) throw error;
      // Best-effort: also strip the matching key from the section order
      // so the deleted banner never paints. The hub re-loads order on
      // next mount, so the order array stays accurate.
      const { data: row } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'homepage_section_order')
        .maybeSingle();
      if (row?.value) {
        try {
          const arr = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          if (Array.isArray(arr)) {
            const filtered = arr.filter((k: string) => k !== `banner:${id}`);
            await supabase
              .from('site_settings')
              .update({ value: JSON.stringify(filtered), updated_at: new Date().toISOString() })
              .eq('key', 'homepage_section_order');
          }
        } catch { /* ignore */ }
      }
      revalidateHomepageData('homepage_banners');
      // If we're in the embedded drawer, signal close; else go back.
      if (typeof window !== 'undefined' && window.parent !== window) {
        try {
          window.parent.postMessage(
            { type: 'kokkok-builder-editor-close' },
            window.location.origin,
          );
        } catch { /* ignore */ }
      } else {
        router.push('/admin/homepage');
      }
    } catch (err) {
      console.error('[admin/banners] delete failed:', err);
      toast.show('삭제에 실패했습니다.', 'error');
    }
  }

  const dirty = JSON.stringify(data) !== JSON.stringify(saved);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1f2937]">띠배너 편집</h1>
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#dc2626] border border-[#fecaca] rounded hover:bg-[#fef2f2] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      </div>

      {/* Live preview chip */}
      <div className="rounded border border-[#e5e7eb] overflow-hidden">
        <div className="px-3 py-2 text-[11px] text-[#6b7280] bg-[#fafbfc] border-b border-[#e5e7eb]">
          미리보기
        </div>
        <div
          className="py-3 px-4 text-center text-[13px] sm:text-[14px] font-medium tracking-wide"
          style={{ backgroundColor: data.bg_color, color: data.text_color }}
        >
          {data.text?.[activeLang] || data.text?.kr || data.text?.en || '(텍스트를 입력하세요)'}
        </div>
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={data.is_active}
          onChange={e => setData(prev => ({ ...prev, is_active: e.target.checked }))}
          className="w-4 h-4"
        />
        활성화 (체크 해제 시 사이트에 표시 안 됨)
      </label>

      {/* Multi-language text */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-[#374151]">텍스트</label>
          <div className="flex gap-1">
            {SUPPORTED_LANGS.map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveLang(lang)}
                className={`px-2 py-0.5 text-[11px] rounded ${
                  activeLang === lang
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
                }`}
              >
                {LANG_LABELS[lang]}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          maxLength={120}
          value={data.text?.[activeLang] || ''}
          onChange={e => updateText(activeLang, e.target.value)}
          placeholder={`${LANG_LABELS[activeLang]} 텍스트 (최대 120자)`}
          className="w-full px-3 py-2 text-[13px] border border-[#d1d5db] rounded focus:border-[#3b82f6] focus:outline-none"
        />
      </div>

      {/* Link URL */}
      <div className="space-y-2">
        <label className="text-[12px] font-semibold text-[#374151]">링크 (선택)</label>
        <input
          type="text"
          value={data.link_url}
          onChange={e => setData(prev => ({ ...prev, link_url: e.target.value }))}
          placeholder="/products 또는 https://..."
          className="w-full px-3 py-2 text-[13px] border border-[#d1d5db] rounded focus:border-[#3b82f6] focus:outline-none"
        />
        <p className="text-[11px] text-[#9ca3af]">비워두면 클릭 불가</p>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-[#374151]">배경색</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.bg_color}
              onChange={e => setData(prev => ({ ...prev, bg_color: e.target.value }))}
              className="w-10 h-9 rounded border border-[#d1d5db] cursor-pointer"
            />
            <input
              type="text"
              value={data.bg_color}
              onChange={e => setData(prev => ({ ...prev, bg_color: e.target.value }))}
              className="flex-1 px-2 py-1.5 text-[12px] font-mono border border-[#d1d5db] rounded"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-[#374151]">글자색</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.text_color}
              onChange={e => setData(prev => ({ ...prev, text_color: e.target.value }))}
              className="w-10 h-9 rounded border border-[#d1d5db] cursor-pointer"
            />
            <input
              type="text"
              value={data.text_color}
              onChange={e => setData(prev => ({ ...prev, text_color: e.target.value }))}
              className="flex-1 px-2 py-1.5 text-[12px] font-mono border border-[#d1d5db] rounded"
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] disabled:bg-[#9ca3af] disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '저장 중...' : '저장'}
        </button>
        {savedFlash && (
          <span className="text-[12px] text-[#059669]">저장됨 ✓</span>
        )}
      </div>
    </div>
  );
}
