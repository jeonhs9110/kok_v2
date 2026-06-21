'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, X, Package, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { StatCard, StatStrip, PageHeader } from '@/components/admin/CafeWidgets';
import type { Product } from '@/lib/api/products';
import ProductList from './_components/ProductList';
import ProductDetailModal from './_components/ProductDetailModal';
import { useProducts } from './_components/useProducts';

/**
 * Admin products page. Composition layer only: owns the modal lifecycle
 * + URL filter chip, delegates everything else (data fetch + mutations
 * to useProducts; table to ProductList; form to ProductDetailModal).
 */
type FilterKey = 'all' | 'active' | 'inactive' | 'attention';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: '전체',
  active: '게시중',
  inactive: '숨김',
  attention: '관심 필요 (숨김 / 이미지 없음)',
};

export default function ProductsAdminPage() {
  // Next.js 16 requires useSearchParams to live inside a Suspense boundary.
  return (
    <Suspense fallback={<div className="bg-white rounded border border-[#e5e7eb] min-h-[400px]" />}>
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

  const { products, categories, isLoading, loadError, fetchProducts, handleToggle, handleDelete } =
    useProducts();

  /** Modal target. `null` = closed. Wrapping the product (or null for create
   *  mode) inside an object means we can re-open the modal for the *same*
   *  product and the child still sees a new prop reference. */
  const [editing, setEditing] = useState<{ product: Product | null } | null>(null);

  const filteredProducts = useMemo(() => {
    if (filter === 'all') return products;
    if (filter === 'active') return products.filter(p => p.is_active);
    if (filter === 'inactive') return products.filter(p => !p.is_active);
    // 'attention' — products visibly broken on the storefront: inactive,
    // or active-but-missing main image (which renders as a gray box).
    return products.filter(p => !p.is_active || !p.imageUrl);
  }, [products, filter]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.is_active).length,
    bestSeller: products.filter(p => p.is_best_seller).length,
    attention: products.filter(p => !p.is_active || !p.imageUrl).length,
  }), [products]);

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 상품" value={stats.total} icon={Package} isLoading={isLoading} subLabel="등록된 상품 수" />
        <StatCard accent="#22c55e" label="게시중" value={stats.active} icon={CheckCircle2} isLoading={isLoading} subLabel={`전체 ${stats.total}개 중`} />
        <StatCard accent="#f59e0b" label="BEST SELLER" value={stats.bestSeller} icon={Sparkles} isLoading={isLoading} subLabel="홈 메인 노출" />
        <StatCard accent="#ef4444" label="관심 필요" value={stats.attention} icon={AlertTriangle} isLoading={isLoading} subLabel="숨김 또는 이미지 없음" />
      </StatStrip>

      <PageHeader
        title="상품 재고"
        description="스토어 상품 및 카탈로그를 관리하세요"
        actions={
          <>
            {filter !== 'all' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-amber-100 text-amber-800 rounded-full hover:bg-amber-200 transition-colors"
              >
                {FILTER_LABELS[filter]}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setEditing({ product: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 상품 추가
            </button>
          </>
        }
      />

      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden relative">
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
