'use client';

import { Save } from 'lucide-react';
import { LoadingState } from '@/components/admin/CafeWidgets';
import { useTopStripe } from './_components/useTopStripe';

/**
 * /admin/top-stripe — admin-editable thin promotional band rendered
 * above the header on every page (migration 36). Singleton site_settings
 * row keyed 'top_stripe' with a JSON value.
 *
 * Compact form: text + link + two colors + active toggle. Live preview
 * chip at the top shows the stripe with current settings before saving.
 */
export default function TopStripeAdminPage() {
  const { data, setData, loading, saving, savedFlash, isDirty, handleSave } = useTopStripe();

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-4">
        <div>
          <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">상단 띠배너</h2>
          <p className="text-xs text-[#6b7280]">사이트 최상단(헤더 위)에 노출되는 얇은 띠. 첫 쇼핑 쿠폰·이벤트 안내·시즌 메시지 등 짧은 문구에 적합합니다.</p>
        </div>

        {/* Mini live preview */}
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden kokkok-keep-border">
          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest px-3 py-1.5 bg-[#fafbfc] border-b border-[#f3f4f6]">미리보기</p>
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
          <span className={data.is_active ? 'font-semibold text-[#1f2937]' : 'text-[#6b7280]'}>
            {data.is_active ? '✓ 사이트에 노출됨' : '비공개 (사이트에 표시 안 됨)'}
          </span>
        </label>

        <div>
          <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">표시할 텍스트</label>
          <input
            type="text"
            value={data.text}
            onChange={e => setData(d => ({ ...d, text: e.target.value }))}
            placeholder="예: 첫 쇼핑을 지원하는 3,000원 할인 회원가입 쿠폰"
            className="w-full mt-1 px-3 py-2 text-sm rounded"
            maxLength={120}
          />
          <p className="text-[10px] text-[#9ca3af] mt-1">최대 120자.</p>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">클릭 시 이동할 링크 (선택)</label>
          <input
            type="text"
            value={data.link_url}
            onChange={e => setData(d => ({ ...d, link_url: e.target.value }))}
            placeholder="예: /register 또는 https://..."
            className="w-full mt-1 px-3 py-2 text-sm font-mono rounded"
          />
          <p className="text-[10px] text-[#9ca3af] mt-1">비워두면 클릭해도 이동하지 않습니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">배경 색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={data.bg_color}
                onChange={e => setData(d => ({ ...d, bg_color: e.target.value }))}
                className="w-10 h-10 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
              />
              <input
                type="text"
                value={data.bg_color}
                onChange={e => setData(d => ({ ...d, bg_color: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-xs font-mono rounded"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">글자 색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={data.text_color}
                onChange={e => setData(d => ({ ...d, text_color: e.target.value }))}
                className="w-10 h-10 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
              />
              <input
                type="text"
                value={data.text_color}
                onChange={e => setData(d => ({ ...d, text_color: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-xs font-mono rounded"
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
              ? 'bg-[#16a34a] text-white'
              : isDirty
              ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
              : 'bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          {saving ? '저장 중...' : savedFlash ? '✓ 저장됨' : isDirty ? '저장' : '저장된 상태'}
        </button>
      </div>
    </div>
  );
}
