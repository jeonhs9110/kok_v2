// Re-export the supabase singleton from its standalone module so the
// long tail of `import { supabase } from '@/lib/api/products'` callers
// keeps working. NEW callers should import from
// '@/lib/supabase/client-singleton' directly — Client Components in
// particular MUST do so, otherwise the dispatcher's dynamic import to
// '@/lib/db/products' below drags pg into the browser bundle and the
// build fails at `require('tls')`.
export { supabase } from '@/lib/supabase/client-singleton';
import { supabase } from '@/lib/supabase/client-singleton';

export type DetailComponentType = 'image' | 'video' | 'youtube';

export interface DetailComponent {
  id: string;
  type: DetailComponentType;
  url: string;
  sort_order: number;
}

/**
 * Per-product SEO settings — populated from the products.seo JSONB column
 * (migration 00000000000040). All fields optional; storefront
 * generateMetadata falls back to product.name / product.summary when
 * unset so legacy rows render identically.
 */
export interface ProductSeo {
  indexable?: boolean;
  title?: string;
  author?: string;
  description?: string;
  keywords?: string;
  imageAlt?: string;
}

export interface Product {
  id: string;
  name: string;
  summary: string;
  ingredient: string;
  description: string;
  detailBody: string;
  detailComponents: DetailComponent[];
  price: number;
  originalPrice: number;
  imageUrl: string;
  is_active: boolean;
  is_best_seller?: boolean;
  naver_store_url?: string;
  category_id?: string;
  subcategory_id?: string;
  show_cart_button?: boolean;
  show_buy_button?: boolean;
  seo?: ProductSeo;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "레티놀 바운스 세럼",
    summary: "끈적임없이 촉촉한 기능성 세럼",
    ingredient: "RETINOL",
    description: "순수 레티놀을 안정화하여 민감한 피부도 안심하고 사용할 수 있는 데일리 기능성 탄력 세럼입니다.",
    detailBody: "",
    detailComponents: [],
    price: 23400,
    originalPrice: 26000,
    imageUrl: "https://plus.unsplash.com/premium_photo-1681996500858-ff9cc3f28203?w=800&q=80&auto=format&fit=crop",
    is_active: true,
    naver_store_url: "https://smartstore.naver.com/kokkok-garden"
  },
  {
    id: "2",
    name: "EGF 글로우 젤리 세럼",
    summary: "탱글한 젤리로 피부 탄성 회복 케어",
    ingredient: "EGF & PEPTIDE",
    description: "고순도 EGF 성분이 피부 본연의 힘을 길러주고, 촉촉한 젤리 제형이 빈틈없이 수분을 채워줍니다.",
    detailBody: "",
    detailComponents: [],
    price: 23400,
    originalPrice: 26000,
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80&auto=format&fit=crop",
    is_active: true,
    naver_store_url: "https://smartstore.naver.com/kokkok-garden"
  },
  {
    id: "3",
    name: "액티브 리커버리 크림",
    summary: "트러블 부터 자극 진정까지 하나로!",
    ingredient: "CICA & PANTHENOL",
    description: "시카와 판테놀이 배합되어 예민해진 피부를 빠르게 진정시키고 장벽을 탄탄하게 회복시켜 줍니다.",
    detailBody: "",
    detailComponents: [],
    price: 23400,
    originalPrice: 26000,
    imageUrl: "https://plus.unsplash.com/premium_photo-1675842663249-a8b70126afbc?w=800&q=80&auto=format&fit=crop",
    is_active: true,
    naver_store_url: "https://smartstore.naver.com/kokkok-garden"
  },
  {
    id: "4",
    name: "퓨어 클렌징 오일",
    summary: "블랙헤드를 녹이는 클렌징 오일",
    ingredient: "JOJOBA OIL",
    description: "부드럽게 롤링되어 모공 속 화이트헤드와 블랙헤드를 깨끗하게 녹여내는 산뜻한 포뮬러의 클렌징 오일입니다.",
    detailBody: "",
    detailComponents: [],
    price: 26000,
    originalPrice: 38000,
    imageUrl: "https://images.unsplash.com/photo-1608248593842-b062b0afdf93?w=800&q=80&auto=format&fit=crop",
    is_active: false // Mock out of stock or hidden
  }
];

// Production behavior: return [] on any Supabase failure so the BEST SELLER
// section shows its empty state. The previous behavior (returning MOCK_PRODUCTS
// — fake "레티놀 바운스 세럼" etc.) hid real outages from the operator and could
// route customers to product IDs that 404 on click. Mocks are dev-only now.
const IS_DEV = process.env.NODE_ENV === 'development';

export async function getProducts(): Promise<Product[]> {
  // Phase C1 of the RDS migration: dispatch to the pg implementation
  // when USE_RDS=true. Until cutover (Phase F), USE_RDS stays false in
  // prod so the Supabase path below is the live one. The pg path runs
  // in dev / CI for parity testing.
  if (process.env.USE_RDS === 'true') {
    try {
      const { getProductsFromPg } = await import('@/lib/db/products');
      return await getProductsFromPg();
    } catch (err) {
      console.error('[products] RDS fetch failed — no Supabase fallback when USE_RDS=true:', err);
      return [];
    }
  }
  try {
    if (!supabase) throw new Error("No Supabase Client");
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    return data.map(d => ({
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
      naver_store_url: d.naver_store_url || undefined,
      category_id: d.category_id || undefined,
      subcategory_id: d.subcategory_id || undefined,
      show_cart_button: d.show_cart_button ?? false,
      show_buy_button: d.show_buy_button ?? false,
      // d.seo may be missing on rows created before migration 40 — read
      // defensively. JSON.parse not needed; supabase-js returns JSONB
      // columns as already-parsed objects. Array.isArray check rejects
      // `seo: []` payloads (would otherwise pass `typeof === 'object'`
      // and crash with "seo.title is not a function"-style errors when
      // the storefront calls into it).
      seo: (d.seo && typeof d.seo === 'object' && !Array.isArray(d.seo)) ? (d.seo as ProductSeo) : undefined,
    }));
  } catch (err) {
    if (IS_DEV) {
      console.warn("[products] DB fetch failed in dev — serving MOCK_PRODUCTS:", err);
      return MOCK_PRODUCTS;
    }
    console.error("[products] DB fetch failed in production — returning empty list:", err);
    return [];
  }
}
