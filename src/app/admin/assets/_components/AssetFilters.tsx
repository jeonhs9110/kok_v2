'use client';

import { Search } from 'lucide-react';
import type { BucketId, BucketInfo } from './types';

/**
 * Search input + bucket chip-filter row at the top of the asset
 * library. Pure UI — parent owns the search string + active bucket.
 * Extracted from /admin/assets/page.tsx at 2026-06-21.
 */

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  buckets: BucketInfo[];
  bucketFilter: BucketId | 'all';
  onBucketFilterChange: (v: BucketId | 'all') => void;
}

export default function AssetFilters({
  search,
  onSearchChange,
  buckets,
  bucketFilter,
  onBucketFilterChange,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="파일명 / 경로 검색"
            className="w-full pl-10 pr-3 py-2.5 rounded text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', ...buckets.map(b => b.id)] as const).map(b => {
            const isActive = bucketFilter === b;
            return (
              <button
                key={b}
                onClick={() => onBucketFilterChange(b)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                  isActive
                    ? 'bg-[#1f2937] text-white'
                    : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
                }`}
              >
                {b === 'all' ? '전체' : b}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
