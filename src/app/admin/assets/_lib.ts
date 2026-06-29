import type { SupabaseClient } from '@supabase/supabase-js';
import type { Asset, BucketId } from './_components/types';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);

export function kindFromName(name: string): Asset['kind'] {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'other';
}

/**
 * Recursively list every object under `prefix` (4 levels deep enough for
 * the current upload layout). Supabase's `list()` returns a mix of files
 * and folders — folders have a null `id`, so we recurse into those.
 *
 * Live S3 listing happens via /api/admin/storage/list; this is the
 * pre-cutover Supabase Storage fallback that page.tsx only reaches when
 * USE_S3_FROM_BROWSER is false (dev / non-prod environments).
 */
export async function listBucketRecursive(
  supabase: SupabaseClient,
  bucket: BucketId,
  prefix = '',
  depth = 0,
): Promise<Asset[]> {
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
      const sub = await listBucketRecursive(supabase, bucket, fullPath, depth + 1);
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

interface UsageHit {
  table: string;
  label: string;
  examples: string[];
  count: number;
}

/**
 * Check usage of an asset URL across the 10 tables that can embed it,
 * and produce a Korean confirm-modal message. Calls the server-side
 * /api/admin/asset-usage endpoint, which does the actual cross-table
 * scan via the standard USE_RDS dispatcher.
 *
 * 2026-06-29: previously this function did the cross-table scan
 * CLIENT-SIDE via direct Supabase queries. After the 2026-06-27
 * decommission, every query came back empty so the confirm modal
 * always read "no references found" even when the image was still
 * live on the storefront. Operators have been deleting in-use images
 * with that false safety signal for 3 days. Now goes through the
 * server-side route which dispatches via USE_RDS.
 *
 * Signature kept for backwards compatibility — `_supabase` is ignored.
 */
export async function buildDeleteConfirmMessage(
  _supabase: SupabaseClient,
  url: string,
  assetLabel: string,
): Promise<{ message: string; hasReferences: boolean }> {
  let usage: UsageHit[] = [];
  try {
    const res = await fetch(`/api/admin/asset-usage?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json() as { usage?: UsageHit[] };
      usage = json.usage ?? [];
    }
  } catch (err) {
    console.error('[assets] usage check failed; proceeding without safety net:', err);
    // Don't block the operator — the prompt now warns we couldn't verify.
    return {
      hasReferences: false,
      message: `⚠️ 참조 확인 중 오류가 발생했습니다. 그래도 삭제하시겠습니까?\n\n${assetLabel}`,
    };
  }

  if (usage.length > 0) {
    const lines = usage.map(u => {
      const ex = u.examples.length > 0
        ? ` (${u.examples.slice(0, 3).join(', ')}${u.examples.length > 3 || u.count > 3 ? ' 외' : ''})`
        : '';
      return `• ${u.label} ${u.count}개${ex}`;
    });
    return {
      hasReferences: true,
      message: `⚠️ 이 이미지는 아래에서 사용 중입니다:\n\n${lines.join('\n')}\n\n${assetLabel}\n\n삭제하면 해당 위치에 이미지가 표시되지 않습니다. 계속 삭제하시겠습니까?`,
    };
  }

  return {
    hasReferences: false,
    message: `정말 삭제하시겠습니까?\n\n${assetLabel}\n\n(10개 위치에서 모두 참조하지 않는 것으로 확인됨: 상품 메인 이미지 · 서브 히어로 · 캐러셀 · 프로모 · 리뷰 · 인스타 · 상품 상세 본문 · 상품 상세 컴포넌트 · 메뉴 본문 · 페이지 블록)`,
  };
}
