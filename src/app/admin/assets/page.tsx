'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { PageHeader } from '@/components/admin/CafeWidgets';
import { USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import type { Asset, BucketId, BucketInfo } from './_components/types';
import AssetFilters from './_components/AssetFilters';
import AssetGrid from './_components/AssetGrid';
import AssetDetail from './_components/AssetDetail';
import { listBucketRecursive, buildDeleteConfirmMessage } from './_lib';

// Fetch one bucket's assets from the S3-backed admin route. The
// route prepends `<bucket>/` to the prefix; the returned keys are
// relative (e.g. 'products/abc.jpg' not 'product-images/products/abc.jpg')
// so the UI labels match what they show under Supabase.
async function listBucketFromS3Api(bucket: BucketId): Promise<Asset[]> {
  const res = await fetch(`/api/admin/storage/list?bucket=${encodeURIComponent(bucket)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const { rows } = await res.json() as { rows: Asset[] };
  return rows;
}

// Session-aware client. Reads go via public storage URLs but list() and
// remove() require the storage RLS to authorize, which Phase 5 ties to
// is_admin() — so we need the admin's JWT on the wire.
const supabase = getSupabaseBrowser();

const BUCKETS: BucketInfo[] = [
  { id: 'site-assets', label: 'site-assets', description: '로고, 배경, 월드와이드 벤더 로고/국가 이미지' },
  { id: 'product-images', label: 'product-images', description: '상품, 캐러셀, 프로모 배너, 서브 히어로, 인스타, 리뷰' },
];

export default function AssetLibraryPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState<BucketId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [a, b] = USE_S3_FROM_BROWSER
        ? await Promise.all([
            listBucketFromS3Api('site-assets'),
            listBucketFromS3Api('product-images'),
          ])
        : await Promise.all([
            listBucketRecursive(supabase, 'site-assets'),
            listBucketRecursive(supabase, 'product-images'),
          ]);
      const all = [...a, ...b].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
      setAssets(all);
    } catch (err) {
      console.error('[admin/assets] reload failed:', err);
      setError(err instanceof Error ? err.message : '에셋 로딩 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // useDeferredValue lets React keep the search input responsive while
  // a heavy filter (thousands of assets) catches up in a low-priority
  // render. Cheaper than a debounce — the input never feels behind,
  // the grid simply lags by one frame on slow lists. Audit 2026-06-21.
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return assets.filter(a => {
      if (bucketFilter !== 'all' && a.bucket !== bucketFilter) return false;
      if (!q) return true;
      return a.key.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    });
  }, [assets, bucketFilter, deferredSearch]);

  const handleCopy = async (a: Asset) => {
    try {
      await navigator.clipboard.writeText(a.publicUrl);
      setCopiedKey(a.key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      window.prompt('아래 URL을 직접 복사하세요:', a.publicUrl);
    }
  };

  const handleDelete = async (a: Asset) => {
    setDeletingKey(a.key);
    try {
      const { message } = await buildDeleteConfirmMessage(
        supabase,
        a.publicUrl,
        `${a.bucket}/${a.key}`,
      );
      const ok = await confirm({ message, tone: 'danger', confirmText: '삭제' });
      if (!ok) {
        setDeletingKey(null);
        return;
      }

      if (USE_S3_FROM_BROWSER) {
        const res = await fetch(
          `/api/admin/storage/delete?bucket=${encodeURIComponent(a.bucket)}&key=${encodeURIComponent(a.key)}`,
          { method: 'DELETE' },
        );
        if (!res.ok) throw new Error(`API ${res.status}`);
      } else {
        const { error: removeErr } = await supabase.storage.from(a.bucket).remove([a.key]);
        if (removeErr) throw removeErr;
      }
      setAssets(prev => prev.filter(x => !(x.bucket === a.bucket && x.key === a.key)));
      if (selected?.bucket === a.bucket && selected?.key === a.key) setSelected(null);
      toast.show('파일이 삭제되었습니다.', 'success');
    } catch (err) {
      console.error('[admin/assets] delete failed:', err);
      toast.show(err instanceof Error ? err.message : '삭제 실패', 'error');
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="에셋 라이브러리"
        description="사이트에 업로드된 모든 파일을 검색 · 미리보기 · URL 복사 · 삭제"
        actions={
          <button
            onClick={reload}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#374151] border border-[#d1d5db] rounded bg-white hover:bg-[#f9fafb] disabled:opacity-50 transition-colors kokkok-keep-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        }
      />

      <AssetFilters
        search={search}
        onSearchChange={setSearch}
        buckets={BUCKETS}
        bucketFilter={bucketFilter}
        onBucketFilterChange={setBucketFilter}
      />

      {error && (
        <div className="bg-[#fef2f2] border border-[#fecaca] rounded p-4 text-sm text-[#991b1b]">
          <strong className="font-semibold">로딩 실패:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <AssetGrid
          totalCount={assets.length}
          filtered={filtered}
          isLoading={isLoading}
          selected={selected}
          onSelect={setSelected}
        />
        <AssetDetail
          asset={selected}
          copiedKey={copiedKey}
          deletingKey={deletingKey}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      </div>
    </div>
  );
}
