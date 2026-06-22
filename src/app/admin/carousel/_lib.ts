/**
 * Shared types + helpers for the admin/carousel editor.
 *
 * Lives here (not in src/lib/) because nothing outside this route reads it.
 */

import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import type { CarouselSlide } from '@/lib/api/carousel';
import { resolveAnchor } from '@/lib/typography/options';
import type { PositionAnchor, PositionKey } from '@/lib/typography/options';

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
  /** Migration 35: optional mobile-specific image. Empty/null leaves
   *  HeroSlider falling back to the desktop image. */
  mobileImageUrl: string;
  mobileImageFile: File | null;
  link_url: string;
  display_mode: 'default' | 'fullpage';
  media_type: 'image' | 'video' | 'gif';
  // Phase 3 typography columns (migration 00000000000025).
  badge_font_family: string | null;
  title_font_family: string | null;
  subtitle_font_family: string | null;
  badge_bold: boolean;
  badge_italic: boolean;
  badge_underline: boolean;
  title_bold: boolean;
  title_italic: boolean;
  title_underline: boolean;
  subtitle_bold: boolean;
  subtitle_italic: boolean;
  subtitle_underline: boolean;
  // Legacy 9-cell columns (migrations 25/27/29). Kept for backward
  // safety until the next minor sweep — every consumer now reads the
  // _anchor pairs below and only falls back to these when an old row
  // is missing the new anchor.
  text_position: PositionKey;
  text_position_mobile: PositionKey;
  image_position: PositionKey;
  image_position_mobile: PositionKey;
  // Migration 30 (2026-06-09): continuous (x, y) percent anchors that
  // replace the 9-cell pickers. Admin clicks anywhere in the preview
  // box and the marker drops at the exact (x, y) inside the slide.
  text_anchor: PositionAnchor;
  text_anchor_mobile: PositionAnchor;
  image_anchor: PositionAnchor;
  image_anchor_mobile: PositionAnchor;
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
  mobileImageUrl: '',
  mobileImageFile: null,
  link_url: '',
  display_mode: 'default',
  media_type: 'image',
  badge_font_family: null,
  title_font_family: null,
  subtitle_font_family: null,
  badge_bold: false,    badge_italic: false,    badge_underline: false,
  title_bold: true,     title_italic: false,    title_underline: false,
  subtitle_bold: false, subtitle_italic: false, subtitle_underline: false,
  text_position: 'mc',
  text_position_mobile: 'mc',
  image_position: 'mc',
  image_position_mobile: 'mc',
  text_anchor: { x: 50, y: 50 },
  text_anchor_mobile: { x: 50, y: 50 },
  image_anchor: { x: 50, y: 50 },
  image_anchor_mobile: { x: 50, y: 50 },
};

/**
 * Hydrate a SlideFormData from a saved row. resolveAnchor() falls back
 * to the legacy 9-cell key when the new continuous anchor is missing —
 * makes pre-migration-30 rows safe to open in the editor.
 */
