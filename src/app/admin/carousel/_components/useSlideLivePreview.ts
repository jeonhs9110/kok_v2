import { useEffect } from 'react';
import type { SlideFormData } from '../_lib';

/**
 * Live preview pipeline for /admin/homepage's embedded mode. Every
 * formData change posts the current values to the parent hub, which
 * forwards them to its central 1440px storefront iframe; the
 * storefront's HeroSlider listens and overlays them on the matching
 * slide. The unmount cleanup sends a null override so the storefront
 * drops back to the persisted slide.
 *
 * Image swaps are post-save only — blob URLs do not survive a
 * postMessage hop. New slides (editingId === null) skip the broadcast
 * because there is no slide id yet to overlay.
 */
export function useSlideLivePreview(
  formData: SlideFormData,
  editingId: string | null,
): void {
  // rAF-debounced — coalesces a burst of formData updates (color picker
  // drag, rapid typing) into a single paint. Without this, the broadcast
  // fired 10+ postMessages/sec → the central iframe re-rendered the
  // slide on every one. Audit 2026-06-21 perf finding.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    if (!editingId) return;
    const handle = requestAnimationFrame(() => {
      const override = {
        badge: formData.badge,
        title: formData.title,
        subtitle: formData.subtitle,
        bg_color: formData.bg_color,
        text_color: formData.text_color,
        badge_bg_color: formData.badge_bg_color,
        badge_text_color: formData.badge_text_color,
        title_size_offset: formData.title_size_offset,
        subtitle_size_offset: formData.subtitle_size_offset,
        badge_size_offset: formData.badge_size_offset,
        display_mode: formData.display_mode,
        media_type: formData.media_type,
        link_url: formData.link_url,
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
        text_position: formData.text_position,
        text_position_mobile: formData.text_position_mobile,
        image_position: formData.image_position,
        image_position_mobile: formData.image_position_mobile,
        text_anchor: formData.text_anchor,
        text_anchor_mobile: formData.text_anchor_mobile,
        image_anchor: formData.image_anchor,
        image_anchor_mobile: formData.image_anchor_mobile,
      };
      try {
        window.parent.postMessage(
          { type: 'kokkok-builder-slide-preview', slideId: editingId, override },
          window.location.origin,
        );
      } catch {
        // best-effort; save is the source of truth
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [formData, editingId]);

  // Cleanup — clear the override on unmount so the storefront drops
  // back to the persisted slide.
  useEffect(() => {
    return () => {
      if (typeof window === 'undefined' || window.parent === window) return;
      try {
        window.parent.postMessage(
          { type: 'kokkok-builder-slide-preview', slideId: null, override: null },
          window.location.origin,
        );
      } catch { /* ignore */ }
    };
  }, []);
}
