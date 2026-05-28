/**
 * Shared types + helpers for the admin/carousel editor.
 *
 * Lives here (not in src/lib/) because nothing outside this route reads it.
 */

import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Session-aware client. Phase 5 storage RLS on product-images requires
// the admin JWT for the upload below.
const supabase = getSupabaseBrowser();

const BUCKET = 'product-images';
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export interface SlideFormData {
  badge: Record<string, string>;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  bg_color: string;
  text_color: string;
  badge_bg_color: string;
  badge_text_color: string;
  title_size_offset: number;
  subtitle_size_offset: number;
  badge_size_offset: number;
  sort_order: string;
  is_active: boolean;
  imageUrl: string;
  imageFile: File | null;
  link_url: string;
  display_mode: 'default' | 'fullpage';
  media_type: 'image' | 'video' | 'gif';
}

export const emptyForm: SlideFormData = {
  badge: {},
  title: {},
  subtitle: {},
  bg_color: '#eef4f7',
  text_color: '#111111',
  badge_bg_color: '#333333',
  badge_text_color: '#FFFFFF',
  title_size_offset: 0,
  subtitle_size_offset: 0,
  badge_size_offset: 0,
  sort_order: '0',
  is_active: true,
  imageUrl: '',
  imageFile: null,
  link_url: '',
  display_mode: 'default',
  media_type: 'image',
};

export async function uploadSlideAsset(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `carousel/${fileName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
