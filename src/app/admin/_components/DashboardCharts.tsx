/**
 * Barrel re-exporting the 5 dashboard chart panels so the page-level
 * imports stay one line per panel. Each panel's source lives under
 * ./charts/ — extracted at 2026-06-21 so future chart edits don't touch
 * a 200-LOC mega-file.
 */
export { default as DailyVisitChart } from './charts/DailyVisitChart';
export { default as VisitFunnelPanel } from './charts/VisitFunnelPanel';
export { default as CountryBreakdownPanel } from './charts/CountryBreakdownPanel';
export { default as WishlistRanksPanel } from './charts/WishlistRanksPanel';
export { default as ProductClicksTable } from './charts/ProductClicksTable';
export { default as TrafficSourcesPanel } from './charts/TrafficSourcesPanel';
