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

export async function getActiveReviewCards(): Promise<ReviewCard[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('review_cards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return (data as ReviewCardRow[]).map(r => ({
      id: r.id,
      image_url: r.image_url ?? '',
      title: r.title ?? '',
      content_html: r.content_html ?? '',
      link_url: r.link_url,
      sort_order: r.sort_order,
      is_active: r.is_active,
    }));
  } catch {
    return [];
  }
}

export async function getReviewCard(id: string): Promise<ReviewCard | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('review_cards')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as ReviewCardRow;
    return {
      id: r.id,
      image_url: r.image_url ?? '',
      title: r.title ?? '',
      content_html: r.content_html ?? '',
      link_url: r.link_url,
      sort_order: r.sort_order,
      is_active: r.is_active,
    };
  } catch {
    return null;
  }
}

export async function getAllReviewCards(): Promise<ReviewCard[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('review_cards')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return (data as ReviewCardRow[]).map(r => ({
      id: r.id,
      image_url: r.image_url ?? '',
      title: r.title ?? '',
      content_html: r.content_html ?? '',
      link_url: r.link_url,
      sort_order: r.sort_order,
      is_active: r.is_active,
    }));
  } catch {
    return [];
  }
}
