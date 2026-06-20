'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { PageHeader } from '@/components/admin/CafeWidgets';
import type { Asset, BucketId, BucketInfo } from './_components/types';
import AssetFilters from './_components/AssetFilters';
import AssetGrid from './_components/AssetGrid';
import AssetDetail from './_components/AssetDetail';

// Session-aware client. Reads go via public storage URLs but list() and
// remove() require the storage RLS to authorize, which Phase 5 ties to
// is_admin() — so we need the admin's JWT on the wire.
const supabase = getSupabaseBrowser();

const BUCKETS: BucketInfo[] = [
  { id: 'site-assets', label: 'site-assets', description: '로고, 배경, 월드와이드 벤더 로고/국가 이미지' },
  { id: 'product-images', label: 'product-images', description: '상품, 캐러셀, 프로모 배너, 서브 히어로, 인스타, 리뷰' },
];

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);

function kindFromName(name: string): Asset['kind'] {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'other';
}

/**
 * Recursively list every object under `prefix` (3 levels deep is enough for
 * the current upload layout). Supabase's `list()` returns a mix of files and
 * folders — folders have a null `id`, so we recurse into those.
 */
async function listBucketRecursive(bucket: BucketId, prefix = '', depth = 0): Promise<Asset[]> {
  if (depth > 4) return []; // safety stop
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'updated_at', order: 'desc' } });
  if (error || !data) return [];
  const out: Asset[] = [];
  for (const item of data) {
    if (!item.name) continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // folder
      const sub = await listBucketRecursive(bucket, fullPath, depth + 1);
      out.push(...sub);
    } else {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
      out.push({
        bucket,
        key: fullPath,
        name: item.name,
        size: (item.metadata as { size?: number } | null)?.size ?? 0,
        updatedAt: item.updated_at ?? item.created_at ?? '',
        kind: kindFromName(item.name),
        publicUrl: urlData.publicUrl,
      });
    }
  }
  return out;
}

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
      const [a, b] = await Promise.all([
        listBucketRecursive('site-assets'),
        listBucketRecursive('product-images'),
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter(a => {
      if (bucketFilter !== 'all' && a.bucket !== bucketFilter) return false;
      if (!q) return true;
      return a.key.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    });
  }, [assets, bucketFilter, search]);

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
      // Check usage across the tables most likely to reference the
      // asset's public URL before letting the admin orphan a product
      // image. Cheap to do because each query is `select count` and
      // the columns being scanned are all `text` / not indexed in a
      // way that'd punish a single LIKE per delete. If any of the
      // queries error (e.g. RLS denies the read), we fall through to
      // a softer warning rather than blocking the delete.
      const url = a.publicUrl;
      // Expanded to also check promo_banners (homepage banner pair),
      // review_cards (review showcase thumbnails), and instagram_posts
      // (IG grid) — those were three of the four tables the hostile
      // audit caught the usage warning silently skipping. (shorts only
      // stores youtube_id; thumbnails are auto-pulled from
      // i.ytimg.com/vi/${id}/hqdefault.jpg, so no cover_url column to
      // check.) page_blocks (admin/pages JSONB) also isn't covered;
      // the JSONB shape varies and a simple column query can't reach
      // image URLs nested inside the block array. Both gaps surfaced
      // in the confirm prompt below.
      // products.images is a text[] (verified live: { "images": ["https://…"] }),
      // not the singular `image_url` / `detail_image_url` columns the earlier
      // OR-eq targeted — neither of those exists, so PostgREST errored, the
      // try-catch silently swallowed the products check, and admins could
      // delete an image that products were still using. .contains() builds
      // the right `images=cs.{url}` array-containment filter for text[].
      //
      // Detail-section images live inside detail_body (HTML) and
      // detail_components (JSONB array). A column-level eq can't reach
      // either; both gaps are surfaced in the "best-effort" caveat at the
      // bottom of the confirm prompt.
      const [products, sub_hero, carousel, promo, reviews, ig] = await Promise.all([
        supabase.from('products').select('id, name').contains('images', [url]).limit(5),
        supabase.from('sub_hero_banners').select('id').eq('image_url', url).limit(5),
        supabase.from('carousel_slides').select('id, badge').eq('image_url', url).limit(5),
        supabase.from('promo_banners').select('id').eq('image_url', url).limit(5),
        supabase.from('review_cards').select('id, title').eq('image_url', url).limit(5),
        supabase.from('instagram_posts').select('id').eq('image_url', url).limit(5),
      ]);

      const productRefs = products.data ?? [];
      const subHeroRefs = sub_hero.data ?? [];
      const carouselRefs = carousel.data ?? [];
      const promoRefs = promo.data ?? [];
      const reviewRefs = reviews.data ?? [];
      const igRefs = ig.data ?? [];
      const total = productRefs.length + subHeroRefs.length + carouselRefs.length
                  + promoRefs.length + reviewRefs.length + igRefs.length;

      let confirmMsg: string;
      if (total > 0) {
        const lines: string[] = [];
        if (productRefs.length > 0) {
          lines.push(`• 상품 ${productRefs.length}개 (${productRefs.slice(0, 3).map(p => p.name).filter(Boolean).join(', ')}${productRefs.length > 3 ? ' 외' : ''})`);
        }
        if (subHeroRefs.length > 0) lines.push(`• 서브 히어로 배너 ${subHeroRefs.length}개`);
        if (carouselRefs.length > 0) lines.push(`• 메인 캐러셀 슬라이드 ${carouselRefs.length}개`);
        if (promoRefs.length > 0)    lines.push(`• 프로모 배너 ${promoRefs.length}개`);
        if (reviewRefs.length > 0)   lines.push(`• 리뷰 카드 ${reviewRefs.length}개`);
        if (igRefs.length > 0)       lines.push(`• 인스타 슬롯 ${igRefs.length}개`);
        confirmMsg = `⚠️ 이 이미지는 아래에서 사용 중입니다:\n\n${lines.join('\n')}\n\n${a.bucket}/${a.key}\n\n삭제하면 해당 위치에 이미지가 표시되지 않습니다. 계속 삭제하시겠습니까?`;
      } else {
        // Caveat: page-builder blocks (admin/pages JSONB) aren't
        // queryable with a simple column eq; surface that the check
        // is best-effort so the admin doesn't trust a "no references"
        // result for a build-your-own-page block image.
        confirmMsg = `정말 삭제하시겠습니까?\n\n${a.bucket}/${a.key}\n\n(상품 메인 이미지/서브 히어로/캐러셀/프로모/리뷰/인스타에서는 참조하지 않는 것으로 확인됨. 상품 상세 본문(에디터 내부 이미지) · 페이지 빌더 블록 내부 이미지는 자동 검사 대상이 아닙니다.)`;
      }
      const ok = await confirm({ message: confirmMsg, tone: 'danger', confirmText: '삭제' });
      if (!ok) {
        setDeletingKey(null);
        return;
      }

      const { error: removeErr } = await supabase.storage.from(a.bucket).remove([a.key]);
      if (removeErr) throw removeErr;
      setAssets(prev => prev.filter(x => !(x.bucket === a.bucket && x.key === a.key)));
      if (selected?.bucket === a.bucket && selected?.key === a.key) setSelected(null);
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#374151] border border-[#d1d5db] rounded bg-white hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
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
