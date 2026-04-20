import { supabase } from './products';

export type TagCategory = 'primary' | 'functional' | 'allergen';

export const TAG_CATEGORIES: { value: TagCategory; label_kr: string; label_en: string }[] = [
  { value: 'primary',    label_kr: '주요 성분',     label_en: 'Key Ingredients' },
  { value: 'functional', label_kr: '기능성 성분',   label_en: 'Functional Ingredients' },
  { value: 'allergen',   label_kr: '알러지 유발 성분', label_en: 'Potential Allergens' },
];

export interface IngredientTag {
  id: string;
  category: TagCategory;
  name: Record<string, string>; // jsonb { kr, en, cn, jp, vn, th }
  sort_order: number;
  is_active: boolean;
}

export async function getAllTags(): Promise<IngredientTag[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('ingredient_tags')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      category: d.category as TagCategory,
      name: (d.name as Record<string, string>) ?? {},
      sort_order: d.sort_order ?? 0,
      is_active: d.is_active !== false,
    }));
  } catch {
    return [];
  }
}

export async function getActiveTags(): Promise<IngredientTag[]> {
  const all = await getAllTags();
  return all.filter(t => t.is_active);
}

export async function getProductTags(productId: string): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('product_ingredient_tags')
      .select('tag_id')
      .eq('product_id', productId);
    if (error || !data) return [];
    return (data as { tag_id: string }[]).map(r => r.tag_id);
  } catch {
    return [];
  }
}

export async function setProductTags(productId: string, tagIds: string[]): Promise<boolean> {
  if (!supabase) return false;
  // Replace-all strategy: delete current, insert new
  const del = await supabase.from('product_ingredient_tags').delete().eq('product_id', productId);
  if (del.error) return false;
  if (tagIds.length === 0) return true;
  const rows = tagIds.map(tag_id => ({ product_id: productId, tag_id }));
  const ins = await supabase.from('product_ingredient_tags').insert(rows);
  return !ins.error;
}

/** Fetch tag IDs for a batch of product IDs. Returns map<productId, tagId[]>. */
export async function getTagsForProducts(productIds: string[]): Promise<Record<string, string[]>> {
  if (!supabase || productIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('product_ingredient_tags')
      .select('product_id,tag_id')
      .in('product_id', productIds);
    if (error || !data) return {};
    const map: Record<string, string[]> = {};
    for (const row of data as { product_id: string; tag_id: string }[]) {
      if (!map[row.product_id]) map[row.product_id] = [];
      map[row.product_id].push(row.tag_id);
    }
    return map;
  } catch {
    return {};
  }
}
