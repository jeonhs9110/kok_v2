import { test, expect } from '@playwright/test';

/**
 * Admin smoke tests — added 2026-06-21 after the 12 mega-refactor PRs
 * (~10K LOC of admin consolidation). The pre-existing admin-products
 * spec only covered the product modal; this widens coverage to every
 * page that got a new hook so a regression in any of them shows up
 * before the operator sees it.
 *
 * Skipped without credentials. Set in `.env.test.local`:
 *
 *   E2E_ADMIN_EMAIL=admin@kokkok.com
 *   E2E_ADMIN_PASSWORD=<the shared admin password>
 *
 * Read-only: every test navigates to a page + asserts something the
 * hook is responsible for fetching. No form submissions.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin smoke (post-refactor)', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'admin credentials not configured');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/이메일 주소|email/i).fill(ADMIN_EMAIL!);
    await page.getByPlaceholder(/비밀번호|password/i).fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in|로그인/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 15_000 });
  });

  test('/admin dashboard renders with the 4 stat cards', async ({ page }) => {
    await page.goto('/admin');
    // useDashboardData hook drives these — if it throws, the page would
    // be blank or stuck on the loading skeleton.
    await expect(page.getByText(/총 방문수/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/신규 회원/)).toBeVisible();
    await expect(page.getByText(/게시중 상품/)).toBeVisible();
    await expect(page.getByText(/위시리스트 추가/)).toBeVisible();
  });

  test('/admin/reviews loads — useReviews hook does the DB fetch', async ({ page }) => {
    await page.goto('/admin/reviews');
    await expect(page.getByText(/리뷰 카드 관리/)).toBeVisible({ timeout: 10_000 });
    // 4 StatStrip cards from useReviews's loaded rows.
    await expect(page.getByText(/전체 리뷰/)).toBeVisible();
  });

  test('/admin/instagram loads — useInstagram hook fetches config + posts', async ({ page }) => {
    await page.goto('/admin/instagram');
    await expect(page.getByText(/인스타그램$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/인스타그램 포스트/)).toBeVisible();
  });

  test('/admin/shorts loads — useShorts hook fetches shorts + products', async ({ page }) => {
    await page.goto('/admin/shorts');
    await expect(page.getByText(/BRAND SHORTS 관리/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/전체 쇼츠/)).toBeVisible();
  });

  test('/admin/homepage builder loads — useHomepageBuilder hook drives the section rail', async ({ page }) => {
    await page.goto('/admin/homepage');
    // The dark slate top toolbar is rendered by TopToolbar; if
    // useHomepageBuilder throws on mount the page would be blank.
    await expect(page.getByText(/메인 캐러셀/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('/admin/users renders the users table — useUsers hook loads the rows', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByText(/사용자 계정/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/총 회원/)).toBeVisible();
  });

  test('/admin/menus loads the tree — useMenus hook fetches the rows', async ({ page }) => {
    await page.goto('/admin/menus');
    await expect(page.getByText(/메뉴 관리/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/전체 메뉴/)).toBeVisible();
  });

  test('/admin/categories loads the tree — useCategories renders parents + subs', async ({ page }) => {
    await page.goto('/admin/categories');
    await expect(page.getByRole('heading', { name: /카테고리/ })).toBeVisible({ timeout: 10_000 });
  });

  test('/admin/theme loads — useTheme hook fetches site_settings.theme_tokens', async ({ page }) => {
    await page.goto('/admin/theme');
    await expect(page.getByText(/테마 편집/)).toBeVisible({ timeout: 10_000 });
    // The brand colors section is what the operator opens most often.
    await expect(page.getByText(/브랜드 색상/)).toBeVisible();
  });

  test('Cmd+K opens the admin search modal — useAdminSearch hook initial state', async ({ page }) => {
    await page.goto('/admin');
    await page.keyboard.press('Control+K');
    await expect(page.getByPlaceholder(/상품, 메뉴, 페이지, 게시글 검색/)).toBeVisible({ timeout: 5_000 });
  });
});
