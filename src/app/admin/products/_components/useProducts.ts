import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import type { Product } from '@/lib/api/products';
import type { Category } from '@/lib/api/categories';

const supabase = getSupabaseBrowser();

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
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!supabase) throw new Error('Supabase 클라이언트 없음 (env 미설정)');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data.map(d => ({
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
      })));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('[admin/products] DB 로드 실패:', err);
      setLoadError(msg);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
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
      if (!supabase) throw new Error('Supabase 클라이언트 없음');
      const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      revalidateHomepageData('products');
    } catch (err) {
      console.warn('[admin/products] 토글 DB 동기화 실패:', err);
      setProducts(snapshot);
      toast.show('상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = products;
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      if (!supabase) throw new Error('Supabase 클라이언트 없음');
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      revalidateHomepageData('products');
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
