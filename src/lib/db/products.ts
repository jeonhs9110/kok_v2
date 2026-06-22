import 'server-only';
import { getPgPool } from './pool';
import type { ProductRow } from './types';
import type { Product, DetailComponent, ProductSeo } from '@/lib/api/products';

/**
 * RDS-backed implementation of the products read API.
 *
 * Mirrors the Supabase implementation in `@/lib/api/products` field-for-
 * field so the dispatcher in that module can swap between the two
 * without callers noticing. Once Phase F flips `USE_RDS=true` in prod,
 * the Supabase branch will be dead code that we delete in a follow-up.
 *
 * NULL handling matches the Supabase variant — `summary || ''`,
 * `original_price || price`, etc. — so storefront rendering paths
 * don't need conditional branches per backend.
 */
function rowToProduct(d: ProductRow): Product {
  return {
    id: d.id,
    name: d.name,
    summary: d.summary || '',
    ingredient: d.ingredient || '',
    description: d.description || '',
    detailBody: d.detail_body || '',
    detailComponents: Array.isArray(d.detail_components)
      ? (d.detail_components as DetailComponent[])
      : [],
    price: Number(d.price),
    originalPrice: Number(d.original_price ?? d.price),
    imageUrl: d.images && d.images.length > 0 ? d.images[0] : '',
    is_active: d.is_active,
    is_best_seller: d.is_best_seller ?? false,
    naver_store_url: d.naver_store_url || undefined,
    category_id: d.category_id || undefined,
    subcategory_id: d.subcategory_id || undefined,
    show_cart_button: d.show_cart_button ?? false,
    show_buy_button: d.show_buy_button ?? false,
    seo:
      d.seo && typeof d.seo === 'object' && !Array.isArray(d.seo)
        ? (d.seo as ProductSeo)
        : undefined,
  };
}

export async function getProductsFromPg(): Promise<Product[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<ProductRow>(
    `SELECT id, name, summary, ingredient, description, detail_body,
            detail_components, price, original_price, images, is_active,
            is_best_seller, naver_store_url, category_id, subcategory_id,
            show_cart_button, show_buy_button, seo, created_at
       FROM public.products
       ORDER BY created_at DESC`,
  );
  return rows.map(rowToProduct);
}
