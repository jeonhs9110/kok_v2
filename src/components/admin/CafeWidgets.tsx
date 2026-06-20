'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Cafe24-style admin primitives — extracted from /admin (Phase B) so
 * every admin page can dress up its summary strip, section chrome,
 * empty state, and ranking badges in the same visual language without
 * each page rolling its own.
 *
 * Used by /admin (dashboard), /admin/products (stat strip),
 * /admin/users (stat strip), /admin/reviews, and a steady follow-up
 * sweep across the rest of /admin/* (Phase D.3).
 */

export interface StatCardProps {
  /** Left-stripe accent color hex (Cafe24's signature). */
  accent: string;
  label: string;
  value: number | string;
  /** Tiny line under the value — typically a cumulative total. */
  subLabel?: string;
  /** % change vs prior window; null → trend chip hidden. */
  trend?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  /** Period suffix on the trend chip (e.g. "전주 대비"). */
  trendPeriodLabel?: string;
}

export function StatCard({
  accent, label, value, subLabel, trend, icon: Icon, isLoading = false,
  trendPeriodLabel = '전주 대비',
}: StatCardProps) {
  const trendUp = trend != null && trend > 0;
  const trendDown = trend != null && trend < 0;
  return (
    <div className="relative bg-white rounded border border-[#e5e7eb] p-4 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between ml-1">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-[#1f2937] mt-1.5">
            {isLoading ? '…' : (typeof value === 'number' ? value.toLocaleString() : value)}
          </p>
          {subLabel && (
            <p className="text-[10px] text-[#9ca3af] mt-1 truncate">{subLabel}</p>
          )}
          {trend != null && (
            <div className={`inline-flex items-center gap-0.5 mt-2 text-[10px] font-bold ${
              trendUp ? 'text-[#22c55e]' : trendDown ? 'text-[#ef4444]' : 'text-[#6b7280]'
            }`}>
              {trendUp && <ArrowUpRight className="w-3 h-3" />}
              {trendDown && <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}% <span className="text-[9px] text-[#9ca3af] font-normal ml-0.5">{trendPeriodLabel}</span>
            </div>
          )}
        </div>
        <Icon className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
      </div>
    </div>
  );
}

export interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  /** Optional right-side action — e.g. a "전체 보기 →" link. */
  action?: React.ReactNode;
}

export function Panel({ title, subtitle, icon: Icon, children, className = '', action }: PanelProps) {
  return (
    <div className={`bg-white rounded border border-[#e5e7eb] p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f3f4f6]">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#6b7280] flex-shrink-0" />}
          <h3 className="text-[12px] font-bold text-[#1f2937] truncate">{title}</h3>
          {subtitle && (
            <span className="text-[10px] text-[#9ca3af] font-medium hidden sm:inline">
              · {subtitle}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-[12px] text-[#9ca3af]">{label}</div>
  );
}

export function RankBadge({ rank, small = false }: { rank: number; small?: boolean }) {
  const tone =
    rank === 1 ? 'bg-[#fef3c7] text-[#92400e]' :
    rank === 2 ? 'bg-[#e5e7eb] text-[#4b5563]' :
    rank === 3 ? 'bg-[#ffedd5] text-[#9a3412]' :
    'bg-[#f3f4f6] text-[#6b7280]';
  const size = small ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]';
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold ${tone} ${size}`}>
      {rank}
    </span>
  );
}

/**
 * StatStrip — convenience wrapper for the common 2-to-4 stat-card row
 * that sits at the top of every Cafe24-style page (right under the
 * header). Pages typically render this with their own loaded counts.
 */
export function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {children}
    </div>
  );
}

/**
 * PageHeader — Cafe24's signature page-top block: title on the left
 * with an optional description underneath, primary action cluster on
 * the right. Standardizes the slight visual variations every admin
 * page rolled by hand (different h2 sizes, different bg tints,
 * inconsistent margins).
 *
 * Usage:
 *   <PageHeader
 *     title="상품 관리"
 *     description="등록된 상품을 확인하고 게시 / 숨김을 전환합니다"
 *     actions={<button …>새 상품</button>}
 *   />
 */
export function PageHeader({
  title, description, actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-[18px] font-bold text-[#1f2937] leading-tight">{title}</h1>
        {description && (
          <p className="text-[12px] text-[#6b7280] mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
