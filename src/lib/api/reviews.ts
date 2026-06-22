import { supabase } from './products';

export interface ReviewCard {
  id: string;
  image_url: string;
  title: string;
  content_html: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface ReviewCardRow {
  id: string;
  image_url: string | null;
  title: string | null;
  content_html: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

function normalize(r: ReviewCardRow): ReviewCard {
  return {
    id: r.id,
    image_url: r.image_url ?? '',
    title: r.title ?? '',
    content_html: r.content_html ?? '',
    link_url: r.link_url,
    sort_order: r.sort_order,
    is_active: r.is_active,
  };
}

export async function getActiveReviewCards(): Promise<ReviewCard[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getActiveReviewCardsFromPg } = await import('@/lib/db/storefront-reads');
      return (await getActiveReviewCardsFromPg()).map(normalize);
    } catch (err) {
      console.error('[reviews] RDS getActiveReviewCards failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('review_cards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return (data as ReviewCardRow[]).map(normalize);
  } catch {
    return [];
  }
}

export async function getReviewCard(id: string): Promise<ReviewCard | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getReviewCardFromPg } = await import('@/lib/db/storefront-reads');
      const r = await getReviewCardFromPg(id);
      return r ? normalize(r) : null;
    } catch (err) {
      console.error('[reviews] RDS getReviewCard failed:', err);
      return null;
    }
  }
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('review_cards')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return normalize(data as ReviewCardRow);
  } catch {
    return null;
  }
}

export async function getAllReviewCards(): Promise<ReviewCard[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getAllReviewCardsFromPg } = await import('@/lib/db/storefront-reads');
      return (await getAllReviewCardsFromPg()).map(normalize);
    } catch (err) {
      console.error('[reviews] RDS getAllReviewCards failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('review_cards')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return (data as ReviewCardRow[]).map(normalize);
  } catch {
    return [];
  }
}
