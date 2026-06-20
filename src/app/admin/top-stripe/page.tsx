'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';

const supabase = getSupabaseBrowser();

interface TopStripe {
  is_active: boolean;
  text: string;
  link_url: string;
  bg_color: string;
  text_color: string;
}

const DEFAULT: TopStripe = {
  is_active: false,
  text: '',
  link_url: '',
  bg_color: '#1f2937',
  text_color: '#ffffff',
};

/**
 * /admin/top-stripe — admin-editable thin promotional band rendered
 * above the header on every page (migration 36). Stored as a singleton
 * site_settings row keyed 'top_stripe' with a JSON value.
 *
 * The form is intentionally compact — text + link + two colors + an
 * active toggle is the entire surface. A live preview chip at the top
 * shows what the stripe looks like with the current settings before
 * saving.
 */
export default function TopStripeAdminPage() {
  const toast = useToast();
  const [data, setData] = useState<TopStripe>(DEFAULT);
  const [saved, setSaved] = useState<TopStripe>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      const { data: row } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'top_stripe')
        .maybeSingle();
      if (row?.value) {
        try {
          const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          const merged = { ...DEFAULT, ...parsed };
          setData(merged);
          setSaved(merged);
        } catch { /* keep defaults */ }
      }
      setLoading(false);
    })().catch(err => {
      console.error('[admin/top-stripe] load failed:', err);
      setLoading(false);
    });
  }, []);

  const isDirty = JSON.stringify(data) !== JSON.stringify(saved);

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'top_stripe', value: JSON.stringify(data), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      setSaved(data);
      revalidateHomepageData('top_stripe');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      console.error('[admin/top-stripe] save failed:', err);
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-400 p-8">불러오는 중...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded border border-[#e5e7eb] p-6 space-y-4">
        <div>
          <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">상단 띠배너</h2>
          <p className="text-xs text-gray-500">사이트 최상단(헤더 위)에 노출되는 얇은 띠. 첫 쇼핑 쿠폰·이벤트 안내·시즌 메시지 등 짧은 문구에 적합합니다.</p>
        </div>

        {/* Mini live preview */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-1.5 bg-gray-50 border-b border-gray-100">미리보기</p>
          <div
            className="text-center py-2 px-4 text-[13px] font-medium tracking-wide"
            style={{ backgroundColor: data.bg_color, color: data.text_color }}
          >
            {data.text || <span className="opacity-50">(텍스트를 입력하세요)</span>}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.is_active}
            onChange={e => setData(d => ({ ...d, is_active: e.target.checked }))}
            className="w-4 h-4 rounded"
          />
          <span className={data.is_active ? 'font-semibold text-gray-800' : 'text-gray-600'}>
            {data.is_active ? '✓ 사이트에 노출됨' : '비공개 (사이트에 표시 안 됨)'}
          </span>
        </label>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">표시할 텍스트</label>
          <input
            type="text"
            value={data.text}
            onChange={e => setData(d => ({ ...d, text: e.target.value }))}
            placeholder="예: 첫 쇼핑을 지원하는 3,000원 할인 회원가입 쿠폰"
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
            maxLength={120}
          />
          <p className="text-[10px] text-gray-400 mt-1">최대 120자.</p>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">클릭 시 이동할 링크 (선택)</label>
          <input
            type="text"
            value={data.link_url}
            onChange={e => setData(d => ({ ...d, link_url: e.target.value }))}
            placeholder="예: /register 또는 https://..."
            className="w-full mt-1 px-3 py-2 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:border-gray-400"
          />
          <p className="text-[10px] text-gray-400 mt-1">비워두면 클릭해도 이동하지 않습니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">배경 색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={data.bg_color}
                onChange={e => setData(d => ({ ...d, bg_color: e.target.value }))}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0"
              />
              <input
                type="text"
                value={data.bg_color}
                onChange={e => setData(d => ({ ...d, bg_color: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">글자 색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={data.text_color}
                onChange={e => setData(d => ({ ...d, text_color: e.target.value }))}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0"
              />
              <input
                type="text"
                value={data.text_color}
                onChange={e => setData(d => ({ ...d, text_color: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`inline-flex items-center gap-2 px-5 py-2 rounded text-sm font-bold tracking-wider transition ${
            savedFlash
              ? 'bg-green-600 text-white'
              : isDirty
              ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          {saving ? '저장 중...' : savedFlash ? '✓ 저장됨' : isDirty ? '저장' : '저장된 상태'}
        </button>
      </div>
    </div>
  );
}
