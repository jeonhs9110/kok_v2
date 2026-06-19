'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { Product } from '@/lib/api/products';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Session-aware client. Phase 3 RLS lockdown requires admin's JWT for
// products writes — see migration 19.
const supabase = getSupabaseBrowser();
import type { Category } from '@/lib/api/categories';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import ProductList from './_components/ProductList';
import ProductDetailModal from './_components/ProductDetailModal';

/**
 * Admin products page.
 *
 * Composition layer only: owns the product list + modal lifecycle, delegates
 * the table rendering to `<ProductList>` and the create/edit form to
 * `<ProductDetailModal>`. The previous monolith (1019 LOC) folded all three
 * concerns plus image upload, detail-component editing, tag management, and
 * a YouTube URL parser into a single file, making per-feature review and
 * incremental refactors painful.
 *
 * State ownership:
 *   - This file: product list, loading + error state, modal open/edit target,
 *     categories and tags (passed to the modal as reference data).
 *   - ProductList: stateless. Renders the table + per-row buttons.
 *   - ProductDetailModal: ALL form state (form fields, image uploads, detail
 *     components, tag selection, submit lifecycle). When `editing` becomes
 *     null the modal unmounts and discards its state, so the next open
 *     starts clean without a manual reset.
 */
type FilterKey = 'all' | 'active' | 'inactive' | 'attention';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: '전체',
  active: '게시중',
  inactive: '숨김',
  attention: '관심 필요 (숨김 / 이미지 없음)',
};

export default function ProductsAdminPage() {
  // Next.js 16 requires useSearchParams to live inside a Suspense boundary so
  // the page can opt into client-side rendering cleanly. The inner component
  // owns all the actual page logic; this outer wrapper exists solely for the
  // Suspense boundary.
  return (
    <Suspense fallback={<div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[400px]" />}>
      <ProductsAdminPageInner />
    </Suspense>
  );
}

function ProductsAdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // URL-driven filter chip. Dashboard cards deep-link here with ?filter=active
  // / ?filter=attention so the admin lands already-scoped instead of scrolling
  // a hundred-row table looking for the broken ones.
  const filter: FilterKey = (() => {
    const v = searchParams?.get('filter');
    return v === 'active' || v === 'inactive' || v === 'attention' ? v : 'all';
  })();
  const setFilter = (next: FilterKey) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next === 'all') params.delete('filter');
    else params.set('filter', next);
    const qs = params.toString();
    router.replace(qs ? `/admin/products?${qs}` : '/admin/products');
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  /**
   * Modal target. `null` = closed. Wrapping the product (or null for create
   * mode) inside an object means we can re-open the modal for the *same*
   * product and the child still sees a new prop reference, so its
   * populate-on-open effect re-fires.
   */
  const [editing, setEditing] = useState<{ product: Product | null } | null>(null);

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
      // Fail loud per the post-2026-05-27 audit: never substitute mock data
      // for a real DB failure. Operator needs to see the actual error.
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
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    try {
      if (!supabase) throw new Error('Supabase 클라이언트 없음');
      await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
      revalidateHomepageData('products');
    } catch (err) {
      console.warn('[admin/products] 토글 DB 동기화 실패:', err);
    }
  };

  const handleDelete = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      if (!supabase) throw new Error('Supabase 클라이언트 없음');
      await supabase.from('products').delete().eq('id', id);
      revalidateHomepageData('products');
    } catch (err) {
      console.warn('[admin/products] 삭제 DB 동기화 실패:', err);
    }
  };

  const filteredProducts = useMemo(() => {
    if (filter === 'all') return products;
    if (filter === 'active') return products.filter(p => p.is_active);
    if (filter === 'inactive') return products.filter(p => !p.is_active);
    // 'attention' — products visibly broken on the storefront: inactive,
    // or active-but-missing main image (which renders as a gray box).
    return products.filter(p => !p.is_active || !p.imageUrl);
  }, [products, filter]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="p-6 border-b border-gray-100 flex flex-wrap justify-between items-center gap-3 bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-800">상품 재고</h2>
          <p className="text-sm text-gray-500 mt-1">스토어 상품 및 카탈로그를 관리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full hover:bg-amber-200 transition-colors"
            >
              {FILTER_LABELS[filter]}
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setEditing({ product: null })}
            className="bg-brand-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 상품 추가
          </button>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <ProductList
          products={filteredProducts}
          isLoading={isLoading}
          loadError={loadError}
          onRetry={fetchProducts}
          onEdit={product => setEditing({ product })}
          onDelete={handleDelete}
          onToggle={handleToggle}
        />
      </div>

      <ProductDetailModal
        editing={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          fetchProducts();
        }}
      />
    </div>
  );
}
