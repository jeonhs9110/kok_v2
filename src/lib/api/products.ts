import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface Product {
  id: string;
  name: string;
  summary: string;
  ingredient: string;
  description: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  is_active: boolean;
  naver_store_url?: string;
  category_id?: string;
  subcategory_id?: string;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "레티놀 바운스 세럼",
    summary: "끈적임없이 촉촉한 기능성 세럼",
    ingredient: "RETINOL",
    description: "순수 레티놀을 안정화하여 민감한 피부도 안심하고 사용할 수 있는 데일리 기능성 탄력 세럼입니다.",
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
    price: 26000,
    originalPrice: 38000,
    imageUrl: "https://images.unsplash.com/photo-1608248593842-b062b0afdf93?w=800&q=80&auto=format&fit=crop",
    is_active: false // Mock out of stock or hidden
  }
];

export async function getProducts(): Promise<Product[]> {
  try {
    if (!supabase) throw new Error("No Supabase Client");
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    
    // Map DB schema to frontend interface
    return data.map(d => ({
      id: d.id,
      name: d.name,
      summary: d.summary || '',
      ingredient: d.ingredient || '',
      description: d.description || '',
      price: Number(d.price),
      originalPrice: Number(d.original_price || d.price),
      imageUrl: (d.images && d.images.length > 0) ? d.images[0] : '',
      is_active: d.is_active,
      naver_store_url: d.naver_store_url || undefined,
      category_id: d.category_id || undefined,
      subcategory_id: d.subcategory_id || undefined,
    }));
  } catch (err) {
    console.warn("DB Products Fetch Failed. Returning Mock Data.");
    return MOCK_PRODUCTS;
  }
}
