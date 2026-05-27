import { test, expect } from '@playwright/test';

/**
 * Storefront smoke tests — the bare minimum that has to work for the site
 * to be considered "up". If any of these fail, the homepage is broken and
 * no deploy should proceed.
 *
 * Read-only: only navigation + content assertions, no form submission.
 */

test.describe('storefront smoke', () => {
  test('home (/) redirects to /kr or /en', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    // After lang routing, the URL should be a language-prefixed path.
    expect(page.url()).toMatch(/\/(kr|en)\/?$/);
  });

  test('/kr renders the brand + hero carousel + best seller section', async ({ page }) => {
    await page.goto('/kr');

    // Brand wordmark in the header. Image alt text is the brand name.
    await expect(page.getByAltText(/kokkok garden/i)).toBeVisible();

    // Hero carousel is identifiable by its role and the "Featured products"
    // aria-label set by HeroSlider. Catches the regression where the slider
    // collapses to "COMING SOON" on a slides=0 fetch.
    await expect(
      page.getByRole('region', { name: /featured products/i })
    ).toBeVisible();

    // BEST SELLER section title. Brand-agnostic — just looking for the
    // section header.
    await expect(page.getByRole('heading', { name: /best seller/i })).toBeVisible();
  });

  test('footer shows the customer-center phone number', async ({ page }) => {
    await page.goto('/kr');

    // Phone is rendered as the only 3xl-font element inside the customer
    // center column. Asserting on a regex catches the actual phone number
    // (currently 0507-…) without binding the test to a specific value
    // that admin can change.
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    // Korean dash phone format: digits-digits-digits, 7+ digits total.
    await expect(footer).toContainText(/\d{2,4}-\d{3,4}-\d{4}/);
  });

  test('security headers are set on every response', async ({ page }) => {
    const response = await page.goto('/kr');
    const headers = response?.headers() ?? {};
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['x-frame-options']?.toLowerCase()).toBe('sameorigin');
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
