'use client';

import { Save, TrendingUp } from 'lucide-react';
import { LoadingState } from '@/components/admin/CafeWidgets';
import { useTopViewed } from './_components/useTopViewed';

const WINDOW_OPTIONS = [
  { value: 3, label: '최근 3일' },
  { value: 7, label: '최근 7일' },
  { value: 14, label: '최근 14일' },
  { value: 30, label: '최근 30일' },
];

const COUNT_OPTIONS = [
  { value: 4, label: '4개' },
  { value: 8, label: '8개' },
  { value: 12, label: '12개' },
  { value: 16, label: '16개' },
];

/**
 * /admin/top-viewed — controls the "지금 가장 많이 본 상품" auto-section
 * that pulls top-viewed products from analytics. Before this page
 * existed the section was hardcoded (title, subtitle, window, count) and
 * couldn't be hidden — surfaced by the homepage builder audit 2026-06-29.
 *
 * Singleton site_settings row keyed 'top_viewed_config' with a JSON value.
 * Window / count changes need a server-side re-query of analytics — saved
 * value is the source of truth there. Title / subtitle get real-time
 * preview via kokkok-builder-topviewed-preview.
 */
export default function TopViewedAdminPage() {
  const { data, setData, loading, saving, savedFlash, isDirty, handleSave } = useTopViewed();

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#6b7280]" />
            <h2 className="text-[14px] font-bold text-[#1f2937]">인기 상품 섹션</h2>
          </div>
          <p className="text-xs text-[#6b7280]">
            홈페이지에 노출되는 &quot;지금 가장 많이 본 상품&quot; 섹션을 관리합니다. 최근 N일간 가장 많이
            조회된 상품을 자동으로 보여줍니다. 데이터가 부족할 때(조회된 상품 3개 미만)는 자동으로 숨겨집니다.
          </p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">제목 (한국어)</label>
            <input
              type="text"
              value={data.title_kr}
              onChange={e => setData(d => ({ ...d, title_kr: e.target.value }))}
              placeholder="예: 지금 가장 많이 본 상품"
              className="w-full mt-1 px-3 py-2 text-sm rounded"
              maxLength={60}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">제목 (영어)</label>
            <input
              type="text"
              value={data.title_en}
              onChange={e => setData(d => ({ ...d, title_en: e.target.value }))}
              placeholder="e.g. TRENDING NOW"
              className="w-full mt-1 px-3 py-2 text-sm rounded"
              maxLength={60}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">부제목 (한국어)</label>
            <input
              type="text"
              value={data.subtitle_kr}
              onChange={e => setData(d => ({ ...d, subtitle_kr: e.target.value }))}
              placeholder="예: 최근 7일 인기"
              className="w-full mt-1 px-3 py-2 text-sm rounded"
              maxLength={60}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">부제목 (영어)</label>
            <input
              type="text"
              value={data.subtitle_en}
              onChange={e => setData(d => ({ ...d, subtitle_en: e.target.value }))}
              placeholder="e.g. Last 7 days"
              className="w-full mt-1 px-3 py-2 text-sm rounded"
              maxLength={60}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">데이터 기간</label>
            <select
              value={data.window_days}
              onChange={e => setData(d => ({ ...d, window_days: Number(e.target.value) }))}
              className="w-full mt-1 px-3 py-2 text-sm rounded bg-white"
            >
              {WINDOW_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-[#9ca3af] mt-1">최근 며칠간의 조회수를 기준으로 집계합니다.</p>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">표시할 상품 개수</label>
            <select
              value={data.top_n}
              onChange={e => setData(d => ({ ...d, top_n: Number(e.target.value) }))}
              className="w-full mt-1 px-3 py-2 text-sm rounded bg-white"
            >
              {COUNT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-[#9ca3af] mt-1">상위 N개 상품을 카드 그리드로 노출합니다.</p>
          </div>
        </div>

        <p className="text-[11px] text-[#9ca3af] border-t border-[#f3f4f6] pt-3">
          제목·부제목은 저장 전에도 미리보기에 즉시 반영됩니다. 데이터 기간·개수 변경은 저장 후 다음 새로고침에 반영됩니다.
        </p>

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
