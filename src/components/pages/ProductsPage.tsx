import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { getProducts } from '@/lib/api/products';
import { getCategoriesTree } from '@/lib/api/categories';
import { translateProductsBatch } from '@/lib/openai';

const labels: Record<string, {
  title: string; sub: string; all: string; count: string;
}> = {
  kr: { title: 'SHOP ALL', sub: '카테고리별로 제품을 확인하세요.', all: '전체', count: '총 {n}개의 상품' },
  en: { title: 'SHOP ALL', sub: 'Browse products by category.', all: 'All', count: '{n} Products' },
};

interface Props {
  lang: string;
  canPurchase: boolean;
  searchQuery?: string;
  categorySlug?: string;
  subSlug?: string;
}

// Compose /products URLs that preserve the active filters the caller
// wants to keep. Prior code hardcoded category/sub/q into raw templates
// that silently wiped whichever param wasn't named — Round 26 audit
// found clicking Category-pill dropped the search, clicking Clear
// dropped the category, etc. Every filter link on this page routes
// through here.
function buildFilterHref(
  lang: string,
  keep: { category?: string; sub?: string; q?: string },
): string {
  const params = new URLSearchParams();
  if (keep.category) params.set('category', keep.category);
  if (keep.sub) params.set('sub', keep.sub);
  if (keep.q) params.set('q', keep.q);
  const qs = params.toString();
  return qs ? `/${lang}/products?${qs}` : `/${lang}/products`;
}

