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

/**
 * Check usage of an asset URL across the tables most likely to reference
 * it. Returns a Korean message ready to show in a confirm modal, plus a
 * flag for whether any usage was found.
 *
 * Audit 2026-06-21: expanded coverage past the original 6 tables to
 * include the JSONB surfaces that previously fell through:
 *   - products.detail_body (rich-text HTML; matched with ilike %url%)
 *   - products.detail_components (JSONB array; cast to text and ilike)
 *   - menus.content (JSONB { lang: html } map; cast to text and ilike)
 *   - pages.blocks (JSONB block array; cast to text and ilike)
 *
 * The `::text` casts make these searchable via PostgREST's `like`/`ilike`
 * operators. The substring match is broader than a strict equality check
 * (a URL fragment could false-match), but it's correct in practice
 * because Supabase upload URLs are long opaque hashes — collisions are
 * astronomically unlikely.
 */
export async function buildDeleteConfirmMessage(
  supabase: SupabaseClient,
  url: string,
  assetLabel: string,
): Promise<{ message: string; hasReferences: boolean }> {
  // products.images is a text[] — .contains() builds the right
  // `images=cs.{url}` array-containment filter for text[].
  const [
    products, sub_hero, carousel, promo, reviews, ig,
    productDetailBody, productDetailComponents, menus, pagesRefs,
  ] = await Promise.all([
    supabase.from('products').select('id, name').contains('images', [url]).limit(5),
    supabase.from('sub_hero_banners').select('id').eq('image_url', url).limit(5),
    supabase.from('carousel_slides').select('id, badge').eq('image_url', url).limit(5),
    supabase.from('promo_banners').select('id').eq('image_url', url).limit(5),
    supabase.from('review_cards').select('id, title').eq('image_url', url).limit(5),
    supabase.from('instagram_posts').select('id').eq('image_url', url).limit(5),
    // Product detail body — rich-text HTML with embedded <img src="...">.
    supabase.from('products').select('id, name').ilike('detail_body', `%${url}%`).limit(5),
    // Product detail_components — JSONB array of { type, url }. Cast to
    // text so a substring match catches the URL inside the array.
    supabase.from('products').select('id, name').filter('detail_components::text', 'ilike', `%${url}%`).limit(5),
    // Menus content — JSONB { lang: html } map. Same cast trick.
    supabase.from('menus').select('id, slug').filter('content::text', 'ilike', `%${url}%`).limit(5),
    // Pages.blocks — JSONB { lang: block[] }. Same cast trick.
    supabase.from('pages').select('id, slug').filter('blocks::text', 'ilike', `%${url}%`).limit(5),
  ]);

  const productRefs = products.data ?? [];
  const subHeroRefs = sub_hero.data ?? [];
  const carouselRefs = carousel.data ?? [];
  const promoRefs = promo.data ?? [];
  const reviewRefs = reviews.data ?? [];
  const igRefs = ig.data ?? [];
  const productBodyRefs = productDetailBody.data ?? [];
  const productCompRefs = productDetailComponents.data ?? [];
  const menuRefs = menus.data ?? [];
  const pageRefs = pagesRefs.data ?? [];
  const total = productRefs.length + subHeroRefs.length + carouselRefs.length
              + promoRefs.length + reviewRefs.length + igRefs.length
              + productBodyRefs.length + productCompRefs.length
              + menuRefs.length + pageRefs.length;

  if (total > 0) {
    const lines: string[] = [];
    if (productRefs.length > 0) {
      lines.push(`• 상품 메인 이미지 ${productRefs.length}개 (${productRefs.slice(0, 3).map(p => p.name).filter(Boolean).join(', ')}${productRefs.length > 3 ? ' 외' : ''})`);
    }
    if (subHeroRefs.length > 0) lines.push(`• 서브 히어로 배너 ${subHeroRefs.length}개`);
    if (carouselRefs.length > 0) lines.push(`• 메인 캐러셀 슬라이드 ${carouselRefs.length}개`);
    if (promoRefs.length > 0)    lines.push(`• 프로모 배너 ${promoRefs.length}개`);
    if (reviewRefs.length > 0)   lines.push(`• 리뷰 카드 ${reviewRefs.length}개`);
    if (igRefs.length > 0)       lines.push(`• 인스타 슬롯 ${igRefs.length}개`);
    if (productBodyRefs.length > 0) lines.push(`• 상품 상세 본문 ${productBodyRefs.length}개 (에디터 내부 이미지)`);
    if (productCompRefs.length > 0) lines.push(`• 상품 상세 컴포넌트 ${productCompRefs.length}개`);
    if (menuRefs.length > 0)     lines.push(`• 메뉴 페이지 본문 ${menuRefs.length}개`);
    if (pageRefs.length > 0)     lines.push(`• 페이지 빌더 블록 ${pageRefs.length}개`);
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
