'use client';

import { Globe } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';

const COUNTRY_NAMES: Record<string, string> = {
  KR: '한국', US: '미국', JP: '일본', CN: '중국', GB: '영국', DE: '독일',
  FR: '프랑스', SG: '싱가포르', AU: '호주', CA: '캐나다', TH: '태국',
  VN: '베트남', TW: '대만', HK: '홍콩', UNKNOWN: '알 수 없음',
};

/**
 * Top-8 country-of-origin breakdown of all analytics rows. Each bar is
 * normalized to the leading country so the smaller markets remain
 * visible. KOREAN labels with English ISO code fallback for unmapped
 * countries (e.g. 'BR' → 'BR' renders rather than '알 수 없음').
 */
export default function CountryBreakdownPanel({
  countries,
}: {
  countries: { country: string; count: number }[];
}) {
  return (
    <Panel title="국가별 방문" subtitle="전체 누적" icon={Globe}>
      {countries.length === 0 ? (
        <EmptyState label="아직 방문 데이터가 없습니다" />
      ) : (
        <div className="space-y-2.5">
          {countries.slice(0, 8).map(({ country, count }) => {
            const max = countries[0]?.count || 1;
            const pct = Math.round((count / max) * 100);
            return (
              <div key={country}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[12px] font-medium text-[#374151]">
                    {COUNTRY_NAMES[country] || country}
                  </span>
                  <span className="text-[11px] font-bold text-[#6b7280]">{count.toLocaleString()}회</span>
                </div>
                <div className="w-full bg-[#f3f4f6] rounded h-1.5">
                  <div className="bg-[#3b82f6] h-1.5 rounded transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
