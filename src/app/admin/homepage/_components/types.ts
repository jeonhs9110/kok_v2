/**
 * Viewport modes for the homepage builder preview.
 *
 *   - pc    : 1440px desktop frame
 *   - mobile: 390px iPhone-shaped frame
 *   - fit   : 100% of the available pane width (no frame)
 *
 * 'fit' is Cafe24's "전체 보기" — handy when the admin wants the iframe
 * to fill every available pixel on their own monitor without a fixed
 * device frame in the way.
 */
export type ViewportMode = 'pc' | 'mobile' | 'fit';
