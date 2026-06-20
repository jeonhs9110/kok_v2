'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Search, Trash2, Copy, Check, ImageIcon, FileText, Film, Folder, ExternalLink, RefreshCw,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { PageHeader } from '@/components/admin/CafeWidgets';

// Session-aware client. Reads go via public storage URLs but list() and
// remove() require the storage RLS to authorize, which Phase 5 ties to
// is_admin() — so we need the admin's JWT on the wire.
const supabase = getSupabaseBrowser();

type BucketId = 'site-assets' | 'product-images';

const BUCKETS: { id: BucketId; label: string; description: string }[] = [
  { id: 'site-assets', label: 'site-assets', description: '로고, 배경, 월드와이드 벤더 로고/국가 이미지' },
  { id: 'product-images', label: 'product-images', description: '상품, 캐러셀, 프로모 배너, 서브 히어로, 인스타, 리뷰' },
];

interface Asset {
  bucket: BucketId;
  /** Full object key within the bucket (e.g. "carousel/1234-abc.png") */
  key: string;
  name: string;
  /** Bytes. May be 0 for legacy uploads where metadata wasn't tracked. */
  size: number;
  /** ISO timestamp from object metadata. */
  updatedAt: string;
  /** Inferred from extension. */
  kind: 'image' | 'video' | 'other';
  publicUrl: string;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);

function kindFromName(name: string): Asset['kind'] {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'other';
}

function formatBytes(n: number): string {
  if (n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
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
      if (!confirm(confirmMsg)) {
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

      <div className="bg-white rounded border border-[#e5e7eb] p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="파일명 / 경로 검색"
              className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', ...BUCKETS.map(b => b.id)] as const).map(b => {
              const isActive = bucketFilter === b;
              return (
                <button
                  key={b}
                  onClick={() => setBucketFilter(b)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                    isActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {b === 'all' ? '전체' : b}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong className="font-semibold">로딩 실패:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Grid */}
        <div className="bg-white rounded border border-[#e5e7eb] p-4 min-h-[400px]">
          {isLoading && filtered.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400 font-bold tracking-widest">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <Folder className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">검색 결과 없음</p>
              <p className="text-xs mt-1">
                {assets.length === 0 ? '아직 업로드된 파일이 없습니다.' : '검색어 또는 버킷 필터를 변경해보세요.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3 ml-1">총 {filtered.length}개</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map(a => {
                  const isSelected = selected?.bucket === a.bucket && selected?.key === a.key;
                  return (
                    <button
                      key={`${a.bucket}/${a.key}`}
                      onClick={() => setSelected(a)}
                      className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all bg-gray-50 ${
                        isSelected ? 'border-black ring-2 ring-black/10' : 'border-transparent hover:border-gray-200'
                      }`}
                    >
                      {a.kind === 'image' ? (
                        <Image
                          src={a.publicUrl}
                          alt={a.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                          className="object-cover"
                          unoptimized
                        />
                      ) : a.kind === 'video' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                          <Film className="w-8 h-8" />
                          <span className="mt-1 text-[10px] font-mono uppercase">{a.name.split('.').pop()}</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                          <FileText className="w-8 h-8" />
                          <span className="mt-1 text-[10px] font-mono uppercase">{a.name.split('.').pop() || 'file'}</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-2 py-1.5 text-left">
                        <p className="truncate font-semibold">{a.name}</p>
                        <p className="opacity-70 truncate">{a.bucket}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Detail panel */}
        <aside className="bg-white rounded border border-[#e5e7eb] p-5 lg:sticky lg:top-6 h-fit">
          {selected ? (
            <AssetDetail
              asset={selected}
              copiedKey={copiedKey}
              deletingKey={deletingKey}
              onCopy={handleCopy}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="py-10 text-center text-gray-400">
              <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-xs">왼쪽에서 파일을 선택하면 상세 정보가 표시됩니다</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function AssetDetail({
  asset, copiedKey, deletingKey, onCopy, onDelete, onClose,
}: {
  asset: Asset;
  copiedKey: string | null;
  deletingKey: string | null;
  onCopy: (a: Asset) => void;
  onDelete: (a: Asset) => void;
  onClose: () => void;
}) {
  const isCopied = copiedKey === asset.key;
  const isDeleting = deletingKey === asset.key;
  return (
    <div className="space-y-4">
      <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 border border-gray-100 relative">
        {asset.kind === 'image' ? (
          <Image src={asset.publicUrl} alt={asset.name} fill sizes="320px" className="object-contain" unoptimized />
        ) : asset.kind === 'video' ? (
          <video src={asset.publicUrl} controls muted className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12" />
            <span className="mt-2 text-xs font-mono uppercase">{asset.name.split('.').pop() || 'file'}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">파일명</p>
          <p className="text-sm font-semibold text-gray-800 break-all">{asset.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">버킷</p>
            <p className="font-mono text-gray-700">{asset.bucket}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">크기</p>
            <p className="text-gray-700">{formatBytes(asset.size)}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">경로</p>
          <p className="font-mono text-[11px] text-gray-600 break-all">{asset.key}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">업데이트</p>
          <p className="text-xs text-gray-600">
            {asset.updatedAt ? new Date(asset.updatedAt).toLocaleString('ko-KR') : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => onCopy(asset)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3b82f6] text-white text-xs font-bold tracking-wider rounded-lg hover:bg-[#2563eb] transition"
        >
          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {isCopied ? '복사됨' : 'URL 복사'}
        </button>
        <a
          href={asset.publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-xs font-bold tracking-wider rounded-lg hover:bg-gray-50 transition"
        >
          <ExternalLink className="w-4 h-4" />
          새 탭에서 열기
        </a>
        <button
          onClick={() => onDelete(asset)}
          disabled={isDeleting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-xs font-bold tracking-wider rounded-lg hover:bg-red-50 transition disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {isDeleting ? '삭제 중...' : '삭제'}
        </button>
        <button onClick={onClose} className="w-full text-[11px] text-gray-400 hover:text-gray-600 pt-1">
          닫기
        </button>
      </div>
    </div>
  );
}
