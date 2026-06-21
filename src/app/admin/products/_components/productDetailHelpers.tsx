import type { DetailComponent } from '@/lib/api/products';

/** Inline YouTube glyph — used only by the detail components editor. */
export function YtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}

/**
 * Convert a legacy `detail_body` HTML blob into structured DetailComponent[]
 * by extracting every <img src=…>. Used only on first edit of products that
 * pre-date the structured-components feature, so the operator sees their
 * existing content in the new editor instead of an empty list.
 */
export function extractLegacyImagesAsComponents(detailBody: string): DetailComponent[] {
  if (typeof window === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(detailBody, 'text/html');
    return Array.from(doc.querySelectorAll('img'))
      .map(img => img.getAttribute('src') || '')
      .filter(Boolean)
      .map((url, i) => ({
        id: crypto.randomUUID(),
        type: 'image' as const,
        url,
        sort_order: i,
      }));
  } catch (err) {
    console.warn('[ProductDetailModal] legacy detail_body parse failed:', err);
    return [];
  }
}
