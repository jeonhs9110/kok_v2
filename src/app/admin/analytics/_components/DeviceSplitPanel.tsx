'use client';

import { Smartphone, Tablet, Monitor } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { DeviceRow, DeviceType } from './useAnalyticsData';

/**
 * 모바일 / 태블릿 / 데스크탑 split. The CEO question Korean DTC
 * operators care about most after "are we growing?" — Korean
 * e-commerce skews 80%+ mobile and the design budget should track.
 * Each device row carries its session count, share, engagement rate,
 * and product-view rate so the operator can spot "mobile users
 * convert poorly to product page" or "desktop sessions are short."
 */
const DEVICE_ICON: Record<DeviceType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

const DEVICE_COLOR: Record<DeviceType, string> = {
  mobile: '#3b82f6',
  tablet: '#8b5cf6',
  desktop: '#6b7280',
};

export default function DeviceSplitPanel({ devices }: { devices: DeviceRow[] }) {
  const nonZero = devices.filter(d => d.sessions > 0);

  return (
    <Panel title="기기" subtitle="모바일 / 태블릿 / 데스크탑 세션 비율" icon={Smartphone}>
      {nonZero.length === 0 ? (
        <EmptyState label="기기 데이터가 아직 없습니다" />
      ) : (
        <div className="space-y-3">
          {nonZero.map(({ device, label, sessions, share, engagementRate, productViewRate }) => {
            const Icon = DEVICE_ICON[device];
            const color = DEVICE_COLOR[device];
            return (
              <div key={device}>
                <div className="flex justify-between items-baseline mb-1 gap-2">
                  <span className="text-[12px] font-semibold text-[#1f2937] flex items-center gap-1.5">
                    <Icon className="w-3 h-3" style={{ color }} />
                    {label}
                  </span>
                  <span className="text-[11px] text-[#6b7280] font-bold">
                    {sessions.toLocaleString()}회 · {Math.round(share * 100)}%
                  </span>
                </div>
                <div className="w-full bg-[#f3f4f6] rounded h-1.5 mb-1">
                  <div
                    className="h-1.5 rounded transition-all"
                    style={{ width: `${Math.max(2, Math.round(share * 100))}%`, backgroundColor: color }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[#6b7280]">
                  <span>
                    참여율 <span className="font-bold text-[#1f2937]">{Math.round(engagementRate * 100)}%</span>
                  </span>
                  <span className="text-[#d1d5db]">·</span>
                  <span>
                    상품 조회 <span className="font-bold text-[#1f2937]">{Math.round(productViewRate * 100)}%</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
