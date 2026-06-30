import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import type { Product } from '@/lib/api/products';
import type { Category } from '@/lib/api/categories';

const supabase = getSupabaseBrowser();

// Phase C2b — dispatcher. With NEXT_PUBLIC_USE_RDS=true, list/toggle/
// delete go through /api/admin/products which hits pg. Otherwise the
// existing supabase-from-browser path is unchanged so the cutover is
// reversible by flipping the env var.

interface ProductRowFromApi {
  id: string;
  name: string;
  summary: string | null;
  ingredient: string | null;
  description: string | null;
  detail_body: string | null;
  detail_components: unknown;
  price: number | string;
  original_price: number | string | null;
  images: string[] | null;
  is_active: boolean;
  is_best_seller: boolean | null;
  naver_store_url: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  show_cart_button: boolean | null;
  show_buy_button: boolean | null;
}

function rowToProduct(d: ProductRowFromApi): Product {
  return {
    id: d.id,
    name: d.name,
    summary: d.summary || '',
    ingredient: d.ingredient || '',
    description: d.description || '',
    detailBody: d.detail_body || '',
    detailComponents: Array.isArray(d.detail_components) ? d.detail_components : [],
    price: Number(d.price),
    originalPrice: Number(d.original_price || d.price),
    imageUrl: (d.images && d.images.length > 0) ? d.images[0] : '',
    is_active: d.is_active,
    is_best_seller: d.is_best_seller ?? false,
    naver_store_url: d.naver_store_url || '',
    category_id: d.category_id || undefined,
    subcategory_id: d.subcategory_id || undefined,
    show_cart_button: d.show_cart_button ?? false,
    show_buy_button: d.show_buy_button ?? false,
  };
}

/**
 * Three-channel loader + mutator hook for /admin/products. Owns the
 * products list, reference categories, loading + error state, and the
 * is_active / delete toggle handlers. Both DB writes hit
 * revalidateHomepageData('products') so the storefront's homepage cache
 * drops the changed row immediately.
 *
 * Failure mode is loud-not-silent (per the 2026-05-27 audit) — a DB
 * error sets loadError so the operator sees the message instead of an
 * empty table that looks like "no products yet".
 */
export function useProducts() {
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch('/api/admin/products', { cache: 'no-store' });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const { rows } = await res.json() as { rows: ProductRowFromApi[] };
        setProducts(rows.map(rowToProduct));
        return;
      }
      if (!supabase) throw new Error('Supabase 클라이언트 없음 (env 미설정)');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts((data as ProductRowFromApi[]).map(rowToProduct));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('[admin/products] DB 로드 실패:', err);
      setLoadError(msg);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2026-06-29: dispatched via /api/admin/categories — pre-fix this
  // call hit Supabase unconditionally. Categories added/renamed in
  // /admin/categories after cutover land in RDS, but the product
  // editor's "카테고리" + "하위 카테고리" dropdowns kept showing the
  // 2026-06-27 snapshot. The generic route returns ALL categories;
  // filter is_active client-side to match the previous behavior.
  const fetchCategories = useCallback(async () => {
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch('/api/admin/categories', { cache: 'no-store' });
        if (!res.ok) return;
        const { rows } = await res.json() as { rows: Category[] };
        setCategories(rows.filter(c => c.is_active));
        return;
      }
      if (!supabase) return;
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) {
        console.error('[admin/products] 카테고리 로드 실패:', error);
        return;
      }
      if (data) setCategories(data);
    } catch (err) {
      console.error('[admin/products] 카테고리 로드 실패:', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    // Snapshot for rollback — if the DB write fails we put the row back
    // so the UI doesn't show a ghost state the DB never persisted.
    const snapshot = products;
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !currentStatus }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
      } else {
        if (!supabase) throw new Error('Supabase 클라이언트 없음');
        const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
        if (error) throw error;
      }
      revalidateHomepageData('products');
      toast.show(currentStatus ? '비공개로 변경되었습니다.' : '공개로 변경되었습니다.', 'success');
    } catch (err) {
      console.warn('[admin/products] 토글 DB 동기화 실패:', err);
      setProducts(snapshot);
      toast.show('상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    // Confirm before destructive action — previously a single trash-icon
    // click silently deleted the row with no undo. At 100+ SKUs the
    // misclick cost is too high.
    const ok = await confirm({
      message: '이 상품을 삭제하시겠습니까? 되돌릴 수 없습니다.',
      tone: 'danger',
      confirmText: '삭제',
    });
    if (!ok) return;
    const snapshot = products;
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
      } else {
        if (!supabase) throw new Error('Supabase 클라이언트 없음');
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
      }
      revalidateHomepageData('products');
      toast.show('상품이 삭제되었습니다.', 'success');
    } catch (err) {
      console.warn('[admin/products] 삭제 DB 동기화 실패:', err);
      setProducts(snapshot);
      toast.show('삭제에 실패했습니다.', 'error');
    }
  };

  return {
    products,
    categories,
    isLoading,
    loadError,
    fetchProducts,
    handleToggle,
    handleDelete,
  };
}