export function formFromSlide(s: CarouselSlide): SlideFormData {
  return {
    badge: { ...s.badge },
    title: { ...s.title },
    subtitle: { ...s.subtitle },
    bg_color: s.bg_color || '#eef4f7',
    text_color: s.text_color || '#111111',
    badge_bg_color: s.badge_bg_color || '#333333',
    badge_text_color: s.badge_text_color || '#FFFFFF',
    title_size_offset: s.title_size_offset ?? 0,
    subtitle_size_offset: s.subtitle_size_offset ?? 0,
    badge_size_offset: s.badge_size_offset ?? 0,
    sort_order: String(s.sort_order),
    is_active: s.is_active,
    imageUrl: s.image_url || '',
    imageFile: null,
    mobileImageUrl: s.mobile_image_url || '',
    mobileImageFile: null,
    link_url: s.link_url || '',
    display_mode: s.display_mode || 'default',
    media_type: s.media_type || 'image',
    badge_font_family: s.badge_font_family ?? null,
    title_font_family: s.title_font_family ?? null,
    subtitle_font_family: s.subtitle_font_family ?? null,
    badge_bold:        s.badge_bold        ?? false,
    badge_italic:      s.badge_italic      ?? false,
    badge_underline:   s.badge_underline   ?? false,
    title_bold:        s.title_bold        ?? true,
    title_italic:      s.title_italic      ?? false,
    title_underline:   s.title_underline   ?? false,
    subtitle_bold:     s.subtitle_bold     ?? false,
    subtitle_italic:   s.subtitle_italic   ?? false,
    subtitle_underline: s.subtitle_underline ?? false,
    text_position:         (s.text_position as SlideFormData['text_position']) ?? 'mc',
    text_position_mobile:  (s.text_position_mobile as SlideFormData['text_position_mobile']) ?? 'mc',
    image_position:        (s.image_position as SlideFormData['image_position']) ?? 'mc',
    image_position_mobile: (s.image_position_mobile as SlideFormData['image_position_mobile']) ?? 'mc',
    text_anchor:          resolveAnchor(s.text_anchor, s.text_position),
    text_anchor_mobile:   resolveAnchor(s.text_anchor_mobile, s.text_position_mobile),
    image_anchor:         resolveAnchor(s.image_anchor, s.image_position),
    image_anchor_mobile:  resolveAnchor(s.image_anchor_mobile, s.image_position_mobile),
  };
}

/**
 * Build the DB payload from a SlideFormData + resolved image URLs. Pulled
 * out of the modal so the save handler can stay readable, and so the legacy
 * 9-cell positions + new continuous anchors stay defined in the same
 * place (the row needs to be in sync for rollback safety).
 */
export function buildSlidePayload(
  formData: SlideFormData,
  finalImageUrl: string,
  finalMobileImageUrl: string,
) {
  return {
    badge: formData.badge,
    title: formData.title,
    subtitle: formData.subtitle,
    image_url: finalImageUrl || null,
    mobile_image_url: finalMobileImageUrl || null,
    bg_color: formData.bg_color,
    text_color: formData.text_color,
    badge_bg_color: formData.badge_bg_color,
    badge_text_color: formData.badge_text_color,
    title_size_offset: formData.title_size_offset,
    subtitle_size_offset: formData.subtitle_size_offset,
    badge_size_offset: formData.badge_size_offset,
    sort_order: parseInt(formData.sort_order) || 0,
    is_active: formData.is_active,
    link_url: formData.link_url || null,
    display_mode: formData.display_mode,
    media_type: formData.media_type,
    badge_font_family: formData.badge_font_family,
    title_font_family: formData.title_font_family,
    subtitle_font_family: formData.subtitle_font_family,
    badge_bold: formData.badge_bold,
    badge_italic: formData.badge_italic,
    badge_underline: formData.badge_underline,
    title_bold: formData.title_bold,
    title_italic: formData.title_italic,
    title_underline: formData.title_underline,
    subtitle_bold: formData.subtitle_bold,
    subtitle_italic: formData.subtitle_italic,
    subtitle_underline: formData.subtitle_underline,
    // Legacy 9-cell keys (kept in sync as a backward-compat rollback safety
    // until the next minor sweep can drop the old columns).
    text_position: formData.text_position,
    text_position_mobile: formData.text_position_mobile,
    image_position: formData.image_position,
    image_position_mobile: formData.image_position_mobile,
    // Migration 30 — JSONB anchors are the real source of truth now.
    text_anchor: formData.text_anchor,
    text_anchor_mobile: formData.text_anchor_mobile,
    image_anchor: formData.image_anchor,
    image_anchor_mobile: formData.image_anchor_mobile,
  };
}

export async function uploadSlideAsset(file: File): Promise<string> {
  if (USE_S3_FROM_BROWSER) {
    const { publicUrl } = await uploadFileToS3(file, {
      keyPrefix: 'carousel',
      contentType: file.type,
    });
    return publicUrl;
  }
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
