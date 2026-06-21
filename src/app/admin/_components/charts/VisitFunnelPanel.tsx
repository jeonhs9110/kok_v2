'use client';

import { ShoppingBag } from 'lucide-react';
import { Panel } from '@/components/admin/CafeWidgets';

interface FunnelStage {
  label: string;
  value: number;
  pct: number;
  ratio?: number;
}

/**
 * 3-stage funnel: 방문 → 상품 상세 조회 → 위시리스트 추가. Cafe24's
 * "purchase funnel" analogue — our storefront doesn't capture
 * cart/order events yet, so this stops at wishlist. KCP integration
 * (Phase 2) will add the cart + order stages.
 */
export default function VisitFunnelPanel({ funnel }: { funnel: FunnelStage[] }) {
  return (
    <Panel title="방문 퍼널" subtitle="방문 → 조회 → 찜" icon={ShoppingBag}>
      <div className="space-y-3 pt-1">
        {funnel.map((stage, i) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[#374151]">{stage.label}</span>
              <span className="text-[11px] text-[#6b7280]">
                <span className="font-bold text-[#1f2937]">{stage.value.toLocaleString()}</span>
                {i > 0 && <span className="ml-1 text-[#9ca3af]">({stage.pct}%)</span>}
              </span>
            </div>
            <div className="w-full bg-[#f3f4f6] rounded h-2">
              <div
                className="h-2 rounded transition-all"
                style={{
                  width: `${i === 0 ? 100 : stage.ratio ?? 0}%`,
                  backgroundColor: ['#3b82f6', '#8b5cf6', '#ef4444'][i],
                }}
              />
            </div>
          </div>
        ))}
        <p className="text-[10px] text-[#9ca3af] pt-2 border-t border-[#f3f4f6]">
          주문/결제 단계는 KCP 결제 연동 후 추가됩니다.
        </p>
      </div>
    </Panel>
  );
}