export default async function ProductsPage({ lang, canPurchase, searchQuery, categorySlug, subSlug }: Props) {
  const lb = labels[lang] ?? labels['en'];

  const [allProducts, categoriesTree] = await Promise.all([
    getProducts(),
    getCategoriesTree(),
  ]);

  // Build flat lookup for filtering
  const allCategories = categoriesTree.flatMap(p => [p, ...p.children]);
  const activeCategory = categorySlug ? allCategories.find(c => c.slug === categorySlug && !c.parent_id) : undefined;
  const activeSub = subSlug ? allCategories.find(c => c.slug === subSlug && c.parent_id) : undefined;

  let activeProducts = allProducts.filter(p => p.is_active);

  // Category filter
  if (activeSub) {
    activeProducts = activeProducts.filter(p => p.subcategory_id === activeSub.id);
  } else if (activeCategory) {
    const childIds = categoriesTree.find(c => c.id === activeCategory.id)?.children.map(c => c.id) ?? [];
    activeProducts = activeProducts.filter(p => p.category_id === activeCategory.id || childIds.includes(p.subcategory_id ?? ''));
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    activeProducts = activeProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.ingredient.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }

  const calculateDiscount = (price: number, original: number) =>
    original > price ? Math.round(((original - price) / original) * 100) : 0;

  // Batch-translate product names + summaries for non-Korean languages
  let translations: Record<string, { name: string; summary: string }> = {};
  if (lang !== 'kr' && activeProducts.length > 0) {
    translations = await translateProductsBatch(
      lang,
      activeProducts.map(p => ({ id: p.id, name: p.name, summary: p.summary }))
    );
  }

  const formattedProducts = activeProducts.map(p => ({
    id: p.id,
    name:    translations[p.id]?.name    ?? p.name,
    summary: translations[p.id]?.summary ?? p.summary,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: calculateDiscount(p.price, p.originalPrice),
    imageUrl: p.imageUrl,
  }));

  // Page title: show category name if filtered
  const pageTitle = activeSub
    ? (activeSub.name[lang] || activeSub.name['en'] || activeSub.slug).toUpperCase()
    : activeCategory
      ? (activeCategory.name[lang] || activeCategory.name['en'] || activeCategory.slug).toUpperCase()
      : lb.title;

  // Get subcategories of active category for second row pills
  const activeParent = activeSub
    ? categoriesTree.find(c => c.id === activeSub.parent_id)
    : activeCategory
      ? categoriesTree.find(c => c.id === activeCategory.id)
      : undefined;

  const isAll = !categorySlug && !subSlug;
  const pillBase = `px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition`;
  const pillActive = `bg-black text-white`;
  const pillInactive = `bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
      <div className="mb-8 border-b border-neutral-100 pb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">{pageTitle}</h1>
            <p className="text-sm text-neutral-500">{lb.sub}</p>
          </div>
        </div>

        {/* Category filter pills */}
        {categoriesTree.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Link href={buildFilterHref(lang, { q: searchQuery })} className={`${pillBase} ${isAll ? pillActive : pillInactive}`}>{lb.all}</Link>
              {categoriesTree.map(cat => (
                <Link
                  key={cat.slug}
                  href={buildFilterHref(lang, { category: cat.slug, q: searchQuery })}
                  className={`${pillBase} ${activeCategory?.id === cat.id && !activeSub ? pillActive : pillInactive}`}
                >
                  {cat.name[lang] || cat.name['en'] || cat.slug}
                </Link>
              ))}
            </div>
            {/* Subcategory pills */}
            {activeParent && activeParent.children.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Link
                  href={buildFilterHref(lang, { category: activeParent.slug, q: searchQuery })}
                  className={`${pillBase} ${!activeSub && activeCategory ? pillActive : pillInactive}`}
                >
                  {lb.all}
                </Link>
                {activeParent.children.map(sub => (
                  <Link
                    key={sub.slug}
                    href={buildFilterHref(lang, { sub: sub.slug, category: activeParent.slug, q: searchQuery })}
                    className={`${pillBase} ${activeSub?.id === sub.id ? pillActive : pillInactive}`}
                  >
                    {sub.name[lang] || sub.name['en'] || sub.slug}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-8">
        <span className="text-sm font-medium text-neutral-500">
          {lb.count.replace('{n}', String(formattedProducts.length))}
        </span>
      </div>

      {searchQuery && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-neutral-500">
            {/* Truncate the display to keep the chip on one line on
                mobile. Cap at 40 chars — anything longer than a real
                product name is either an attempt at layout abuse or a
                shared URL with a stale multi-word query. */}
            {lang === 'kr'
              ? `"${searchQuery.length > 40 ? searchQuery.slice(0, 40) + '…' : searchQuery}" 검색 결과`
              : `Results for "${searchQuery.length > 40 ? searchQuery.slice(0, 40) + '…' : searchQuery}"`}
          </span>
          {/* Round 26: Clear preserves category+sub filters. Prior link
              jumped to /products, silently wiping the customer's active
              category narrowing along with the search. */}
          <Link href={buildFilterHref(lang, { category: categorySlug, sub: subSlug })} className="text-xs text-neutral-400 hover:text-black underline underline-offset-2">
            {lang === 'kr' ? '초기화' : 'Clear'}
          </Link>
        </div>
      )}

      {formattedProducts.length === 0 ? (
        <div className="py-20 text-center text-neutral-400">
          <p className="text-lg font-semibold">{lang === 'kr' ? '검색 결과가 없습니다' : 'No products found'}</p>
          <p className="text-sm mt-2 mb-6">{lang === 'kr' ? '다른 키워드로 검색해보세요.' : 'Try a different keyword.'}</p>
          {/* Round 27: give the customer an actual next action instead
              of a dead-end. Primary is always "view all products"
              (drops both search + filter); when a category filter is
              also active, a secondary link keeps the search but drops
              the category. R26's Clear link at the top only wiped the
              search — this empty-state block is the fallback when the
              customer has already scanned the whole page. */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={buildFilterHref(lang, {})}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-ink text-white text-xs font-bold tracking-widest hover:bg-black transition-colors"
            >
              {lang === 'kr' ? '전체 상품 보기' : 'View all products'}
            </Link>
            {(categorySlug || subSlug) && searchQuery && (
              <Link
                href={buildFilterHref(lang, { q: searchQuery })}
                className="inline-flex items-center gap-2 px-6 py-3 border border-neutral-200 text-neutral-600 text-xs font-semibold tracking-widest hover:bg-neutral-50 transition-colors"
              >
                {lang === 'kr' ? '카테고리 필터만 지우기' : 'Clear category filter'}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {formattedProducts.map(p => (
            <ProductCard key={p.id} {...p} canPurchase={canPurchase} />
          ))}
        </div>
      )}
    </div>
  );
}
