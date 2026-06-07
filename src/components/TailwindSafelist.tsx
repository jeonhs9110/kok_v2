/**
 * TAILWIND v4 SAFELIST FORCER
 *
 * Tailwind v4's source scanner does not reliably extract class strings
 * sitting as values inside TypeScript object literals (the bug that
 * silently dropped every sm:/md: position class through PRs #95, #96,
 * and #98). The `@source inline()` directive in globals.css ALSO didn't
 * generate the classes after multiple syntax attempts.
 *
 * The only mechanism that's 100% reliable: put the class names as a
 * literal `className` attribute in a JSX file the scanner DEFINITELY
 * walks. This component is rendered (display:none) inside the root
 * layout so Tailwind sees every class name listed below and generates
 * the matching CSS rule.
 *
 * Adding a new dynamically-built class? Add it here too. Removing one?
 * Remove it from here.
 *
 * Renders nothing visible; no impact on layout or accessibility (hidden
 * from screen readers via aria-hidden + tabIndex).
 */
export default function TailwindSafelist() {
  return (
    <span
      aria-hidden="true"
      tabIndex={-1}
      style={{ display: 'none' }}
      // Position picker breakpoint variants — consumed by HeroSlider
      // (sm:) and SubHeroBanner (md:) from POSITION_DESKTOP_SM /
      // POSITION_DESKTOP_MD records in src/lib/typography/options.ts.
      className="sm:items-start sm:items-center sm:items-end sm:justify-start sm:justify-center sm:justify-end sm:text-left sm:text-center sm:text-right md:items-start md:items-center md:items-end md:justify-start md:justify-center md:justify-end md:text-left md:text-center md:text-right bg-[#FEE500] bg-[#FDD800] bg-[#03C75A] bg-[#02b350] hover:bg-[#FDD800] hover:bg-[#02b350] text-[#391B1B]"
    />
  );
}
