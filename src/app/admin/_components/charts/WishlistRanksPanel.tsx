'use client';

import { Heart } from 'lucide-react';
import { Panel, EmptyState, RankBadge } from '@/components/admin/CafeWidgets';

/**
 * Top-6 wishlist ranking — products with the most cumulative ❤️ adds.
 * The number renders in #ef4444 with a filled heart glyph so the count
 * reads as the wishlist tally specifically, not just a generic metric.
 */
export default function WishlistRanksPanel({
  wishRanks,
}: {
  wishRanks: { id: string; name: string; wishCount: number }[];
}) {
  return (
    <Panel title="위시리스트 TOP" subtitle="누적 찜 횟수 기준" icon={Heart}>
      {wishRanks.length === 0 ? (
        <EmptyState label="아직 위시리스트 데이터가 없습니다" />
      ) : (
        <div className="space-y-1">
          {wishRanks.slice(0, 6).map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b border-[#f3f4f6] last:border-0">
              <RankBadge rank={i + 1} />
              <span className="text-[12px] text-[#1f2937] font-medium truncate flex-1">{item.name}</span>
              <span className="text-[11px] font-bold text-[#ef4444] flex items-center gap-1">
                <Heart className="w-3 h-3 fill-current" /> {item.wishCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
